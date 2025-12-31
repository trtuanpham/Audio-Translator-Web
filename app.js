// UI Layer - Handles all DOM manipulation and connects to AudioRecorder

// Initialize translator and transcriber
const translator = new TranslationService();
const transcriber = new SpeechTranscriber();

// Update info in UI
if (typeof INFO !== "undefined" && document.getElementById("versionText")) {
  document.getElementById("versionText").textContent = `Demo product by ${INFO.author} - version ${INFO.version}`;

  // Update email link
  const emailLink = document.getElementById("emailLink");
  if (emailLink) {
    emailLink.href = `mailto:${INFO.email}`;
    emailLink.textContent = INFO.email;
  }
}

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

// Electron global hotkey state
let isHotKeyRecording = false;

// Make translator and transcriber global for onclick handlers
window.translator = translator;
window.transcriber = transcriber;

/**
 * Test network connectivity to Google
 */
async function testNetworkConnection() {
  console.log("🔍 Testing network connection to Google...");
  onStatusChanged("Testing network...", "active");

  try {
    const response = await fetch("https://www.google.com", {
      method: "HEAD",
      mode: "no-cors",
    });
    console.log("✓ Network test successful! Google is reachable.");
    onStatusChanged("Network OK - Google reachable ✓", "success");
    return true;
  } catch (error) {
    console.error("❌ Network test failed:", error);
    onStatusChanged("Network FAILED - No internet ✗", "error");
    return false;
  }
}

/**
 * Comprehensive network diagnostics
 */
async function testNetworkDiagnostics() {
  console.log("\n🔍 === COMPREHENSIVE NETWORK DIAGNOSTICS ===\n");
  onStatusChanged("Running network diagnostics...", "active");

  const results = {};

  // Test 1: Basic connectivity
  console.log("1️⃣  Testing basic internet connectivity...");
  try {
    const response = await fetch("https://www.google.com", {
      method: "HEAD",
      mode: "no-cors",
    });
    results.basicConnectivity = true;
    console.log("   ✓ Basic connectivity OK");
  } catch (err) {
    results.basicConnectivity = false;
    console.error("   ❌ Basic connectivity FAILED:", err.message);
  }

  // Test 2: Google Speech Recognition endpoint
  console.log("\n2️⃣  Testing Google Speech Recognition endpoint...");
  try {
    // Try to fetch from Google's speech API
    const response = await fetch("https://www.google.com/speech-api/", {
      method: "GET",
      mode: "no-cors",
    });
    results.googleSpeechAPI = true;
    console.log("   ✓ Google Speech API endpoint reachable");
  } catch (err) {
    results.googleSpeechAPI = false;
    console.error("   ❌ Google Speech API endpoint FAILED:", err.message);
  }

  // Test 3: MyMemory Translation API
  console.log("\n3️⃣  Testing MyMemory Translation API...");
  try {
    const response = await fetch("https://api.mymemory.translated.net/get?q=hello&langpair=en|vi", { mode: "cors" });
    const data = await response.json();
    results.translationAPI = data.responseStatus === 200;
    console.log(`   ${results.translationAPI ? "✓" : "❌"} Translation API: ${data.responseStatus}`);
  } catch (err) {
    results.translationAPI = false;
    console.error("   ❌ Translation API FAILED:", err.message);
  }

  // Test 4: DNS Resolution check
  console.log("\n4️⃣  Testing DNS resolution...");
  try {
    const response = await fetch("https://dns.google/resolve?name=google.com", {
      mode: "cors",
    });
    results.dnsResolution = response.ok;
    console.log(`   ${results.dnsResolution ? "✓" : "❌"} DNS Resolution OK`);
  } catch (err) {
    results.dnsResolution = false;
    console.error("   ❌ DNS Resolution FAILED:", err.message);
  }

  // Test 5: HTTPS certificate validation
  console.log("\n5️⃣  Testing HTTPS connections...");
  try {
    const response = await fetch("https://www.google.com", {
      method: "HEAD",
      mode: "cors",
    });
    results.https = response.ok || response.status === 0; // 0 for no-cors
    console.log("   ✓ HTTPS connections OK");
  } catch (err) {
    results.https = false;
    console.error("   ❌ HTTPS connections FAILED:", err.message);
  }

  // Summary
  console.log("\n📊 === NETWORK DIAGNOSTICS SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every((v) => v === true);
  if (allPassed) {
    console.log("\n✅ All network tests PASSED! Network should work.");
    onStatusChanged("✅ Network diagnostics: ALL PASSED", "success");
  } else {
    const failed = Object.keys(results).filter((k) => !results[k]);
    console.error(`\n❌ ${failed.length} test(s) FAILED: ${failed.join(", ")}`);
    onStatusChanged(`❌ Network issues: ${failed.join(", ")}`, "error");
  }

  return results;
}

/**
 * Test microphone access directly
 */
async function testMicrophoneAccess() {
  console.log("\n🎤 === TESTING MICROPHONE ACCESS ===\n");
  onStatusChanged("Testing microphone access...", "active");

  try {
    console.log("1. Requesting microphone permission...");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    console.log("✓ Microphone access GRANTED!");
    console.log("Stream details:");
    console.log("  - State:", stream.active ? "ACTIVE" : "INACTIVE");
    console.log("  - Audio tracks:", stream.getAudioTracks().length);

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      console.log("  - Track enabled:", track.enabled);
      console.log("  - Track kind:", track.kind);
      console.log("  - Track readyState:", track.readyState);
      console.log("  - Track settings:", JSON.stringify(track.getSettings(), null, 2));
    }

    // Stop stream after test
    stream.getTracks().forEach((track) => track.stop());
    console.log("\n✓ Microphone stream stopped");

    onStatusChanged("✓ Microphone access OK", "success");
    return true;
  } catch (error) {
    console.error("❌ Microphone access FAILED:");
    console.error("  - Error name:", error.name);
    console.error("  - Error message:", error.message);

    // Provide specific guidance
    if (error.name === "NotAllowedError") {
      console.error("  → Microphone permission was DENIED by user");
      onStatusChanged("❌ Microphone permission denied", "error");
    } else if (error.name === "NotFoundError") {
      console.error("  → No microphone device found");
      onStatusChanged("❌ No microphone device found", "error");
    } else if (error.name === "SecurityError") {
      console.error("  → Security error - check HTTPS and CSP");
      onStatusChanged("❌ Security error - check HTTPS", "error");
    } else {
      console.error("  → Unknown error");
      onStatusChanged("❌ Microphone error: " + error.message, "error");
    }

    return false;
  }
}

