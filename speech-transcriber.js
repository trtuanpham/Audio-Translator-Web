/**
 * Speech Transcription Module
 * Provides functions to convert speech audio to text in multiple languages
 */

class SpeechTranscriber {
  constructor() {
    this.currentCallback = null;
    this.currentResolve = null;
    this.currentReject = null;
    this.recognition = this._initializeRecognition();
    this.isTranscribing = false;
    this.onStatusChanged = null;
    this.permissionGranted = false; // Track if permission was requested
    this.fileCleanupInterval = null; // Track cleanup interval for fromFile()
  }

  /**
   * Request microphone permission once at app startup
   * This prevents repeated permission requests during normal use
   */
  async requestPermissionOnce() {
    try {
      if (!this.recognition || this.permissionGranted) {
        return true; // Already requested or not supported
      }

      console.log("📍 Requesting microphone permission...");
      this.onStatusChanged?.("Requesting microphone permission...", "active");

      // Start and immediately stop to trigger permission request
      this.recognition.start();

      // Wait for recognition to initialize
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.recognition.stop();
          this.permissionGranted = true;
          console.log("✓ Microphone permission granted");
          this.onStatusChanged?.("Microphone ready", "success");
          resolve(true);
        }, 500);
      });
    } catch (error) {
      console.warn("⚠️ Permission request error:", error);
      return false;
    }
  }

  /**
   * Initialize Speech Recognition for multiple languages
   */
  _initializeRecognition() {
    try {
      if (!window.SpeechRecognition) {
        console.warn("Speech Recognition not supported");
        return null;
      }

      console.log("📍 Initializing Speech Recognition");

      const recognition = new window.SpeechRecognition();
      recognition.lang = "vi-VN"; // Vietnamese
      recognition.continuous = false;
      recognition.interimResults = false;

      let currentTranscript = "";

      recognition.onstart = () => {
        this.permissionGranted = true; // Permission granted once started
        if (this.isTranscribing) {
          this.onStatusChanged?.("Listening...", "active");
        }
        console.log("🎤 Speech transcription started");
        currentTranscript = "";
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
      };

      recognition.onend = () => {
        console.log("🎤 Speech transcription ended");
        if (!this.isTranscribing) {
          return;
        }

        if (currentTranscript.trim() === "") {
          return;
        }

        console.log("✓ Transcribed text:", currentTranscript);
        this.onStatusChanged?.("Transcription complete", "success");

        // Call callback if exists (for backward compatibility)
        if (this.currentCallback) {
          this.currentCallback(currentTranscript);
          this.currentCallback = null;
        }

        // Resolve Promise if exists
        if (this.currentResolve) {
          this.currentResolve(currentTranscript);
          this.currentResolve = null;
          this.currentReject = null;
        }

        // Reset for next use
        currentTranscript = "";
        this.isTranscribing = false;
      };

      recognition.onerror = (event) => {
        this.isTranscribing = false;
        console.error("❌ Transcription error:", event.error);
        this.onStatusChanged?.("Error: " + event.error, "error");

        // Reject Promise if exists
        if (this.currentReject) {
          this.currentReject(new Error("Transcription error: " + event.error));
          this.currentResolve = null;
          this.currentReject = null;
        }
      };

      return recognition;
    } catch (error) {
      console.error("❌ Error initializing transcription:", error);
      return null;
    }
  }

  /**
   * Transcribe from microphone with configurable language - returns a Promise
   * @param {string} language - Language code (default: en-US)
   * @returns {Promise<string>} - Promise that resolves with transcribed text
   */
  fromMicrophone(language = "en-US") {
    return new Promise((resolve, reject) => {
      try {
        if (!this.recognition) {
          throw new Error("Speech Recognition not supported");
        }

        // Set recognition language dynamically
        this.recognition.lang = language;

        // Store resolve/reject for this transcription session
        this.currentResolve = resolve;
        this.currentReject = reject;
        this.currentCallback = null; // Clear any old callback
        this.isTranscribing = true;
        // reset current transcript
        if (this.recognition) {
          this.recognition.abort();
        }
        this.recognition.start();
        this.onStatusChanged?.("Recording audio...", "active");
      } catch (error) {
        this.isTranscribing = false;
        console.error("❌ Error:", error);
        this.onStatusChanged?.("Error: " + error.message, "error");
        reject(error);
      }
    });
  }

  /**
   * Manual input fallback
   */
  _manualInput(onTranscribed) {
    const inputText = prompt("Please enter the text:") || "";
    if (inputText) {
      console.log("✓ Manual input:", inputText);
      this.onStatusChanged?.("Text ready", "success");
      onTranscribed?.(inputText);
    }
  }

  /**
   * Stop transcription
   */
  stop() {
    if (this.recognition) {
      this.isTranscribing = false;
      this.recognition.stop();
      this.onStatusChanged?.("Transcription stopped", "active");
    }
  }

  /**
   * Abort transcription immediately
   */
  abort() {
    if (this.recognition) {
      this.recognition.abort();
      this.isTranscribing = false;
    }
  }
}

// Export
window.SpeechTranscriber = SpeechTranscriber;
