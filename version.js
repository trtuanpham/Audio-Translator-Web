/**
 * Application Info Configuration
 */
window.INFO = {
  version: "1.0.7",
  author: "Tuan Pham",
  email: "tr.tuanpham@gmail.com",
  whatsNew: `
- Improved transcription accuracy.
- Enhanced UI responsiveness.
- Fixed minor bugs in translation module.
- Added support for additional languages.
- Fix minize issue on some browsers.
  `,
};

// Keep backward compatibility
window.VERSION = window.INFO.version;
window.WHATS_NEW = window.INFO.whatsNew;