/**
 * Test translation API
 */
async function testTranslationAPI() {
  console.log("🔍 Testing translation API (MyMemory)...");
  onStatusChanged("Testing translation API...", "active");

  try {
    const response = await fetch("https://api.mymemory.translated.net/get?q=hello&langpair=en|vi");
    const data = await response.json();

    if (data.responseStatus === 200) {
      console.log("✓ Translation API working! Response:", data.responseData.translatedText);
      onStatusChanged("Translation API OK ✓", "success");
      return true;
    } else {
      console.error("❌ Translation API error:", data.responseDetails);
      onStatusChanged("Translation API failed ✗", "error");
      return false;
    }
  } catch (error) {
    console.error("❌ Translation API test failed:", error);
    onStatusChanged("Translation API test failed ✗", "error");
    return false;
  }
}

/**
 * Diagnose Speech Recognition issues
 */
function diagnoseSpeechRecognition() {
  console.log("🔍 === SPEECH RECOGNITION DIAGNOSIS ===");
  onStatusChanged("Diagnosing Speech Recognition...", "active");

  let issues = [];
  let results = {};

  // 1. Check if SpeechRecognition API is available
  const hasAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  results.apiAvailable = hasAPI;
  console.log(`1. Web Speech API available: ${hasAPI ? "✓ YES" : "✗ NO"}`);
  if (!hasAPI) {
    issues.push("❌ Web Speech API not available in this browser");
  }

  // 2. Check if recognition object exists in transcriber
  const hasRecognition = !!transcriber.recognition;
  results.recognitionObject = hasRecognition;
  console.log(`2. Recognition object initialized: ${hasRecognition ? "✓ YES" : "✗ NO"}`);
  if (!hasRecognition) {
    issues.push("❌ Speech Recognition object not initialized");
  }

  // 3. Check internet connection
  console.log("3. Checking internet connection...");
  fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
    .then(() => {
      results.internet = true;
      console.log("   ✓ Internet connected");
    })
    .catch((err) => {
      results.internet = false;
      console.log("   ✗ No internet connection:", err.message);
      issues.push("❌ No internet - Speech Recognition requires internet");
    });

  // 4. Check microphone permission
  const hasPermission = transcriber.permissionGranted;
  results.micPermission = hasPermission;
  console.log(`4. Microphone permission granted: ${hasPermission ? "✓ YES" : "✗ NO"}`);
  if (!hasPermission) {
    issues.push("⚠️ Microphone permission not yet granted");
  }

  // 5. Check if currently transcribing
  const isTranscribing = transcriber.isTranscribing;
  results.isTranscribing = isTranscribing;
  console.log(`5. Currently transcribing: ${isTranscribing ? "⚠️ YES (busy)" : "✓ NO (available)"}`);

  // 6. Check Electron environment
  const isElectron = !!window.electronAPI;
  results.electronEnv = isElectron;
  console.log(`6. Running in Electron: ${isElectron ? "✓ YES" : "✓ NO (Browser)"}`);

  console.log("\n🔍 === ISSUES FOUND ===");
  if (issues.length === 0) {
    console.log("✓ No issues found! Speech Recognition should work.");
    onStatusChanged("✓ Speech Recognition ready", "success");
  } else {
    console.log(`Found ${issues.length} issue(s):`);
    issues.forEach((issue) => console.log(`  ${issue}`));
    onStatusChanged(`⚠️ Issues found: ${issues.length}`, "error");
  }

  console.log("\n📊 Full diagnostic results:", results);
  return { results, issues };
}

