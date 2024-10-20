var pitchTxt = document.getElementById("pitchElement");
var noteTxt = document.getElementById("noteElement");
var analyser;
var audioContext = null;
var CANVAS = null;
var waveCanvas = null;
var array = null;
var buflen = 2048;
var buf = new Float32Array(buflen);

// Add this at the beginning of the file, after the variable declarations
var startButton = document.getElementById("startButton");
var isRecording = false;

// Add these variables at the top of the file
var testDuration = 5; // Test duration in seconds
var testStartTime;
var pitchSamples = [];
var filteredSamples = []; // To store valid samples for averaging

// Add this function to start/stop recording
function toggleRecording() {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        startButton.textContent = "Testing...";
        document.getElementById("status").textContent = "Recording...";
        document.getElementById("countdown").textContent = testDuration;

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        testStartTime = Date.now();
        pitchSamples = [];
        filteredSamples = [];
        rollingBuffer = new Array(150).fill(0);

        document.getElementById("frequencyDisplay").innerHTML = '<canvas id="waveform" width="800" height="200"></canvas>';

        CANVAS = document.getElementById("waveform");
        if (CANVAS) {
            waveCanvas = CANVAS.getContext("2d");
        }

        // Start the animation
        DrawWaveform();

        var countdownInterval = setInterval(function () {
            var elapsedTime = Math.floor((Date.now() - testStartTime) / 1000);
            var remainingTime = testDuration - elapsedTime;
            document.getElementById("countdown").textContent = remainingTime;

            if (remainingTime <= 0) {
                clearInterval(countdownInterval);
                endRecording();
            }
        }, 1000);
    }
}

function showResultPopup(result, averagePitch) {
    const popup = document.createElement('div');
    popup.className = 'result-popup';

    const resultText = document.createElement('p');
    resultText.textContent = `Result: ${result}`;
    popup.appendChild(resultText);

    const pitchText = document.createElement('p');
    pitchText.textContent = `Average Pitch: ${Math.round(averagePitch)} Hz`;
    popup.appendChild(pitchText);

    const shareButton = document.createElement('button');
    shareButton.textContent = 'Share on X';
    shareButton.className = 'share-button';
    shareButton.onclick = function () {
        const tweetText = encodeURIComponent(`My voice test result: ${result} (${Math.round(averagePitch)} Hz) - Test your voice at solanagaydar.app`);
        window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
    };
    popup.appendChild(shareButton);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'close-button';
    closeButton.onclick = function () {
        document.body.removeChild(popup);
    };
    popup.appendChild(closeButton);

    document.body.appendChild(popup);
}

function endRecording() {
    isRecording = false;
    startButton.textContent = "Begin Test";
    document.getElementById("status").textContent = "Test completed";
    document.getElementById("countdown").textContent = "";

    // Stop the animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Calculate and display the result
    var averagePitch = filteredSamples.length > 0 ? filteredSamples.reduce((a, b) => a + b, 0) / filteredSamples.length : 0;
    var result = getPitchTier(averagePitch);

    // Show the result pop-up
    showResultPopup(result, averagePitch);

    // Update the existing result display
    document.getElementById("deepnessResult").innerText = "Result: " + result;
    document.getElementById("medianFrequency").innerText = Math.round(averagePitch) + " Hz";
}

// Recieving audio input
navigator.mediaDevices.getUserMedia({
    audio: true
})
    .then(function (stream) {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

        CANVAS = document.getElementById("waveform");
        if (CANVAS) {
            waveCanvas = CANVAS.getContext("2d");
            console.log("Canvas set up successfully"); // Add this line
        } else {
            console.error("Canvas element not found"); // Add this line
        }

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 2048;

        microphone.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        startButton.addEventListener("click", toggleRecording);

        scriptProcessor.onaudioprocess = function () {
            if (isRecording) {
                analyser.getFloatTimeDomainData(buf);
                updatePitch();

                // Update rolling buffer with new data
                updateRollingBuffer(Array.from(buf).map(Math.abs));

                if (Date.now() - testStartTime >= testDuration * 1000) {
                    endRecording();
                }
            }
        };
    })
    .catch(function (err) {
        console.error(err);
    });

function noteFromPitch(frequency) {
    var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
}

function autoCorrelate(buf, sampleRate) {
    var size = buf.length;
    var rms = 0;

    for (var i = 0; i < size; i++) {
        var val = buf[i];
        rms += val * val;
    }

    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1; // Signal too weak

    var r1 = 0, r2 = size - 1;
    for (var i = 0; i < size / 2; i++) {
        if (Math.abs(buf[i]) < 0.01) {
            r1 = i;
            break;
        }
    }

    for (var i = 1; i < size / 2; i++) {
        if (Math.abs(buf[size - i]) < 0.01) {
            r2 = size - i;
            break;
        }
    }

    buf = buf.slice(r1, r2);
    size = buf.length;

    var c = new Array(size).fill(0);
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size - i; j++) {
            c[i] += buf[j] * buf[j + i];
        }
    }

    var d = 0;
    while (c[d] > c[d + 1]) d++;
    var maxVal = -1, maxPos = -1;
    for (var i = d; i < size; i++) {
        if (c[i] > maxVal) {
            maxVal = c[i];
            maxPos = i;
        }
    }

    if (maxPos === -1) return -1; // No pitch detected

    var T0 = maxPos;
    return sampleRate / T0;
}

// Function for updating pitch and filtering out unrealistic frequencies
function updatePitch(time) {
    analyser.getFloatTimeDomainData(buf);
    var ac = autoCorrelate(buf, audioContext.sampleRate);

    // Ignore frequencies that are too high to be a human voice
    if (ac != -1 && ac <= 500) {
        pitchSamples.push(ac);

        // Filter out samples to store only valid pitches
        filteredSamples.push(ac);
        pitchTxt.innerText = Math.round(ac);

        var note = noteFromPitch(ac);
        noteTxt.innerHTML = noteStrings[note % 12];

        document.getElementById("frequencyDisplay").innerText = "Current frequency: " + Math.round(ac) + " Hz";
    }
}

// Add these variables at the top of your file
var rollingBuffer = new Array(150).fill(0);
var animationFrameId = null;

function updateRollingBuffer(newData) {
    rollingBuffer.push(...newData);
    rollingBuffer = rollingBuffer.slice(-150);
}

function DrawWaveform() {
    if (!CANVAS || !isRecording) {
        return;
    }

    var width = CANVAS.width;
    var height = CANVAS.height;

    // Clear the canvas
    waveCanvas.clearRect(0, 0, width, height);

    // Set properties for the columns
    waveCanvas.fillStyle = "#007BFF"; // Blue color for the columns

    var columnWidth = width / 150;

    for (var i = 0; i < 150; i++) {
        var value = rollingBuffer[i];
        
        // Scale amplitude to fit the canvas height
        var columnHeight = value * height;

        // Draw the columns as rectangles
        waveCanvas.fillRect(i * columnWidth, height - columnHeight, columnWidth, columnHeight);
    }

    // Request next animation frame
    animationFrameId = requestAnimationFrame(DrawWaveform);
}

// Function to categorize pitch into tiers
function getPitchTier(frequency) {
    if (frequency < 85) {
        return "Chad";
    } else if (frequency < 110) {
        return "Sigma";
    } else if (frequency < 140) {
        return "Normal";
    } else if (frequency < 175) {
        return "Gay";
    } else {
        return "Very Gay";
    }
}
