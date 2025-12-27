// Translation Module - Handles Vietnamese → Chinese translation and speech synthesis

class TranslationService {
  constructor() {
    this.onStatusChanged = null;
    this.lastTranscribedText = null;
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
}

// Export for use in HTML
window.TranslationService = TranslationService;