/**
 * Test Speech Recognition - Simple direct test
 */
function testSpeechRecognitionSimple() {
  console.log("\n🎤 === SIMPLE SPEECH RECOGNITION TEST ===\n");
  onStatusChanged("Simple speech test...", "active");

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;

    let isRunning = false;
    let results = [];

    recognition.onstart = () => {
      isRunning = true;
      console.log("✓ 🎤 Microphone started");
      onStatusChanged("🎤 Listening...", "active");
    };

    recognition.onresult = (event) => {
      console.log("✓ EVENT: onresult");
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;
        console.log(`  Transcript: "${transcript}" (final: ${isFinal})`);
        if (isFinal) {
          results.push(transcript);
        }
      }
    };

    recognition.onend = () => {
      isRunning = false;
      console.log("✓ 🛑 Microphone ended");
      console.log(`Final results: ${results.join(" ")}`);
      if (results.length > 0) {
        onStatusChanged(`✓ Speech recognized: "${results.join(" ")}"`, "success");
      } else {
        onStatusChanged("⚠️ No speech detected", "info");
      }
    };

    recognition.onerror = (event) => {
      console.error("❌ SPEECH ERROR:", event.error);
      onStatusChanged(`❌ Speech error: ${event.error}`, "error");
    };

    console.log("📍 Starting simple speech recognition...");
    recognition.start();

    // Auto-stop after 5 seconds
    setTimeout(() => {
      if (isRunning) {
        console.log("⏱️ Auto-stopping after 5 seconds...");
        recognition.stop();
      }
    }, 5000);
  } catch (error) {
    console.error("❌ Error:", error);
    onStatusChanged("❌ Error: " + error.message, "error");
  }
}

/**
 * Test Speech Recognition - start listening and show raw events
 */
