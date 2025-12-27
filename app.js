// UI Layer - Handles all DOM manipulation and connects to AudioRecorder

// Initialize translator and transcriber
const translator = new TranslationService();
const transcriber = new VietnameseTranscriber();

// Audio Recorder for mic signal detection (separate from transcriber)
const audioRecorder = new AudioRecorder();

// Optional: API keys for better transcription (leave empty to use Web Speech API)
const WHISPER_API_KEY = ""; // From https://platform.openai.com/api-keys
const GOOGLE_CLOUD_API_KEY = ""; // From https://cloud.google.com

// DOM Elements
const inputLangSelect = document.getElementById("inputLang");
const outputLangSelect = document.getElementById("outputLang");
const voiceSelect = document.getElementById("voiceSelect");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const timerEl = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
const levelCanvas = document.getElementById("levelCanvas");

// Mic Signal Detector UI Elements
const micStatusEl = document.getElementById("micStatus");
const audioLevelBar = document.getElementById("audioLevelBar");
const audioLevelText = document.getElementById("audioLevelText");

// Mic Signal Detector instance (will be initialized later)
let micSignalDetector = null;

// Auto-start recording feature
let autoStartEnabled = true; // Toggle for auto-start on mic detection
let isAutoStartRecording = false; // Track if recording was auto-started

// Make translator and transcriber global for onclick handlers
window.translator = translator;
window.transcriber = transcriber;

// ============================================
// Recording Control Functions
// ============================================

/**
 * Add text to transcription history list with both input and output
 */
function addToTranscriptionList(inputText, outputText) {
  const listContainer = document.getElementById("transcriptionList");

  // Clear "No transcriptions yet" message on first item
  if (listContainer.textContent.includes("No transcriptions yet")) {
    listContainer.innerHTML = "";
  }

  // Create list item
  const item = document.createElement("div");
  item.style.cssText = "padding: 8px; border-bottom: 1px solid #eee; background: #fafafa; border-radius: 4px; margin-bottom: 6px; word-break: break-word;";

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  item.innerHTML = `<strong style="color: #667eea;">${timestamp}</strong><br>
                    <span style="color: #555; display: block; margin-top: 4px;"><strong>Input:</strong> ${inputText}</span>
                    <span style="color: #888; display: block; margin-top: 4px;"><strong>Output:</strong> ${outputText}</span>`;

  // Add to beginning of list
  listContainer.insertBefore(item, listContainer.firstChild);

  // Keep only last 20 items
  while (listContainer.children.length > 20) {
    listContainer.removeChild(listContainer.lastChild);
  }
}

function handleStartRecording() {
  console.log("📍 Starting mic capture from app.js");
  const inputLangFull = inputLangSelect.value; // vi-VN, en-US, etc
  const inputLang = inputLangFull.split("-")[0]; // vi, en, zh, etc

  transcriber.fromMicrophone((transcribedText) => {
    if (transcribedText) {
      console.log("Text captured:", transcribedText);

      // Get output language
      const outputLang = outputLangSelect.value;

      // Map language codes to full locale codes for TTS
      const langMap = {
        vi: "vi-VN",
        en: "en-US",
        zh: "zh-CN",
        ja: "ja-JP",
        ko: "ko-KR",
        th: "th-TH",
      };
      const outputLangFull_TTS = langMap[outputLang] || outputLang;

      // Translate and speak
      translator.translateText(transcribedText, inputLang, outputLang).then((translatedText) => {
        // Add both input and output to transcription list
        addToTranscriptionList(transcribedText, translatedText);

        // Get selected voice name
        const selectedVoiceName = voiceSelect.value;

        playSpeechWithVoice(
          translatedText,
          () => {
            console.log("✓ Translation and speech complete");
            // Reset auto-start flag when transcription is complete
            isAutoStartRecording = false;
            console.log("✓ Auto-start flag reset, ready for next detection");
          },
          outputLangFull_TTS,
          selectedVoiceName
        );
      });
    }
  }, inputLangFull);
}

function handleStopRecording() {
  console.log("📍 Stopping mic capture from app.js");
  transcriber.stop();
  isAutoStartRecording = false; // Reset auto-start flag
}

/**
 * Toggle auto-start recording feature
 */
function toggleAutoStart() {
  autoStartEnabled = !autoStartEnabled;
  const autoStartBtn = document.getElementById("autoStartBtn");
  if (autoStartBtn) {
    autoStartBtn.style.background = autoStartEnabled ? "#51cf66" : "#ccc";
    autoStartBtn.textContent = autoStartEnabled ? "🔄 Auto-Start: ON" : "⏹ Auto-Start: OFF";
  }
  console.log("Auto-start recording:", autoStartEnabled ? "ENABLED" : "DISABLED");
  onStatusChanged(`Auto-start ${autoStartEnabled ? "enabled" : "disabled"}`, "active");
}

