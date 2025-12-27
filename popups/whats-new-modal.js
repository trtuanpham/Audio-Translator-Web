/**
 * What's New Modal - Web Component
 * Self-contained component for displaying version info and changelog
 */

class WhatsNewModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    console.log("📍 Initializing What's New Modal...");
    console.log("✓ INFO globals already set:", window.INFO);
    this.render();
    this.setupEventListeners();
  }

  loadVersionData() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "../version.js", true);
    xhr.onload = () => {
      if (xhr.status === 200) {
        console.log("📥 version.js loaded, executing...");
        try {
          eval(xhr.responseText);
          console.log("✓ INFO:", window.INFO);
          console.log("✓ WHATS_NEW loaded");
        } catch (e) {
          console.error("Error executing version.js:", e);
        }
      }
      this.render();
      this.setupEventListeners();
    };
    xhr.onerror = () => {
      console.error("❌ Error loading version.js");
      this.render();
      this.setupEventListeners();
    };
    xhr.send();
  }

  render() {
    const version = (window.INFO && window.INFO.version) || "1.0.0";
    const whatsNew = (window.INFO && window.INFO.whatsNew) || "";

    // Parse what's new items
    const whatsNewItems = whatsNew
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.startsWith("-"))
      .map((item) => item.replace(/^-\s*/, ""));

    const whatsNewHtml = whatsNewItems.map((item) => `<li style="margin-bottom: 8px;">${item}</li>`).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary-color: #667eea;
          --danger-color: #ff6b6b;
          --success-color: #51cf66;
        }

        .modal-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          justify-content: center;
          align-items: center;
        }

        .modal-overlay.active {
          display: flex;
        }

        .modal-container {
          background: white;
          border-radius: 15px;
          padding: 30px;
          max-width: 500px;
          width: 90%;
          max-height: 70vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-title {
          color: #333;
          margin: 0;
          font-size: 24px;
        }

        .close-btn {
          background: var(--danger-color);
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: #ff5252;
        }

        .modal-content {
          color: #555;
          line-height: 1.6;
          font-size: 14px;
        }

        h3 {
          color: var(--primary-color);
          margin-top: 0;
          margin-bottom: 15px;
        }

        h4 {
          color: #333;
          margin-bottom: 8px;
        }

        ul {
          margin: 0;
          padding-left: 20px;
        }

        li {
          margin-bottom: 8px;
        }

        .section {
          margin-bottom: 20px;
        }

        .tip-box {
          padding: 12px;
          background: #e3f2fd;
          border-radius: 8px;
          border-left: 4px solid #2196f3;
          margin-top: 20px;
        }

        .tip-text {
          margin: 0;
          font-size: 12px;
          color: #1565c0;
        }
      </style>

      <div class="modal-overlay">
        <div class="modal-container">
          <div class="modal-header">
            <h2 class="modal-title">✨ What's New</h2>
            <button class="close-btn">×</button>
          </div>
          <div class="modal-content">
            <h3>Version ${version}</h3>
            
            <div class="section">
              <h4>✨ What's New:</h4>
              <ul>
                ${whatsNewHtml}
              </ul>
            </div>

            <div class="section">
              <h4>🎙️ Features:</h4>
              <ul>
                <li>Real-time speech recognition with microphone detection</li>
                <li>Multi-language support (Vietnamese, English, Chinese, Japanese, Korean, Thai)</li>
                <li>Automatic translation using Google Translate API</li>
                <li>Text-to-speech with voice selection</li>
                <li>Audio level visualization</li>
                <li>Auto-start recording on mic detection</li>
                <li>Transcription history tracking</li>
              </ul>
            </div>

            <div class="tip-box">
              <p class="tip-text">
                💡 Tip: Enable "Auto-Start" to automatically record when the app detects microphone signal.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = this.shadowRoot.querySelector(".modal-overlay");
    const closeBtn = this.shadowRoot.querySelector(".close-btn");

    closeBtn.addEventListener("click", () => this.toggle());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.toggle();
      }
    });
  }

  toggle() {
    const overlay = this.shadowRoot.querySelector(".modal-overlay");
    overlay.classList.toggle("active");
  }

  show() {
    const overlay = this.shadowRoot.querySelector(".modal-overlay");
    overlay.classList.add("active");
  }

  hide() {
    const overlay = this.shadowRoot.querySelector(".modal-overlay");
    overlay.classList.remove("active");
  }
}

// Register the custom element
customElements.define("whats-new-modal", WhatsNewModal);