async function testStartSpeech() {
  console.log("\n🎤 === TESTING SPEECH RECOGNITION START ===");
  onStatusChanged("Testing speech recognition...", "active");

  if (!transcriber.recognition) {
    console.error("❌ Recognition object not available!");
    onStatusChanged("❌ Recognition object not available", "error");
    return;
  }

  if (transcriber.isTranscribing) {
    console.warn("⚠️ Already transcribing! Stopping first...");
    transcriber.stop();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("📍 Starting speech recognition test...");
  console.log("🎙️ Please speak now...");

  try {
    // Start listening with timeout
    transcriber.recognition.start();

    // Auto-stop after 5 seconds for testing
    setTimeout(() => {
      if (transcriber.isTranscribing) {
        console.log("⏱️ 5 second timeout reached, stopping...");
        transcriber.recognition.stop();
      }
    }, 5000);

    // Listen for all events
    const originalOnstart = transcriber.recognition.onstart;
    const originalOnresult = transcriber.recognition.onresult;
    const originalOnend = transcriber.recognition.onend;
    const originalOnerror = transcriber.recognition.onerror;

    transcriber.recognition.onstart = function (event) {
      console.log("✓ EVENT: onstart");
      originalOnstart?.call(this, event);
    };

    transcriber.recognition.onresult = function (event) {
      console.log("✓ EVENT: onresult");
      console.log("  Results count:", event.results.length);
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;
        console.log(`  [${i}] "${transcript}" (final: ${isFinal})`);
      }
      originalOnresult?.call(this, event);
    };

    transcriber.recognition.onend = function (event) {
      console.log("✓ EVENT: onend");
      originalOnend?.call(this, event);
    };

    transcriber.recognition.onerror = function (event) {
      console.error("❌ EVENT: onerror -", event.error);
      originalOnerror?.call(this, event);
    };

    onStatusChanged("🎤 Listening... (5 sec timeout)", "active");
    console.log("\n✓ Speech recognition started. Waiting for events...\n");
  } catch (error) {
    console.error("❌ Error starting speech recognition:", error);
    onStatusChanged("❌ Error: " + error.message, "error");
  }
}

// Map language codes to full locale codes for TTS
const LANG_MAP = {
  vi: "vi-VN",
  en: "en-US",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  th: "th-TH",
};

// Map language to test phrase
const TEST_PHRASES = {
  vi: "Xin chào",
  en: "Hello",
  zh: "你好",
  ja: "こんにちは",
  ko: "안녕하세요",
  th: "สวัสดี",
};

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

/**
 * Request manual text input from user (fallback when network is unavailable)
 * Uses custom modal instead of browser prompt() which doesn't work in Electron
 */
