/**
 * Speech Recognition Polyfill
 * Sets up SpeechRecognition API with fallback support
 */

// Initialize SpeechRecognition with fallback to webkit version
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Export for use in other modules
if (!window.SpeechRecognition) {
  console.warn("⚠️ Speech Recognition not supported in this browser");
}
