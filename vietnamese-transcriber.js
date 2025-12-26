/**
 * Vietnamese Transcription Module
 * Provides simple functions to convert Vietnamese audio to text
 */

class VietnameseTranscriber {
  constructor() {
    this.isTranscribing = false;
    this.currentCallback = null;
    this.recognition = this._initializeRecognition();
    this.onStatusChanged = null;
    this.permissionGranted = false; // Track if permission was requested
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
   * Initialize Speech Recognition for Vietnamese
   */
  _initializeRecognition() {
    try {
      if (!window.SpeechRecognition) {
        console.warn("Speech Recognition not supported");
        return null;
      }

      const recognition = new window.SpeechRecognition();
      recognition.lang = "vi-VN"; // Vietnamese
      recognition.continuous = false;
      recognition.interimResults = false;

      let currentTranscript = "";

      recognition.onstart = () => {
        this.isTranscribing = true;
        this.permissionGranted = true; // Permission granted once started
        this.onStatusChanged?.("🎤 Listening...", "active");
        console.log("🎤 Vietnamese transcription started");
        currentTranscript = "";
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
      };

      recognition.onend = () => {
        this.isTranscribing = false;
        console.log("✓ Vietnamese text:", currentTranscript);
        this.onStatusChanged?.("Transcription complete", "success");

        if (this.currentCallback) {
          this.currentCallback(currentTranscript);
          this.currentCallback = null;
        }
      };

      recognition.onerror = (event) => {
        this.isTranscribing = false;
        console.error("❌ Transcription error:", event.error);
        this.onStatusChanged?.("Error: " + event.error, "error");
      };

      return recognition;
    } catch (error) {
      console.error("❌ Error initializing transcription:", error);
      return null;
    }
  }

  /**
   * Transcribe from microphone with configurable language
   * @param {Function} onTranscribed - Callback with transcribed text
   * @param {string} language - Language code (default: vi-VN)
   */
  fromMicrophone(onTranscribed, language = "vi-VN") {
    try {
      if (!this.recognition) {
        throw new Error("Speech Recognition not supported");
      }

      if (this.isTranscribing) {
        console.warn("⚠️ Already transcribing");
        return;
      }

      // Set recognition language dynamically
      this.recognition.lang = language;

      this.currentCallback = onTranscribed;
      this.recognition.start();
      this.onStatusChanged?.("Recording audio...", "active");
    } catch (error) {
      console.error("❌ Error:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Transcribe Vietnamese from audio file using Webkit
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {Function} onTranscribed - Callback with Vietnamese text
   */
  async fromFile(audioBlob, onTranscribed) {
    try {
      if (!this.recognition) {
        throw new Error("Speech Recognition not supported");
      }

      this.onStatusChanged?.("Transcribing Vietnamese audio...", "active");

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      this.currentCallback = onTranscribed;

      // Play audio while listening
      audio.play().catch(() => {
        console.log("Cannot auto-play audio");
      });

      this.recognition.start();

      // Clean up after transcription
      const cleanup = setInterval(() => {
        if (!this.isTranscribing) {
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          clearInterval(cleanup);
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Smart transcription with API fallback chain
   * Priority: Whisper > Google Cloud > Webkit > Vosk > Manual
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {string} whisperApiKey - OpenAI API key (optional)
   * @param {string} googleApiKey - Google Cloud API key (optional)
   * @param {Function} onTranscribed - Callback with Vietnamese text
   */
  async smart(audioBlob, whisperApiKey, googleApiKey, onTranscribed) {
    try {
      if (whisperApiKey) {
        console.log("📍 Using OpenAI Whisper for transcription");
        await this._transcribeWithWhisper(audioBlob, whisperApiKey, onTranscribed);
      } else if (googleApiKey) {
        console.log("📍 Using Google Cloud Speech-to-Text");
        await this._transcribeWithGoogle(audioBlob, googleApiKey, onTranscribed);
      } else if (window.SpeechRecognition) {
        console.log("📍 Using Web Speech API");
        this.fromFile(audioBlob, onTranscribed);
      } else if (window.Vosk) {
        console.log("📍 Using Vosk (offline)");
        await this._transcribeWithVosk(audioBlob, onTranscribed);
      } else {
        console.log("📍 Manual input fallback");
        this._manualInput(onTranscribed);
      }
    } catch (error) {
      console.error("❌ Error:", error);
      this._manualInput(onTranscribed);
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  async _transcribeWithWhisper(audioBlob, apiKey, onTranscribed) {
    try {
      this.onStatusChanged?.("Transcribing with Whisper...", "active");

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "vi");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.text) {
        console.log("✓ Whisper result:", data.text);
        this.onStatusChanged?.("Transcription complete", "success");
        onTranscribed?.(data.text);
      } else {
        throw new Error(data.error?.message || "Transcription failed");
      }
    } catch (error) {
      console.error("❌ Whisper error:", error);
      this.onStatusChanged?.("Whisper failed, trying next method...", "active");
    }
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text API
   */
  async _transcribeWithGoogle(audioBlob, apiKey, onTranscribed) {
    try {
      this.onStatusChanged?.("Transcribing with Google Cloud...", "active");

      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result.split(",")[1];

        const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: {
              encoding: "WEBM_OPUS",
              languageCode: "vi-VN",
              model: "default",
              useEnhanced: true,
            },
            audio: { content: base64Audio },
          }),
        });

        const data = await response.json();

        if (data.results?.length > 0) {
          const transcript = data.results.map((result) => result.alternatives[0].transcript).join(" ");
          console.log("✓ Google Cloud result:", transcript);
          this.onStatusChanged?.("Transcription complete", "success");
          onTranscribed?.(transcript);
        } else {
          throw new Error("No transcription results");
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("❌ Google Cloud error:", error);
      this.onStatusChanged?.("Google Cloud failed, trying next method...", "active");
    }
  }

  /**
   * Transcribe using Vosk (offline)
   */
  async _transcribeWithVosk(audioBlob, onTranscribed) {
    try {
      this.onStatusChanged?.("Transcribing with Vosk (offline)...", "active");

      if (!window.Vosk) {
        throw new Error("Vosk not loaded");
      }

      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const recognizer = new window.Vosk.Recognizer({
        model: window.vosk_model_vi || window.vosk_model,
        samplerate: audioBuffer.sampleRate,
      });

      const channelData = audioBuffer.getChannelData(0);
      recognizer.acceptWaveform(channelData);
      const resultStr = recognizer.result();
      const result = JSON.parse(resultStr);

      let transcript = "";
      if (result.result && Array.isArray(result.result)) {
        transcript = result.result.map((r) => (r.conf > 0.5 ? r.result : "")).join("");
      } else if (result.partial) {
        transcript = result.partial;
      }

      if (transcript) {
        console.log("✓ Vosk result:", transcript);
        this.onStatusChanged?.("Transcription complete", "success");
        onTranscribed?.(transcript);
      } else {
        throw new Error("No transcription from Vosk");
      }
    } catch (error) {
      console.error("❌ Vosk error:", error);
      this.onStatusChanged?.("Vosk failed, trying manual input...", "active");
    }
  }

  /**
   * Manual input fallback
   */
  _manualInput(onTranscribed) {
    const vietnameseText = prompt("Please enter the Vietnamese text:") || "";
    if (vietnameseText) {
      console.log("✓ Manual input:", vietnameseText);
      this.onStatusChanged?.("Text ready", "success");
      onTranscribed?.(vietnameseText);
    }
  }

  /**
   * Stop transcription
   */
  stop() {
    if (this.recognition && this.isTranscribing) {
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
window.VietnameseTranscriber = VietnameseTranscriber;