function requestManualInput(promptText = "Enter text to translate:") {
  return new Promise((resolve) => {
    const modal = document.getElementById("inputModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalInput = document.getElementById("modalInput");
    const modalOk = document.getElementById("modalOk");
    const modalCancel = document.getElementById("modalCancel");

    // Set modal text
    modalTitle.textContent = promptText;
    modalInput.value = "";
    modalInput.focus();

    // Show modal
    modal.style.display = "flex";

    // Handle OK button
    const handleOk = () => {
      const inputText = modalInput.value.trim();
      cleanup();
      if (inputText) {
        console.log("✓ Manual input received:", inputText);
        onStatusChanged("Manual input ready", "success");
        resolve(inputText);
      } else {
        resolve(null);
      }
    };

    // Handle Cancel button
    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    // Handle Enter key
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        handleOk();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    // Cleanup function
    const cleanup = () => {
      modal.style.display = "none";
      modalOk.removeEventListener("click", handleOk);
      modalCancel.removeEventListener("click", handleCancel);
      modalInput.removeEventListener("keydown", handleKeyDown);
    };

    // Add event listeners
    modalOk.addEventListener("click", handleOk);
    modalCancel.addEventListener("click", handleCancel);
    modalInput.addEventListener("keydown", handleKeyDown);
  });
}

/**
 * Trigger auto-start recording when mic detects signal
 */
async function triggerAutoStart() {
  if (autoStartEnabled && !transcriber.isTranscribing) {
    console.log("🎤 Mic detected! Auto-starting recording...");
    await handleStartRecording();
  }
}

async function handleStartRecording() {
  console.log("📍 Starting mic capture from app.js");

  const inputLangFull = inputLangSelect.value; // vi-VN, en-US, etc
  const inputLang = inputLangFull.split("-")[0]; // vi, en, zh, etc

  try {
    // Wait for transcription from microphone
    let transcribedText = null;
    try {
      transcribedText = await transcriber.fromMicrophone(inputLangFull);
    } catch (error) {
      // Network error - offer manual input
      if (error.message === "network_error") {
        console.warn("⚠️ Network error detected - requesting manual input");
        transcribedText = await requestManualInput("Network unavailable - please enter text:");
        if (!transcribedText) {
          throw new Error("No input provided");
        }
      } else {
        throw error;
      }
    }

    if (!transcribedText) {
      throw new Error("No text transcribed");
    }

    console.log("Text captured:", transcribedText);

    // Get output language
    const outputLang = outputLangSelect.value;

    const outputLangFull_TTS = LANG_MAP[outputLang] || outputLang;

    // Translate
    const translatedText = await translator.translateText(transcribedText, inputLang, outputLang);

    // Add both input and output to transcription list
    addToTranscriptionList(transcribedText, translatedText);

    // Get selected voice name
    const selectedVoiceName = voiceSelect.value;

    // Play speech and wait for completion
    await playSpeechWithVoice(translatedText, outputLangFull_TTS, selectedVoiceName);

    console.log("✓ Translation and speech complete");
  } catch (error) {
    console.error("Error during transcription:", error);
  }
}

function handleStopRecording() {
  console.log("📍 Stopping mic capture from app.js");
  transcriber.stop();
}

/**
 * Toggle auto-start recording feature
 */
function toggleAutoStart() {
  autoStartEnabled = !autoStartEnabled;
  const autoStartBtn = document.getElementById("autoStartBtn");
  if (autoStartBtn) {
    autoStartBtn.style.background = autoStartEnabled ? "#51cf66" : "#ccc";
    autoStartBtn.textContent = autoStartEnabled ? "Auto-Start: ON" : "Auto-Start: OFF";
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

  const testPhrase = TEST_PHRASES[outputLang] || "Hello";
  const outputLangFull = LANG_MAP[outputLang] || outputLang;

  // Play test voice
  (async () => {
    try {
      await playSpeechWithVoice(testPhrase, outputLangFull, selectedVoiceName);
      console.log("✓ Voice test complete");
    } catch (error) {
      console.error("Error playing test voice:", error);
    }
  })();
});

// Request permission and load devices automatically when page loads
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize Mic Signal Detector (includes audio setup)
    micSignalDetector = new MicSignalDetector({
      signalThreshold: 15,
      debounceMs: 200,
    });

    // Share status callback
    micSignalDetector.onStatusChanged = onStatusChanged;

    // Initialize audio
    const initialized = await micSignalDetector.initialize();
    if (!initialized) {
      throw new Error("Failed to initialize microphone");
    }

    console.log("✓ Mic signal detector initialized");

    // Setup callbacks for UI updates
    micSignalDetector.onSignalStateChanged = (state) => {
      if (state.hasSignal) {
        micStatusEl.textContent = "ON";
        micStatusEl.style.color = "#51cf66";

        // Trigger auto-start recording
        triggerAutoStart();
      } else {
        micStatusEl.textContent = "OFF";
        micStatusEl.style.color = "#ff6b6b";
      }
    };

    micSignalDetector.onAudioLevelChanged = (level) => {
      audioLevelBar.style.width = level + "%";
      audioLevelText.textContent = level;
    };

    // Start monitoring mic signal
    micSignalDetector.startMonitoring();
    console.log("✓ Mic signal detector started");

    // Request microphone permission once for transcriber
    await transcriber.requestPermissionOnce();

    // Wait for voices to load
    const synthesis = window.speechSynthesis;

    if (synthesis.getVoices().length > 0) {
      // Voices already loaded
      populateVoiceDropdown();
    } else {
      // Wait for voiceschanged event (store reference for later removal)
      const voicesChangedHandler = populateVoiceDropdown;
      synthesis.addEventListener("voiceschanged", voicesChangedHandler);
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

  const fullLang = LANG_MAP[outputLang] || outputLang;

  // Get voices for selected language
  const voicesByLanguage = translator.getVoicesByLanguage(fullLang);

  voiceSelect.innerHTML = "";

  if (voicesByLanguage.length === 0) {
    voiceSelect.innerHTML = `<option value="">No voices available for ${fullLang}</option>`;
  } else {
    voicesByLanguage.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `🎤 ${voice.name}`;

      voiceSelect.appendChild(option);
    });
  }

  // Select first voice by default
  if (voiceSelect.options.length > 0) {
    voiceSelect.selectedIndex = 0;
  }
}

