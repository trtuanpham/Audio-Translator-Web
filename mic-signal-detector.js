/**
 * Mic Signal Detector - Standalone utility for detecting microphone on/off state
 * Includes built-in audio initialization and frequency analysis
 */
class MicSignalDetector {
  constructor(options = {}) {
    // Audio setup
    this.audioStream = null;
    this.audioContext = null;
    this.analyser = null;

    // Signal detection
    this.audioLevel = 0;
    this.lastHasSignal = false;
    this.signalOffTimestamp = null;
    this.signalOnTimestamp = null;

    // Configurable options
    this.SIGNAL_THRESHOLD = options.signalThreshold || 15;
    this.SIGNAL_OFF_DEBOUNCE_MS = options.debounceMs || 2000;
    this.SIGNAL_ON_CONFIRM_MS = options.confirmMs || 0;

    // Callbacks
    this.onSignalStateChanged = null;
    this.onAudioLevelChanged = null;
    this.onStatusChanged = null;

    this.isMonitoring = false;
    this.animationId = null;
  }

  /**
   * Initialize audio and setup analyser
   */
  async initialize() {
    try {
      console.log("📍 Initializing audio for signal detection...");

      // Request microphone permission
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("✓ Microphone permission granted");
      this.onStatusChanged?.("Microphone ready", "success");

      // Setup audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioSource = this.audioContext.createMediaStreamSource(this.audioStream);

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      audioSource.connect(this.analyser);

      console.log("✓ Audio analyser initialized");
      return true;
    } catch (error) {
      console.error("❌ Audio initialization error:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
      return false;
    }
  }

  /**
   * Start monitoring microphone signal state
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    if (!this.analyser) {
      console.error("❌ Analyser not initialized. Call initialize() first.");
      return;
    }
    this.isMonitoring = true;
    this._monitor();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Stop audio and cleanup
   */
  stop() {
    this.stopMonitoring();
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Internal monitoring loop
   */
  _monitor() {
    if (!this.isMonitoring || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) level (0-100)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    this.audioLevel = Math.round((rms / 255) * 100);

    // Analyze frequency distribution - speech has energy in mid-frequencies
    const midFreqStart = Math.floor(bufferLength * 0.1);
    const midFreqEnd = Math.floor(bufferLength * 0.4);

    let midFreqSum = 0;
    let totalSum = 0;
    for (let i = 0; i < bufferLength; i++) {
      totalSum += dataArray[i];
      if (i >= midFreqStart && i < midFreqEnd) {
        midFreqSum += dataArray[i];
      }
    }

    const midFreqRatio = totalSum > 0 ? midFreqSum / totalSum : 0;

    // Notify audio level change
    this.onAudioLevelChanged?.(this.audioLevel);

    // Signal detected if: audio level above threshold AND mid-frequency suggests speech
    let hasSignal = this.audioLevel > this.SIGNAL_THRESHOLD && midFreqRatio > 0.3;

    // If potential signal detected - trigger ON immediately
    if (hasSignal && !this.lastHasSignal) {
      if (this.signalOnTimestamp === null) {
        this.signalOnTimestamp = Date.now();
      }

      const timeSinceOnStart = Date.now() - this.signalOnTimestamp;
      if (timeSinceOnStart >= this.SIGNAL_ON_CONFIRM_MS) {
        this.lastHasSignal = true;
        this.signalOffTimestamp = null;
        this.signalOnTimestamp = null;
        this.onSignalStateChanged?.({
          hasSignal: true,
          audioLevel: this.audioLevel,
          timestamp: Date.now(),
        });
      }
    }
    // If signal lost - require debounce time before confirming off
    else if (!hasSignal && this.lastHasSignal) {
      if (this.signalOffTimestamp === null) {
        this.signalOffTimestamp = Date.now();
      }

      const timeSinceSignalLost = Date.now() - this.signalOffTimestamp;
      if (timeSinceSignalLost >= this.SIGNAL_OFF_DEBOUNCE_MS) {
        this.lastHasSignal = false;
        this.signalOffTimestamp = null;
        this.onSignalStateChanged?.({
          hasSignal: false,
          audioLevel: this.audioLevel,
          timestamp: Date.now(),
        });
      }
    }
    // If signal false alarm detected - reset
    else if (!hasSignal && this.signalOnTimestamp !== null && !this.lastHasSignal) {
      this.signalOnTimestamp = null;
    }

    this.animationId = requestAnimationFrame(() => this._monitor());
  }

  /**
   * Get current signal state
   */
  getSignalState() {
    return {
      hasSignal: this.lastHasSignal,
      audioLevel: this.audioLevel,
      signalOffTimestamp: this.signalOffTimestamp,
    };
  }

  /**
   * Reset signal state
   */
  reset() {
    this.audioLevel = 0;
    this.lastHasSignal = false;
    this.signalOffTimestamp = null;
  }

  /**
   * Set signal threshold
   */
  setSignalThreshold(threshold) {
    this.SIGNAL_THRESHOLD = threshold;
  }

  /**
   * Set debounce time for signal off detection
   */
  setDebounceMs(ms) {
    this.SIGNAL_OFF_DEBOUNCE_MS = ms;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = MicSignalDetector;
}
