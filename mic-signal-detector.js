/**
 * Mic Signal Detector - Standalone utility for detecting microphone on/off state
 * Focuses solely on tracing whether microphone has signal or not with debouncing
 */
class MicSignalDetector {
  constructor(analyser, options = {}) {
    this.analyser = analyser;
    this.audioLevel = 0;
    this.lastHasSignal = false;
    this.signalOffTimestamp = null;
    this.signalOnTimestamp = null;

    // Configurable options
    this.SIGNAL_THRESHOLD = options.signalThreshold || 25; // Higher threshold (less sensitive)
    this.SIGNAL_OFF_DEBOUNCE_MS = options.debounceMs || 1000; // 2 seconds debounce
    this.SIGNAL_ON_CONFIRM_MS = options.confirmMs || 300; // 300ms to confirm signal is real

    // Callback for signal state changes
    this.onSignalStateChanged = null;
    this.onAudioLevelChanged = null;

    this.isMonitoring = false;
    this.animationId = null;
  }

  /**
   * Start monitoring microphone signal state
   */
  startMonitoring() {
    if (this.isMonitoring) return;
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
    // Noise is usually spread across all frequencies
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

    // Mid-frequency ratio: speech typically has 40-60% energy in mid-frequencies
    const midFreqRatio = totalSum > 0 ? midFreqSum / totalSum : 0;

    // Notify audio level change
    this.onAudioLevelChanged?.(this.audioLevel);

    // Signal detected if ALL conditions met:
    // 1. Audio level above threshold (25%)
    // 2. Mid-frequency ratio suggests speech (not just noise)
    let hasSignal = this.audioLevel > this.SIGNAL_THRESHOLD && midFreqRatio > 0.3;

    // If potential signal detected - wait 300ms to confirm it's real (not a click)
    if (hasSignal && !this.lastHasSignal) {
      if (this.signalOnTimestamp === null) {
        this.signalOnTimestamp = Date.now();
      }

      const timeSinceOnStart = Date.now() - this.signalOnTimestamp;
      // Only trigger ON after 300ms of continuous signal
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
    // If signal lost - require 2 seconds confirmation before reporting as off
    else if (!hasSignal && this.lastHasSignal) {
      if (this.signalOffTimestamp === null) {
        this.signalOffTimestamp = Date.now();
      }

      // Only confirm off after 2 seconds of no signal
      const timeSinceSignalLost = Date.now() - this.signalOffTimestamp;
      if (timeSinceSignalLost >= this.SIGNAL_OFF_DEBOUNCE_MS) {
        this.lastHasSignal = false;
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
   * Set signal threshold (audio level cutoff)
   */
  setSignalThreshold(threshold) {
    this.SIGNAL_THRESHOLD = threshold;
  }

  /**
   * Set debounce time for signal off detection (in milliseconds)
   */
  setDebounceMs(ms) {
    this.SIGNAL_OFF_DEBOUNCE_MS = ms;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = MicSignalDetector;
}
