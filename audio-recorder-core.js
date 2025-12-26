// Pure Audio Recorder Class - No DOM manipulation
class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Single shared stream for both visualization and recording
    this.audioStream = null; // One stream for both visualizer and recorder

    this.selectedDeviceId = null;
    this.isRecording = false;
    this.recordingStartTime = null;
    this.audioContext = null;
    this.analyser = null;
    this.animationId = null;
    this.audioLevel = 0; // Current audio signal level (0-100)
    this.isCapturing = false; // Track if capturing
    this.lastHasSignal = false; // Track last signal state
    this.signalOffTimestamp = null; // Timestamp when signal went off
    this.SIGNAL_OFF_DEBOUNCE_MS = 2000; // Wait 2 seconds before confirming signal is off

    // Callbacks
    this.onDevicesLoaded = null;
    this.onStatusChanged = null;
    this.onRecordingStarted = null;
    this.onRecordingEnded = null;
    this.onTimerTick = null;
    this.onVisualizerData = null;
    this.onMicStatusChanged = null;
    this.onAudioLevelChanged = null;
  }

  async initializeAudio() {
    try {
      console.log("🔐 Requesting microphone permission and loading devices...");

      // First enumerate (without permission - will show no labels)
      let devices = await navigator.mediaDevices.enumerateDevices();
      let audioInputs = devices.filter((device) => device.kind === "audioinput");
      console.log("📱 Devices before permission:", audioInputs.length);

      // Request permission with audio constraints
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("✓ Permission granted");
      this.onStatusChanged?.("Microphone permission granted", "success");

      // Small delay to ensure stream is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Enumerate devices while stream is active (NOW will have labels)
      console.log("📱 Enumerating devices with permission...");
      devices = await navigator.mediaDevices.enumerateDevices();
      audioInputs = devices.filter((device) => device.kind === "audioinput");

      console.log("📋 Devices found:", audioInputs.length);
      console.log(
        "Device details:",
        audioInputs.map((d) => ({ label: d.label, deviceId: d.deviceId }))
      );

      // Fallback: If labels are empty, reconstruct from stream tracks
      if (audioInputs.length === 0 || audioInputs[0].label === "") {
        console.warn("⚠️ Empty labels detected, reconstructing from stream...");
        const streamTracks = this.audioStream.getAudioTracks();
        console.log("Stream tracks:", streamTracks);
        audioInputs = streamTracks.map((track, index) => ({
          deviceId: track.getSettings().deviceId || `device_${index}`,
          kind: "audioinput",
          label: track.label || `Microphone ${index + 1}`,
          groupId: `group_${index}`,
        }));
        console.log("✓ Reconstructed devices:", audioInputs);
      }

      if (audioInputs.length === 0) {
        this.onStatusChanged?.("No microphones found", "error");
        this.audioStream.getTracks().forEach((track) => track.stop());
        this.audioStream = null;
        return null;
      }

      // Set first device as default
      this.selectedDeviceId = audioInputs[0].deviceId;
      console.log("✓ Selected device:", audioInputs[0].label);

      // Set capturing flag
      this.isCapturing = true;

      // Setup audio context for visualization and analysis
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioSource = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      audioSource.connect(this.analyser);

      // Trigger callback
      this.onDevicesLoaded?.(audioInputs);

      // Return devices and confirm initialization
      return { audioInputs };
    } catch (error) {
      console.error("❌ Error:", error.name, error.message);
      this.onStatusChanged?.("Error: " + error.message, "error");
      return null;
    }
  }

  setSelectedDevice(deviceId) {
    this.selectedDeviceId = deviceId;
  }

  stopCapturingAudio() {
    // Disable and stop shared audio stream
    if (this.audioStream) {
      // Disable tracks first
      this.audioStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      // Then stop tracks only if not recording
      if (!this.isRecording) {
        this.audioStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.audioStream = null;
      }
    }
    this.isCapturing = false;
    this.audioLevel = 0;
    this.onMicStatusChanged?.({
      isCapturing: false,
      isEnabled: false,
      readyState: "ended",
      hasSignal: false,
    });
    this.stopVisualizer();
  }

  async startCapturingAudio() {
    try {
      if (!this.selectedDeviceId) {
        this.onStatusChanged?.("Please select a microphone", "error");
        return;
      }

      // If stream exists and same device, reuse it
      if (this.audioStream) {
        const currentTrack = this.audioStream.getAudioTracks()[0];
        const currentDeviceId = currentTrack?.getSettings().deviceId;

        if (currentDeviceId === this.selectedDeviceId) {
          // Same device, just ensure it's enabled and connected
          this.audioStream.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
          this.isCapturing = true;
          this.onStatusChanged?.("Microphone ready", "active");
          this.startVisualizer();
          this.monitorAudioLevel();
          return;
        }

        // Different device, close old stream
        this.audioStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.audioStream = null;
      }

      // Create new stream for the selected device (permission already granted)
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: this.selectedDeviceId } },
      });

      // Check mic hardware status
      const audioTrack = this.audioStream.getAudioTracks()[0];
      if (!audioTrack) {
        this.onStatusChanged?.("Mic hardware not found", "error");
        return;
      }

      // Setup audio context and analyzer
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioSource = this.audioContext.createMediaStreamSource(this.audioStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      audioSource.connect(this.analyser);

      this.isCapturing = true;
      this.onMicStatusChanged?.({
        isCapturing: true,
        isEnabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        hasSignal: false,
      });
      this.onStatusChanged?.("Microphone ready", "active");
      this.startVisualizer();
      this.monitorAudioLevel();
    } catch (error) {
      console.error("Error capturing audio:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  async startRecording() {
    try {
      if (!this.selectedDeviceId) {
        this.onStatusChanged?.("Please select a microphone", "error");
        return;
      }

      // Stream should already exist from initializeAudio or startCapturingAudio
      if (!this.audioStream) {
        this.onStatusChanged?.("Microphone not initialized", "error");
        return;
      }

      // Find supported MIME type
      let mimeType = "";
      const supportedTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      console.log("Using MIME type:", mimeType || "default");

      // Create MediaRecorder from shared audio stream
      const recorderOptions = mimeType ? { mimeType: mimeType } : {};
      this.mediaRecorder = new MediaRecorder(this.audioStream, recorderOptions);
      this.audioChunks = [];

      // Handle data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          // console.log("Data chunk received:", event.data.size, "bytes");
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        const mimeTypeUsed = this.mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(this.audioChunks, { type: mimeTypeUsed });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("Recording complete. Total size:", audioBlob.size, "bytes");
        this.onRecordingEnded?.(audioUrl, audioBlob);
        this.onStatusChanged?.("Recording saved", "active");
      };

      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        this.onStatusChanged?.("Recording error: " + event.error, "error");
      };

      // Start recording
      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      this.onRecordingStarted?.();
      this.onStatusChanged?.("Recording in progress...", "active");
      this.startTimerTick();
    } catch (error) {
      console.error("Error starting recording:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;

      this.stopTimerTick();
      // Keep audio stream and visualizer running
      this.onStatusChanged?.("Recording stopped", "active");
    }
  }

  startVisualizer() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);
      this.onVisualizerData?.(new Uint8Array(dataArray));
    };

    draw();
  }

  stopVisualizer() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  startTimerTick() {
    const timerInterval = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(timerInterval);
        return;
      }
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      this.onTimerTick?.(timeString);
    }, 100);
  }

  stopTimerTick() {
    this.onTimerTick?.("");
  }

  toggleMic() {
    if (this.isCapturing) {
      this.stopCapturingAudio();
    } else {
      this.startCapturingAudio();
    }
  }

  monitorAudioLevel() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const monitor = () => {
      if (!this.isCapturing) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      this.audioLevel = Math.round((rms / 255) * 100);

      // Update audio level callback
      this.onAudioLevelChanged?.(this.audioLevel);

      // Determine hasSignal with debouncing for off state
      let hasSignal = this.audioLevel > 5;

      // If signal detected (on) - immediate response
      if (hasSignal && !this.lastHasSignal) {
        this.lastHasSignal = true;
        this.signalOffTimestamp = null;
      }
      // If signal lost (off) - require 2 seconds confirmation before reporting as off
      else if (!hasSignal && this.lastHasSignal) {
        if (this.signalOffTimestamp === null) {
          this.signalOffTimestamp = Date.now();
        }
        // Only confirm off after 2 seconds of no signal
        const timeSinceSignalLost = Date.now() - this.signalOffTimestamp;
        hasSignal = timeSinceSignalLost < this.SIGNAL_OFF_DEBOUNCE_MS;

        if (!hasSignal) {
          this.lastHasSignal = false;
        }
      }

      this.onMicStatusChanged?.({
        isCapturing: this.isCapturing,
        isEnabled: this.audioStream?.getAudioTracks()[0]?.enabled ?? false,
        readyState: this.audioStream?.getAudioTracks()[0]?.readyState ?? "ended",
        hasSignal: hasSignal,
        audioLevel: this.audioLevel,
      });

      requestAnimationFrame(monitor);
    };

    monitor();
  }
}
