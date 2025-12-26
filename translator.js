// Translation Module - Handles Vietnamese → Chinese translation and speech synthesis

class TranslationService {
  constructor() {
    this.onStatusChanged = null;
    this.lastTranscribedText = null;
    this.recognition = this._initializeRecognition(); // Initialize once in constructor
    this.recognitionCallback = null;
    this._currentTranscript = "";
    this.isListening = false; // Track listening state to prevent multiple sessions
  }

  /**
   * Initialize Web Speech API recognition only once
   * @returns {SpeechRecognition} Recognition instance
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

      recognition.onstart = () => {
        this.isListening = true;
        this.onStatusChanged?.("🎤 Listening...", "active");
        console.log("🎤 Started transcription");
        this._currentTranscript = "";
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          this._currentTranscript += event.results[i][0].transcript;
          console.log("Transcript:", event.results[i][0].transcript);
        }
      };

      recognition.onend = () => {
        this.isListening = false;
        this.lastTranscribedText = this._currentTranscript;
        console.log("✓ Transcribed Vietnamese text:", this._currentTranscript);
        this.onStatusChanged?.("Transcription complete", "success");

        // Call the registered callback if any
        if (this.recognitionCallback) {
          this.recognitionCallback(this._currentTranscript);
          this.recognitionCallback = null; // Clear callback
        }
      };

      recognition.onerror = (event) => {
        console.error("❌ Recognition error:", event.error);
        this.onStatusChanged?.("Transcription error: " + event.error, "error");
      };

      return recognition;
    } catch (error) {
      console.error("❌ Error initializing speech recognition:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
      return null;
    }
  }

  /**
   * Transcribe Vietnamese audio using initialized recognition
   * If audioBlob provided, uses transcribeWithWebkit
   * Otherwise just starts recognition from mic
   * @param {Blob|Function} audioBlob - Audio file OR callback function
   * @param {Function} onTranscribed - Callback with transcribed text (optional if first param is callback)
   */
  async transcribeAudio(audioBlob, onTranscribed) {
    try {
      if (!this.recognition) {
        throw new Error("Speech Recognition not supported. Please use Chrome, Edge, or Safari.");
      }

      // Handle both signatures: transcribeAudio(callback) and transcribeAudio(blob, callback)
      if (typeof audioBlob === "function" && !onTranscribed) {
        // Case: transcribeAudio(callback) - just start recognition
        this.recognitionCallback = audioBlob;
        this._currentTranscript = "";
        this.onStatusChanged?.("Transcribing Vietnamese audio...", "active");
        this.recognition.start();
      } else if (audioBlob instanceof Blob && typeof onTranscribed === "function") {
        // Case: transcribeAudio(audioBlob, callback) - use webkit
        await this.transcribeWithWebkit(audioBlob, onTranscribed);
      } else {
        throw new Error("Invalid parameters for transcribeAudio");
      }
    } catch (error) {
      console.error("❌ Error transcribing audio:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Quick transcription using Vosk (offline) or fallback method
   * For best results with Vietnamese, use Google Cloud Speech-to-Text or similar
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {Function} onTranscribed - Callback with transcribed text
   */
  async transcribeAudioWithAPI(audioBlob, onTranscribed) {
    try {
      this.onStatusChanged?.("Sending audio for transcription...", "active");

      // Using Rev AI or similar free tier API
      // For now, provide instructions to user
      const vietnameseText =
        prompt(
          "⚠️ Browser speech recognition works best with live microphone.\n\nFor recorded audio transcription, options:\n1. Use Google Cloud Speech-to-Text\n2. Use OpenAI Whisper API\n3. Manually enter the Vietnamese text\n\nPlease enter the Vietnamese text:"
        ) || "";

      if (vietnameseText) {
        this.lastTranscribedText = vietnameseText;
        console.log("✓ Vietnamese text:", vietnameseText);
        this.onStatusChanged?.("Text ready for translation", "success");
        onTranscribed?.(vietnameseText);
      }
    } catch (error) {
      console.error("❌ Error:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Translate text from Vietnamese to Chinese
   * @param {string} text - Vietnamese text to translate
   * @param {string} sourceLang - Source language code (default: 'vi')
   * @param {string} targetLang - Target language code (default: 'zh')
   * @returns {Promise<string>} - Translated text in Chinese
   */
  async translateText(text, sourceLang = "vi", targetLang = "zh") {
    try {
      if (!text || text.trim() === "") {
        throw new Error("No text to translate");
      }

      this.onStatusChanged?.(`Translating from ${sourceLang} to ${targetLang}...`, "active");

      // Using Free Translation API (MyMemory)
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Translation API response:", data);

      if (data.responseStatus === 200) {
        let translatedText = data.responseData.translatedText;

        // If main translation is empty, try to get from matches array
        if (!translatedText || translatedText.trim() === "") {
          console.warn("Main translation empty, checking matches...");

          if (data.matches && data.matches.length > 0) {
            // Get first match with non-empty translation
            for (let match of data.matches) {
              if (match.translation && match.translation.trim() !== "") {
                translatedText = match.translation;
                console.log(`Using first match translation (score: ${match.match}):`, translatedText);
                break;
              }
            }
          }
        }

        // Final check - if still empty, throw error
        if (!translatedText || translatedText.trim() === "") {
          throw new Error("No valid translation found in API response");
        }

        console.log(`✓ Translation successful: ${translatedText}`);
        return translatedText;
      } else {
        throw new Error(data.responseDetails || "Translation failed");
      }
    } catch (error) {
      console.error("❌ Translation error:", error);
      this.onStatusChanged?.("Translation failed: " + error.message, "error");
      return text; // Return original if translation fails
    }
  }

  /**
   * Play text using Web Speech Synthesis API with language selection
   * @param {string} text - Text to play
   * @param {Function} onComplete - Callback when playback completes
   * @param {string} language - Language code (default: 'zh-CN')
   */
  playSpeech(text, onComplete, language = "zh-CN", gender = "female") {
    try {
      if (!text || text.trim() === "") {
        throw new Error("No text to speak");
      }

      this.onStatusChanged?.("Playing audio...", "active");

      const synthesis = window.speechSynthesis;

      // Cancel any ongoing speech
      if (synthesis.speaking) {
        synthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language; // Use selected language
      utterance.rate = 0.9; // Slower speech rate for clarity
      utterance.pitch = 1;
      utterance.volume = 1;

      // Select voice based on gender preference
      const voices = synthesis.getVoices();
      console.log("Available voices:", voices.length);

      let selectedVoice = null;

      // Find voice for the language with gender preference
      if (gender === "male") {
        selectedVoice = voices.find((voice) => voice.lang === language && voice.name.toLowerCase().includes("male"));
        if (!selectedVoice) {
          selectedVoice = voices.find((voice) => voice.lang === language && !voice.name.toLowerCase().includes("female"));
        }
      } else {
        // Default to female
        selectedVoice = voices.find((voice) => voice.lang === language && voice.name.toLowerCase().includes("female"));
      }

      // Fallback: try any voice for the language
      if (!selectedVoice) {
        selectedVoice = voices.find((voice) => voice.lang === language);
      }

      // Fallback: try language variants
      if (!selectedVoice) {
        const langPrefix = language.split("-")[0];
        selectedVoice = voices.find((voice) => voice.lang && voice.lang.startsWith(langPrefix));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log("🎤 Using voice:", selectedVoice.name);
      }

      utterance.onstart = () => {
        console.log("🔊 Playing speech...");
      };

      utterance.onend = () => {
        console.log("✓ Playback complete");
        this.onStatusChanged?.("Playback complete", "success");
        onComplete?.();
      };

      utterance.onerror = (event) => {
        console.error("❌ Speech synthesis error:", event.error);
        this.onStatusChanged?.("Speech error: " + event.error, "error");
      };

      synthesis.speak(utterance);
    } catch (error) {
      console.error("❌ Speech synthesis error:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Get list of all available voices
   * @returns {Array} Array of voice objects with details
   */
  getAvailableVoices() {
    const synthesis = window.speechSynthesis;
    const voices = synthesis.getVoices();

    console.log("=== AVAILABLE VOICES ===");
    console.log(`Total voices: ${voices.length}\n`);

    const voicesList = voices.map((voice, index) => {
      console.log(`${index + 1}. ${voice.name}`);
      console.log(`   Language: ${voice.lang}`);
      console.log(`   Default: ${voice.default ? "Yes" : "No"}`);
      console.log(`   Local: ${voice.localService ? "Yes" : "No"}`);
      console.log("");

      return {
        index,
        name: voice.name,
        lang: voice.lang,
        default: voice.default,
        localService: voice.localService,
      };
    });

    return voicesList;
  }

  /**
   * Get voices filtered by language
   * @param {string} language - Language code (e.g., 'zh-CN', 'en-US', 'vi-VN')
   * @returns {Array} Array of voice objects for that language
   */
  getVoicesByLanguage(language) {
    const synthesis = window.speechSynthesis;
    const voices = synthesis.getVoices();

    const filtered = voices.filter((voice) => voice.lang === language);

    console.log(`=== VOICES FOR ${language} ===`);
    console.log(`Found ${filtered.length} voice(s)\n`);

    filtered.forEach((voice, index) => {
      console.log(`${index + 1}. ${voice.name}`);
      console.log(`   Gender: ${voice.name.toLowerCase().includes("female") ? "Female" : voice.name.toLowerCase().includes("male") ? "Male" : "Unknown"}`);
      console.log("");
    });

    return filtered.map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes("female") ? "female" : voice.name.toLowerCase().includes("male") ? "male" : "unknown",
    }));
  }

  /**
   * Stop speech playback
   */
  stopSpeech() {
    const synthesis = window.speechSynthesis;
    if (synthesis.speaking) {
      synthesis.cancel();
      this.onStatusChanged?.("Playback stopped", "active");
    }
  }

  /**
   * Full pipeline: Vietnamese text → Translate → Play Chinese
   * @param {string} vietnameseText - Vietnamese text
   * @param {Function} onComplete - Callback when complete
   * @returns {Promise<Object>} - Result with vietnameseText and chineseText
   */
  async translateAndSpeak(vietnameseText, onComplete) {
    try {
      // Validate input
      if (!vietnameseText || vietnameseText.trim() === "") {
        throw new Error("Please provide Vietnamese text");
      }

      console.log("📍 translateAndSpeak received:", vietnameseText);

      // Step 1: Translate Vietnamese to Chinese
      const chineseText = await this.translateText(vietnameseText, "vi", "zh");

      console.log("📍 Translation result:", chineseText);

      // Validate translation result
      if (!chineseText || chineseText.trim() === "") {
        throw new Error("Translation returned empty text");
      }

      // Step 2: Play Chinese speech
      this.playSpeech(chineseText, onComplete);

      return {
        vietnameseText,
        chineseText,
        success: true,
      };
    } catch (error) {
      console.error("❌ Error in translation pipeline:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
      return {
        vietnameseText,
        chineseText: null,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transcribe audio to Vietnamese text using initialized recognition
   * Only starts if not already listening (prevents multiple permission requests)
   * @param {Function} onResult - Callback with transcribed text
   */
  transcribeVietnameseAudio(onResult) {
    try {
      if (!this.recognition) {
        throw new Error("Speech Recognition not supported in this browser");
      }

      // If already listening, ignore request (only one session at a time)
      if (this.isListening) {
        console.warn("⚠️ Already listening. Call stopRecognition() first.");
        this.onStatusChanged?.("Already listening...", "active");
        return;
      }

      this.recognitionCallback = onResult;
      this._currentTranscript = "";
      this.recognition.start();
    } catch (error) {
      console.error("❌ Error starting speech recognition:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Start recognition
   */
  startRecognition() {
    if (this.recognition) {
      console.log("🎤 Starting recognition...");
      this.recognition.start();
    } else {
      console.warn("⚠️ Recognition not initialized");
    }
  }

  /**
   * Stop recognition
   */
  stopRecognition() {
    if (this.recognition) {
      console.log("⏹️ Stopping recognition...");
      this.recognition.stop();
    } else {
      console.warn("⚠️ Recognition not initialized");
    }
  }

  /**
   * Abort recognition immediately
   */
  abortRecognition() {
    if (this.recognition) {
      console.log("❌ Aborting recognition...");
      this.recognition.abort();
    }
  }

  /**
   * Transcribe Vietnamese audio to text using Vosk (Offline)
   * Requires: https://alphacephei.com/vosk/
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {Function} onTranscribed - Callback with transcribed text
   */
  async transcribeAudioWithVosk(audioBlob, onTranscribed) {
    try {
      this.onStatusChanged?.("Transcribing with Vosk (offline)...", "active");

      // Check if Vosk is available
      if (!window.Vosk) {
        throw new Error("Vosk library not loaded. Add <script src='https://alphacephei.com/vosk/vosk-browser.js'></script>");
      }

      // Convert blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create recognizer with Vietnamese model
      const recognizer = new window.Vosk.Recognizer({
        model: window.vosk_model_vi || window.vosk_model, // Vietnamese model or fallback
        samplerate: audioBuffer.sampleRate,
      });

      // Get audio data from first channel
      const channelData = audioBuffer.getChannelData(0);

      // Process audio
      recognizer.acceptWaveform(channelData);
      const resultStr = recognizer.result();
      const result = JSON.parse(resultStr);

      // Extract transcript
      let transcript = "";
      if (result.result && Array.isArray(result.result)) {
        transcript = result.result.map((r) => (r.conf > 0.5 ? r.result : "")).join("");
      } else if (result.result && typeof result.result === "string") {
        transcript = result.result;
      }

      if (!transcript && result.partial) {
        transcript = result.partial;
      }

      this.lastTranscribedText = transcript;
      console.log("✓ Vosk transcribed:", transcript);
      this.onStatusChanged?.("Transcription complete", "success");
      onTranscribed?.(transcript);
    } catch (error) {
      console.error("❌ Vosk error:", error);
      this.onStatusChanged?.("Vosk error: " + error.message, "error");
    }
  }

  /**
   * Quick offline transcription - Try Vosk, fallback to Web Speech API
   */
  async transcribeOffline(audioBlob, onTranscribed) {
    try {
      // Check multiple ways Vosk might be available
      const hasVosk = typeof Vosk !== "undefined" || window.vosk_recognizer || window.Vosk;

      if (hasVosk) {
        console.log("📍 Using Vosk for transcription");
        await this.transcribeAudioWithVosk(audioBlob, onTranscribed);
      } else {
        console.warn("Vosk not available, using Web Speech API");
        this.transcribeAudioWithAPI(audioBlob, onTranscribed);
      }
    } catch (error) {
      console.error("❌ Transcription error:", error);
      // Fallback to Web Speech API if error
      this.transcribeAudioWithAPI(audioBlob, onTranscribed);
    }
  }

  /**
   * Transcribe Vietnamese audio blob using initialized recognition
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {Function} onTranscribed - Callback with transcribed text
   */
  async transcribeWithWebkit(audioBlob, onTranscribed) {
    try {
      if (!this.recognition) {
        throw new Error("Speech Recognition not supported");
      }

      this.onStatusChanged?.("Transcribing Vietnamese audio...", "active");

      // Convert blob to data URL
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Set callback and start
      this.recognitionCallback = onTranscribed;
      this._currentTranscript = "";

      // Play audio while listening
      audio.play().catch(() => {
        console.log("Cannot auto-play audio");
      });

      // Start recognition
      this.recognition.start();

      // Clean up audio after transcription ends
      const checkTranscriptionEnd = setInterval(() => {
        if (this.lastTranscribedText) {
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          clearInterval(checkTranscriptionEnd);
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error transcribing audio:", error);
      this.onStatusChanged?.("Error: " + error.message, "error");
    }
  }

  /**
   * Transcribe Vietnamese audio using Google Cloud Speech-to-Text API
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {string} apiKey - Google Cloud API key
   * @param {Function} onTranscribed - Callback with transcribed text
   */
  async transcribeWithGoogleCloud(audioBlob, apiKey, onTranscribed) {
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

          this.lastTranscribedText = transcript;
          console.log("✓ Google Cloud transcribed:", transcript);
          this.onStatusChanged?.("Transcription complete", "success");
          onTranscribed?.(transcript);
        } else {
          throw new Error("No transcription results");
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("❌ Google Cloud error:", error);
      this.onStatusChanged?.("Google Cloud error: " + error.message, "error");
    }
  }

  /**
   * Transcribe Vietnamese audio using OpenAI Whisper API
   * @param {Blob} audioBlob - Audio file to transcribe
   * @param {string} apiKey - OpenAI API key
   * @param {Function} onTranscribed - Callback with transcribed text
   */
  async transcribeWithWhisper(audioBlob, apiKey, onTranscribed) {
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
        this.lastTranscribedText = data.text;
        console.log("✓ Whisper transcribed:", data.text);
        this.onStatusChanged?.("Transcription complete", "success");
        onTranscribed?.(data.text);
      } else {
        throw new Error(data.error?.message || "Transcription failed");
      }
    } catch (error) {
      console.error("❌ Whisper error:", error);
      this.onStatusChanged?.("Whisper error: " + error.message, "error");
    }
  }

  /**
   * Smart transcription with fallback chain
   * Priority: Whisper > Google Cloud > Webkit > Vosk > Manual input
   */
  async transcribeSmartOffline(audioBlob, whisperApiKey, googleApiKey, onTranscribed) {
    try {
      if (whisperApiKey) {
        console.log("Using OpenAI Whisper (best for Vietnamese)");
        await this.transcribeWithWhisper(audioBlob, whisperApiKey, onTranscribed);
      } else if (googleApiKey) {
        console.log("Using Google Cloud Speech-to-Text");
        await this.transcribeWithGoogleCloud(audioBlob, googleApiKey, onTranscribed);
      } else if (window.webkitSpeechRecognition || window.SpeechRecognition) {
        console.log("Using Web Speech API (webkitSpeechRecognition)");
        await this.transcribeWithWebkit(audioBlob, onTranscribed);
      } else if (window.Vosk) {
        console.log("Using Vosk (offline)");
        await this.transcribeAudioWithVosk(audioBlob, onTranscribed);
      } else {
        console.log("Manual input fallback");
        this.transcribeAudioWithAPI(audioBlob, onTranscribed);
      }
    } catch (error) {
      console.error("❌ Transcription error:", error);
      this.transcribeAudioWithAPI(audioBlob, onTranscribed);
    }
  }
}

// Export for use in HTML
window.TranslationService = TranslationService;
