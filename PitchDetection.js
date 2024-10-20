// PitchDetection.js

// Variables for recording and analysis
var audioContext;
var microphone;
var scriptProcessor;
var audioData = []; // Array to store audio data chunks
var isRecording = false;
var countdownTimer;
var countdownValue = 5; // 5 seconds countdown

// Set up event listeners for the buttons
document.getElementById("startButton").addEventListener("click", startRecording);
// Removed the stop button listener since we auto-stop after 5 seconds

// Get access to the microphone and set up the audio nodes
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(function(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    microphone = audioContext.createMediaStreamSource(stream);

    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    microphone.connect(scriptProcessor);

    // To ensure the onaudioprocess event fires, we need to connect the processor node to the destination
    // We can use a GainNode to silence the output to avoid feedback
    var gainNode = audioContext.createGain();
    gainNode.gain.value = 0; // Set volume to zero to prevent feedback
    scriptProcessor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    scriptProcessor.onaudioprocess = function(e) {
      if (!isRecording) return;
      // Get audio data and store it
      var inputData = e.inputBuffer.getChannelData(0);
      var bufferData = new Float32Array(inputData);
      audioData.push(bufferData);
    };
  })
  .catch(function(err) {
    console.error('The following error occurred: ' + err);
    alert('Error accessing the microphone: ' + err.message);
  });

// Start recording
function startRecording() {
  if (isRecording) return; // Prevent multiple recordings at the same time
  audioData = []; // Reset audio data array
  isRecording = true;
  countdownValue = 5; // Reset countdown
  document.getElementById("countdown").innerText = "Recording starts in 5 seconds...";
  document.getElementById("startButton").disabled = true; // Disable start button

  // Visibly show the user when the recording starts
  document.getElementById("status").innerText = "Recording...";
  document.getElementById("status").style.color = "red";

  // Start the countdown
  countdownTimer = setInterval(function() {
    if (countdownValue > 0) {
      document.getElementById("countdown").innerText = "Recording ends in " + countdownValue + " seconds...";
      countdownValue--;
    } else {
      stopRecording();
      clearInterval(countdownTimer);
    }
  }, 1000);

  console.log("Recording started");
}

// Stop recording
function stopRecording() {
  isRecording = false;
  console.log("Recording stopped");

  // Reset UI elements
  document.getElementById("status").innerText = "Recording stopped.";
  document.getElementById("status").style.color = "black";
  document.getElementById("countdown").innerText = "";
  document.getElementById("startButton").disabled = false; // Enable start button

  analyzeRecording();
}

// Analyze the recorded audio to determine deepness of voice
function analyzeRecording() {
  if (audioData.length === 0) {
    showModal("No audio data recorded.");
    return;
  }
  // Concatenate all audio data into a single Float32Array
  var totalLength = audioData.reduce((sum, arr) => sum + arr.length, 0);
  var combinedData = new Float32Array(totalLength);
  var offset = 0;
  for (var i = 0; i < audioData.length; i++) {
    combinedData.set(audioData[i], offset);
    offset += audioData[i].length;
  }

  // Calculate deepness
  var deepness = calculateDeepness(combinedData, audioContext.sampleRate);
  if (deepness !== -1) {
    var voiceType = '';
    if (deepness < 165) {
      voiceType = 'Deep Voice';
    } else if (deepness >= 165 && deepness <= 255) {
      voiceType = 'Medium Voice';
    } else {
      voiceType = 'High Voice';
    }
    var resultText = "Average Pitch: " + deepness.toFixed(2) + " Hz (" + voiceType + ")";
    document.getElementById("deepnessResult").innerText = resultText;

    // Show a popup modal with the evaluation
    showModal("Voice Analysis Result:<br>" + resultText);
  } else {
    document.getElementById("deepnessResult").innerText = "Unable to detect pitch.";
    showModal("Unable to detect pitch.");
  }
}

// Function to calculate the average pitch (deepness)
function calculateDeepness(data, sampleRate) {
  var frameSize = 2048;
  var totalFrames = Math.floor(data.length / frameSize);
  var sumPitch = 0;
  var validFrames = 0;

  for (var i = 0; i < totalFrames; i++) {
    var buf = data.slice(i * frameSize, (i + 1) * frameSize);
    var pitch = autoCorrelate(buf, sampleRate);
    if (pitch !== -1 && pitch < 1000) { // Exclude unreasonable pitches
      sumPitch += pitch;
      validFrames++;
    }
  }

  if (validFrames > 0) {
    var avgPitch = sumPitch / validFrames;
    return avgPitch;
  } else {
    return -1;
  }
}

// Auto-correlation function for pitch detection
function autoCorrelate(buf, sampleRate) {
  var SIZE = buf.length;
  var rms = 0;

  for (var i = 0; i < SIZE; i++) {
    var val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) // not enough signal
    return -1;

  var r1 = 0, r2 = SIZE - 1, threshold = 0.2;

  // Trim the buffer to remove any samples that are below the threshold
  for (var i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (var i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  var c = new Array(SIZE).fill(0);
  for (var i = 0; i < SIZE; i++) {
    for (var j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  var d = 0;
  while (c[d] > c[d + 1])
    d++;
  var maxval = -1;
  var maxpos = -1;
  for (var i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  var T0 = maxpos;

  var x1 = c[T0 - 1];
  var x2 = c[T0];
  var x3 = c[T0 + 1];
  var a = (x1 + x3 - 2 * x2) / 2;
  var b = (x3 - x1) / 2;
  if (a)
    T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

// Function to show a modal popup with the evaluation
function showModal(message) {
  var modal = document.getElementById("resultModal");
  var modalContent = document.getElementById("modalContent");
  modalContent.innerHTML = message;
  modal.style.display = "block";
}

// Close the modal when the user clicks on <span> (x) or anywhere outside the modal
window.onclick = function(event) {
  var modal = document.getElementById("resultModal");
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

document.getElementById("closeModal").onclick = function() {
  document.getElementById("resultModal").style.display = "none";
};
