<div align="center">

<img src="./src/assets/icon_128.png" alt="TeleBypass Downloader Logo" width="96" height="96" />

# TeleBypass Downloader

### ⚡ Download Restricted & Protected Media from Telegram Web (K & A)

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success?style=for-the-badge&logo=googlechrome&logoColor=white)](manifest.json)
[![Platform Telegram Web](https://img.shields.io/badge/Telegram_Web-K_%26_A-0088cc?style=for-the-badge&logo=telegram&logoColor=white)](https://web.telegram.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nguyenhoangtuantu/TeleBypass-Downloader?style=for-the-badge&color=ffd700)](https://github.com/nguyenhoangtuantu/TeleBypass-Downloader/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](https://github.com/nguyenhoangtuantu/TeleBypass-Downloader/pulls)

**[ English ](README.md)** • **[ Tiếng Việt ](README_VI.md)**

*A fast, secure, and lightweight Chromium extension to save videos, photos, audio, and documents from private and restricted Telegram channels & groups where "Saving content prohibited" is enabled.*

</div>

---

## 💡 Why TeleBypass Downloader?

Have you ever tried to save an important video, lecture, or file on Telegram, only to be blocked by:
> **"Saving content is prohibited by channel admins"** or disabled forwarding?

**TeleBypass Downloader** solves this cleanly in your browser. It integrates native download buttons directly into the Telegram Web interface, letting you download original quality media without sending your phone number or account credentials to random third-party Telegram bots.

---

## ✨ Key Features

- 🔓 **Bypass Content Protection:** Download media from private channels and groups with "Saving content prohibited" or forwarding restrictions enabled.
- ⚡ **Batch Downloading with Concurrency Limiter:** Download multiple files in a batch with a built-in async queue (max 2 parallel workers) to prevent memory overload and browser crashes.
- 🎯 **Seamless In-Page UI:** Clean download buttons right on the video player and media cards on both **Telegram Web K** (`web.telegram.org/k`) and **Telegram Web A** (`web.telegram.org/a`).
- 🛡️ **100% Client-Side & Private:**
  - Zero server calls or external backends.
  - Zero token or credential harvesting.
  - Runs strictly in your local browser sandbox.
- 🧠 **Smart Memory Management:** Instant blob revoking (within 3 seconds) and safe buffer disposal to keep RAM usage low even on 1GB+ large video downloads.
- 💬 **Export Chat Media & History:** Archive chat media and conversation backups with XSS-sanitized outputs.
- 🌍 **Internationalization (i18n):** Supports 50+ languages natively.

---

## 📊 Comparison: TeleBypass vs. Other Solutions

| Feature | TeleBypass Downloader | Telegram Download Bots | External Web Tools |
| :--- | :---: | :---: | :---: |
| **Account Safety** | ✅ **100% Safe (Local Browser)** | ⚠️ Requires Session/Token | ❌ Risky Ads / Data Theft |
| **Restricted Channel Support** | ✅ **Instant One-Click** | ⚠️ Complex Setup / Limits | ❌ Often Unsupported |
| **Download Speed** | 🚀 **Direct Telegram CDN** | 🐢 Queue & Server Throttling | 🐢 Slow Third-Party Servers |
| **Max File Size** | 📦 **Browser-handled** | ⚠️ 20MB - 50MB Bot Limits | ⚠️ Strict File Caps |
| **Open Source** | ✅ **100% Open Source** | ❌ Closed Source | ❌ Closed Source |

---

## 🚀 Quick Start & Installation

You can install TeleBypass Downloader on any Chromium-based browser (**Google Chrome, Brave, Microsoft Edge, Opera, Cốc Cốc, Kiwi Browser** on Android):

### Step 1: Download the Extension
Clone the repository:
```bash
git clone https://github.com/nguyenhoangtuantu/TeleBypass-Downloader.git
```
*(Or click the green **Code** button at the top right of this repo and select **Download ZIP**, then unzip it to a folder).*

### Step 2: Load into Chromium Browser
1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/` on MS Edge).
2. Toggle on **Developer mode** in the top right corner.
3. Click the **Load unpacked** button in the top left corner.
4. Select the extracted `TeleBypass-Downloader` folder.

### Step 3: Start Downloading!
1. Open [web.telegram.org/k](https://web.telegram.org/k) or [web.telegram.org/a](https://web.telegram.org/a).
2. Navigate to any private channel or group.
3. You will see direct **Download** buttons attached to media items. Click to save instantly!

---

## 🛠️ How It Works Under The Hood

Telegram Web renders media in the browser using the standard HTML5 `<video>`, `<audio>`, and Web Worker / IndexedDB caching pipeline. When a channel restricts downloads, Telegram simply hides the UI context menu and forward button via frontend CSS/JS guards.

**TeleBypass Downloader** works by:
1. Intercepting the decrypted in-memory stream buffer from the active Telegram Web session.
2. Re-assembling the media chunks client-side via a controlled async queue.
3. Triggering a native browser file download using ephemeral Object URLs without leaking memory or exposing sensitive tokens.

---

## 🧪 Testing & Verification

TeleBypass Downloader includes automated regression tests for memory safety, concurrency bounding, and XSS sanitization:

```bash
# Run test suite
node tests/test_memory_fixes.js
node tests/test_batch_queue.js
node tests/test_security_fixes.js
```

---

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome!

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'feat: add AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## ⚠️ Disclaimer

This tool is created for **personal backup, accessibility, and educational purposes only**. Please respect copyright laws and the terms of service of content creators and Telegram. The maintainers are not responsible for any misuse of this tool.

---

## ⭐ Support & Star

If this tool saved your time, please consider giving it a **Star ⭐**! It helps the project reach more users who are looking for a reliable solution.

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=nguyenhoangtuantu/TeleBypass-Downloader&type=Date)](https://star-history.com/#nguyenhoangtuantu/TeleBypass-Downloader&Date)

</div>