// Status update helper
function onStatusChanged(message, type) {
  statusText.textContent = message;
  statusEl.className = "status " + type;
}

// Share status with translator and transcriber
translator.onStatusChanged = onStatusChanged;
transcriber.onStatusChanged = onStatusChanged;

// Update button state when recording starts
function onRecordingStarted() {
  startBtn.disabled = true;
}

// Update button state when recording ends
function onRecordingEnded() {
  startBtn.disabled = false;
}

// ============================================
// DOM Event Listeners
// ============================================

// Update voice dropdown and list when output language changes
outputLangSelect.addEventListener("change", () => {
  // Update voice dropdown
  populateVoiceDropdown();
});

// Test voice when voice selection changes
voiceSelect.addEventListener("change", () => {
  const outputLang = outputLangSelect.value;
  const selectedVoiceName = voiceSelect.value;

  if (!selectedVoiceName) return;

  // Map language to test phrase
  const testPhrases = {
    vi: "Xin chào",
    en: "Hello",
    zh: "你好",
    ja: "こんにちは",
    ko: "안녕하세요",
    th: "สวัสดี",
  };

  const testPhrase = testPhrases[outputLang] || "Hello";

  // Map to full locale code for TTS
  const langMap = {
    vi: "vi-VN",
    en: "en-US",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    th: "th-TH",
  };
  const outputLangFull = langMap[outputLang] || outputLang;

  // Play test voice
  playSpeechWithVoice(
    testPhrase,
    () => {
      console.log("✓ Voice test complete");
    },
    outputLangFull,
    selectedVoiceName
  );
});

// Request permission and load devices automatically when page loads
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize audio recorder and get mic devices
    const result = await audioRecorder.initializeAudio();

    if (result && result.audioInputs) {
      console.log("✓ Audio recorder initialized with", result.audioInputs.length, "devices");

      // Initialize Mic Signal Detector with audio recorder's analyser
      micSignalDetector = new MicSignalDetector(audioRecorder.analyser, {
        signalThreshold: 15,
        debounceMs: 2000,
      });

      // Setup callbacks for UI updates
      micSignalDetector.onSignalStateChanged = (state) => {
        if (state.hasSignal) {
          micStatusEl.textContent = "ON";
          micStatusEl.style.color = "#51cf66";

          // Auto-start recording when mic detects signal
          if (autoStartEnabled && !isAutoStartRecording && !transcriber.isTranscribing) {
            console.log("🎤 Mic detected! Auto-starting recording...");
            isAutoStartRecording = true;
            handleStartRecording();
          }
        } else {
          micStatusEl.textContent = "OFF";
          micStatusEl.style.color = "#ff6b6b";

          // Just track mic status, don't auto-stop
          // Let speech recognition handle stopping on its own
        }
      };

      micSignalDetector.onAudioLevelChanged = (level) => {
        audioLevelBar.style.width = level + "%";
        audioLevelText.textContent = level;
      };

      // Start monitoring mic signal
      micSignalDetector.startMonitoring();
      console.log("✓ Mic signal detector started");
    }

    // Request microphone permission once for Vietnamese transcriber
    await transcriber.requestPermissionOnce();

    // Wait for voices to load
    const synthesis = window.speechSynthesis;

    if (synthesis.getVoices().length > 0) {
      // Voices already loaded
      populateVoiceDropdown();
    } else {
      // Wait for voiceschanged event
      synthesis.addEventListener("voiceschanged", populateVoiceDropdown);
    }
  } catch (error) {
    console.error("Error:", error);
    onStatusChanged("Error: " + error.message, "error");
  }
});

/**
 * Populate voice dropdown with voices for selected output language
 */