/**
 * Play speech with a specific voice name - returns a Promise that resolves when playback completes
 */
function playSpeechWithVoice(text, language, voiceName) {
  return new Promise((resolve, reject) => {
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
        resolve();
      };

      utterance.onerror = (event) => {
        console.error("❌ Speech synthesis error:", event.error);
        onStatusChanged("Speech error: " + event.error, "error");
        reject(new Error("Speech synthesis error: " + event.error));
      };

      synthesis.speak(utterance);
    } catch (error) {
      console.error("❌ Speech synthesis error:", error);
      onStatusChanged("Error: " + error.message, "error");
      reject(error);
    }
  });
}

/**
 * Toggle What's New modal display
 */
function toggleWhatsNew() {
  const modal = document.querySelector("whats-new-modal");
  if (modal) {
    modal.toggle();
  } else {
    console.warn("⚠️ What's New modal not found");
  }
}

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

// ============================================
// Cleanup Function - Fix Memory Leaks
// ============================================

/**
 * Cleanup all resources before page unload
 */
function cleanupResources() {
  console.log("🧹 Cleaning up resources...");

  // Stop mic signal detector
  if (micSignalDetector) {
    micSignalDetector.stop();
    micSignalDetector = null;
  }

  // Stop transcription
  if (transcriber) {
    transcriber.abort();
  }

  // Stop speech synthesis
  if (window.speechSynthesis) {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }

  // Remove event listeners
  const synthesis = window.speechSynthesis;
  synthesis.removeEventListener("voiceschanged", populateVoiceDropdown);

  console.log("✓ Cleanup complete");
}

// Cleanup on page unload
window.addEventListener("beforeunload", cleanupResources);
window.addEventListener("unload", cleanupResources);

// ============================================
// Electron Global Hotkey Handler
// ============================================

if (window.electronAPI) {
  console.log("✓ Electron API detected - global hotkeys enabled (G key)");

  window.electronAPI.onHotkey((data) => {
    console.log(`🎤 Hotkey event: ${data.key} ${data.action}`);

    if (data.action === "toggle") {
      // G key = toggle start/stop
      if (transcriber.isTranscribing) {
        console.log("🎤 G - Stopping recording");
        handleStopRecording();
      } else {
        console.log("🎤 G - Starting recording");
        handleStartRecording();
      }
    }
  });
} else {
  console.log("ℹ️ Running in browser mode (no Electron API)");
}

// Fallback: Keyboard events for browser (G key)
document.addEventListener("keydown", (e) => {
  if (e.key === "g" || e.key === "G") {
    if (!window.electronAPI) {
      // Only if NOT using Electron
      e.preventDefault();
      if (!transcriber.isTranscribing && !isHotKeyRecording) {
        console.log("🎤 G DOWN (Browser) - Starting recording");
        isHotKeyRecording = true;
        handleStartRecording();
      }
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "g" || e.key === "G") {
    if (!window.electronAPI) {
      // Only if NOT using Electron
      e.preventDefault();
      if (isHotKeyRecording) {
        console.log("🎤 G UP (Browser) - Stopping recording");
        isHotKeyRecording = false;
        handleStopRecording();
      }
    }
  }
});

// Keep monitoring active when tab is hidden (like Google Meeting)
if (document.hidden !== undefined) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      console.log("Page hidden, but keeping mic monitoring active...");
      // Don't stop monitoring - keep it active in background
    } else {
      console.log("Page visible again, mic monitoring continues...");
      // Mic monitoring never stopped, so nothing to restart
    }
  });
}
