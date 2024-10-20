var pitchTxt = document.getElementById("pitchElement");
var noteTxt = document.getElementById("noteElement");
var analyser;
var audioContext = null;
var CANVAS = null;
var array = null;

// Add this at the beginning of the file, after the variable declarations
var startButton = document.getElementById("startButton");
var isRecording = false;

// Add these variables at the top of the file
var testDuration = 5; // Test duration in seconds
var testStartTime;
var pitchSamples = [];

// Add this function to start/stop recording
function toggleRecording() {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        startButton.textContent = "Testing...";
        document.getElementById("status").textContent = "Recording...";
        document.getElementById("countdown").textContent = testDuration;
        // Start the audio context if it's not running
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        // Initialize the volume bars when recording starts
        instantiatePids(100, 1);
        
        testStartTime = Date.now();
        pitchSamples = [];
        
        // Start the countdown
        var countdownInterval = setInterval(function() {
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

// Add this function to create and show the result pop-up
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
    shareButton.onclick = function() {
        const tweetText = encodeURIComponent(`My voice test result: ${result} (${Math.round(averagePitch)} Hz) - Test your voice at [Your Website URL]`);
        window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
    };
    popup.appendChild(shareButton);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'close-button';
    closeButton.onclick = function() {
        document.body.removeChild(popup);
    };
    popup.appendChild(closeButton);

    document.body.appendChild(popup);
}

// Add this function to end the recording
function endRecording() {
    isRecording = false;
    startButton.textContent = "Begin Test";
    document.getElementById("status").textContent = "Test completed";
    document.getElementById("countdown").textContent = "";
    
    // Calculate and display the result
    var averagePitch = pitchSamples.reduce((a, b) => a + b, 0) / pitchSamples.length;
    var result = getPitchTier(averagePitch);
    
    // Show the result pop-up
    showResultPopup(result, averagePitch);
    
    // Update the existing result display
    document.getElementById("deepnessResult").innerText = "Result: " + result;
    document.getElementById("medianFrequency").innerText = Math.round(averagePitch) + " Hz";
    
    // Clear the volume bars when recording stops
    clearVolumeBars();
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

		//Setting up the canvas
		CANVAS = document.getElementById("waveform");
		if (CANVAS) {
			waveCanvas = CANVAS.getContext("2d");
			console.log("Canvas set up successfully"); // Add this line
		} else {
			console.error("Canvas element not found"); // Add this line
		}

			// Remove this line as we'll call it only when recording starts
			// instantiatePids(100, 1);

		analyser.smoothingTimeConstant = 0.8;
		analyser.fftSize = 2048;

		microphone.connect(analyser);
		analyser.connect(scriptProcessor);
		scriptProcessor.connect(audioContext.destination);

		// Add this event listener after the getUserMedia promise chain
		startButton.addEventListener("click", toggleRecording);

		scriptProcessor.onaudioprocess = function () {
			if (isRecording) {
				array = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(array);

				//Updating pitch and volume according to the input sound
				colorPids(array);
				updatePitch();
				DrawWaveform();

				// Check if the test duration has elapsed
				if (Date.now() - testStartTime >= testDuration * 1000) {
					endRecording();
				}
			}
		};
	})
	//Catching errors
	.catch(function (err) {
		console.error(err);
	});

// Add this function to clear volume bars
function clearVolumeBars() {
	var volumeBars = document.getElementsByClassName("volumeBar")[0];
	if (volumeBars) {
		volumeBars.innerHTML = '';
	}
}

//Function for setting up the volume bar
function instantiatePids(amount, gap) {
	var volumeBars = document.getElementsByClassName("volumeBar");
	if (volumeBars.length === 0) {
		console.error("Volume bar container not found");
		return;
	}
	var container = volumeBars[0];
	container.innerHTML = ''; // Clear existing pids

	var containerWidth = container.offsetWidth;
	var pidWidth = (containerWidth - 0.5) / amount - gap;

	for (let i = 0; i < amount; i++) {
		var pid = document.createElement("div");
		pid.classList.add('pid');
		pid.style.width = pidWidth + "px";
		pid.style.marginRight = gap + "px";
		container.appendChild(pid);
	}
}

function CalculateVol(array){
	const arraySum = array.reduce((a, value) => a + value, 0);
	const vol = arraySum / array.length;
	return vol;
}

//Function for updating volume bar
function colorPids(array) {
	const vol = CalculateVol(array);

	const allPids = [...document.querySelectorAll('.pid')];
	const numberOfPidsToColor = Math.round(vol / (100 / allPids.length));
	const pidsToColor = allPids.slice(0, numberOfPidsToColor);

	for (const pid of allPids) {
		pid.style.backgroundColor = "#19093c";
	}

	var pidID = 0;
	for (const pid of pidsToColor) {
		if(pidID<33)
			pid.style.backgroundColor = "#7279d4";
		else if (pidID < 67)
			pid.style.backgroundColor = "#9972d4";
		else 
			pid.style.backgroundColor = "#d472d2";
		pidID++;
	}
}

//Function for converting pitch to note
var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch(frequency) {
	var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
	return Math.round(noteNum) + 69;
}

//Pitch detection - Autocorrelation method

//Setting up the audio buffer
var buflen = 2048;
var buf = new Float32Array(buflen);

// Implementing the ACF2+ algorithm
function autoCorrelate(buf, sampleRate) {
	var size = buf.length;
	var rms = 0;

	for (var i = 0; i < size; i++) {
		var val = buf[i];
		rms += val * val;
	}

	//Calculating Root Mean Square
	rms = Math.sqrt(rms / size);
	if (rms < 0.01) // not enough signal
		return -1;

	//Removing all the frequencies lower the threshold
	var cutFrom = 0, cutTo = size - 1, threshold = 0.2;
	for (var i = 0; i < size / 2; i++)
		if (Math.abs(buf[i]) < threshold) { cutFrom = i; break; }
	for (var i = 1; i < size / 2; i++)
		if (Math.abs(buf[size - i]) < threshold) { cutTo = size - i; break; }

	buf = buf.slice(cutFrom, cutTo);
	size = buf.length;

	//Autocorrelating the frequencies
	var c = new Array(size).fill(0);
	for (var i = 0; i < size; i++)
		for (var j = 0; j < size - i; j++)
			c[i] = c[i] + buf[j] * buf[j + i];

	var d = 0;
	while (c[d] > c[d + 1])
		d++;

	var maxVal = -1, maxPos = -1;
	for (var i = d; i < size; i++) {
		if (c[i] > maxVal) {
			maxVal = c[i];
			maxPos = i;
		}
	}
	var T0 = maxPos;

	var x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
	a = (x1 + x3 - 2 * x2) / 2;
	b = (x3 - x1) / 2;
	if (a) T0 = T0 - b / (2 * a);

	return sampleRate / T0;
}

//Function for updating pitch 
function updatePitch(time) {
	var cycles = new Array;

	analyser.getFloatTimeDomainData(buf);
	var ac = autoCorrelate(buf, audioContext.sampleRate);

	// Calling the draw function every time updatePitch is called
	DrawWaveform();

	if (ac != -1) {
		pitch = ac;
		pitchSamples.push(pitch);
		pitchTxt.innerText = Math.round(pitch);

		var note = noteFromPitch(pitch);
		noteTxt.innerHTML = noteStrings[note % 12];

		document.getElementById("frequencyDisplay").innerText = "Current frequency: " + Math.round(pitch) + " Hz";
	}
}

function print(){
	console.log(array);
}

//Function for matching input pitch to a target pitch - currently not in use
function matchPitch(pitch, target, errorMargin, matchPid) {
	if (pitch - errorMargin < target && target < pitch + errorMargin) {
		matchPid.style.backgroundColor = "#69ce2b";
		return true;
	}

	else {
		matchPid.style.backgroundColor = "red";
		return false;
	}
}

//Function for matching input pitch to a target note - currently not in use
function matchNote(pitch, target, matchPid) {
	var note = noteFromPitch(pitch);
	if (noteStrings[note % 12] == target) {
		matchPid.style.backgroundColor = "#69ce2b";
		return true;
	}

	else {
		matchPid.style.backgroundColor = "red";
		return false;
	}
}

//Function responsible for drawing the waveform
function DrawWaveform(type, lineWidth, strokeStyle, fillStyle, strokeColor, strokeOpacity) {
	if (!CANVAS) {
		console.error("Canvas not available");
		return;
	}

	var width = CANVAS.width;
	var height = CANVAS.height;

	waveCanvas.clearRect(0, 0, width, height);
	waveCanvas.lineWidth = lineWidth;
	waveCanvas.strokeStyle = strokeStyle;
	waveCanvas.fillStyle = fillStyle;
	waveCanvas.strokeStyle = strokeColor;
	waveCanvas.globalAlpha = strokeOpacity;

	waveCanvas.beginPath();

	switch (type) {
		case "wave":
			for (var i = 0; i < width; i++) {
				var v = buf[Math.floor(i * buf.length / width)];
				var y = (0.5 + v * 0.5) * height;
				if (i == 0) {
					waveCanvas.moveTo(i, y);
				} else {
					waveCanvas.lineTo(i, y);
				}
			}
			break;
		// ... (other cases)
	}

	waveCanvas.stroke();
	console.log("Waveform drawn");
}

function getPitchTier(frequency) {
	if (frequency < 100) {
		return "Chad";
	} else if (frequency < 120) {
		return "Sigma";
	} else if (frequency < 140) {
		return "Normal";
	} else if (frequency < 160) {
		return "Gay";
	} else {
		return "Very Gay";
	}
}