function populateVoiceDropdown() {
  const outputLang = outputLangSelect.value; // Get short code: vi, en, zh, etc.

  // Map to full locale code
  const langMap = {
    vi: "vi-VN",
    en: "en-US",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    th: "th-TH",
  };
  const fullLang = langMap[outputLang] || outputLang;

  // Get voices for selected language
  const voicesByLanguage = translator.getVoicesByLanguage(fullLang);

  voiceSelect.innerHTML = "";

  if (voicesByLanguage.length === 0) {
    voiceSelect.innerHTML = `<option value="">No voices available for ${fullLang}</option>`;
  } else {
    voicesByLanguage.forEach((voice) => {
      const genderEmoji = voice.gender === "female" ? "👩" : voice.gender === "male" ? "👨" : "❓";
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${genderEmoji} ${voice.name}`;
      voiceSelect.appendChild(option);
    });
  }

  // Select first voice by default
  if (voiceSelect.options.length > 0) {
    voiceSelect.selectedIndex = 0;
  }
}

/**
 * Play speech with a specific voice name
 */
function playSpeechWithVoice(text, onComplete, language, voiceName) {
  try {
    if (!text || text.trim() === "") {
      throw new Error("No text to speak");
    }

    onStatusChanged("Playing audio...", "active");

    const synthesis = window.speechSynthesis;

    // Cancel any ongoing speech
    if (synthesis.speaking) {
      synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Find voice by name
    const voices = synthesis.getVoices();
    let selectedVoice = voices.find((voice) => voice.name === voiceName);

    // Fallback to any voice for the language if not found
    if (!selectedVoice) {
      selectedVoice = voices.find((voice) => voice.lang === language);
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
      onStatusChanged("Playback complete", "success");
      onComplete?.();
    };

    utterance.onerror = (event) => {
      console.error("❌ Speech synthesis error:", event.error);
      onStatusChanged("Speech error: " + event.error, "error");
    };

    synthesis.speak(utterance);
  } catch (error) {
    console.error("❌ Speech synthesis error:", error);
    onStatusChanged("Error: " + error.message, "error");
  }
}

// ============================================
// Visualizer Drawing Function
// ============================================

function drawVisualizer(canvas, dataArray) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const bufferLength = dataArray.length;

  // Clear canvas with dark background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, width, height);

  // Add subtle grid background
  ctx.strokeStyle = "rgba(0, 255, 100, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }

  // Draw bars with strong glow
  const barWidth = (width / bufferLength) * 2.8;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * height;

    if (barHeight < 1) {
      x += barWidth;
      continue;
    }

    // Choose color based on height
    if (barHeight > height * 0.7) {
      ctx.fillStyle = "#00ff41";
      ctx.shadowColor = "rgba(0, 255, 65, 0.8)";
    } else if (barHeight > height * 0.4) {
      ctx.fillStyle = "#00ff7f";
      ctx.shadowColor = "rgba(0, 255, 127, 0.8)";
    } else {
      ctx.fillStyle = "#00ffff";
      ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
    }

    // Draw strong shadow/glow
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw main bar
    ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

    // Add bright outline
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(x, height - barHeight - 1, barWidth - 1, barHeight + 1);
    ctx.globalAlpha = 1;

    x += barWidth;
  }

  ctx.globalAlpha = 1;
}

/**
 * Toggle voice list display
 */
function toggleVoiceList() {
  const container = document.getElementById("voiceListContainer");
  const voiceList = document.getElementById("voiceList");

  if (container.style.display === "none") {
    // Show the list
    container.style.display = "block";
    displayVoicesByLanguage();
  } else {
    // Hide the list
    container.style.display = "none";
  }
}

/**
 * Display voices for the selected output language
 */
function displayVoicesByLanguage() {
  const voiceList = document.getElementById("voiceList");
  const outputLang = outputLangSelect.value; // Get short code: vi, en, zh, etc.

  // Map to full locale code
  const langMap = {
    vi: "vi-VN",
    en: "en-US",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    th: "th-TH",
  };
  const fullLang = langMap[outputLang] || outputLang;

  // Get voices for selected language
  const voicesByLanguage = translator.getVoicesByLanguage(fullLang);
  console.log(`Voices for ${fullLang}:`, voicesByLanguage);

  // Build HTML

  let html = `<strong style="color: #667eea; display: block; margin-bottom: 10px;">Voices for: ${fullLang}</strong>`;

  if (voicesByLanguage.length === 0) {
    html += `<span style="color: #999;">❌ No voices available for ${fullLang}</span>`;
  } else {
    voicesByLanguage.forEach((voice, index) => {
      const genderEmoji = voice.gender === "female" ? "👩" : voice.gender === "male" ? "👨" : "❓";
      const genderColor = voice.gender === "female" ? "#ff69b4" : voice.gender === "male" ? "#4169e1" : "#999";

      html += `<div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid ${genderColor};">`;
      html += `<span style="color: ${genderColor}; font-weight: 500;">${genderEmoji} ${voice.gender.toUpperCase()}</span><br>`;
      html += `<span style="color: #555;">${voice.name}</span>`;
      html += `</div>`;
    });
  }

  voiceList.innerHTML = html;
}
