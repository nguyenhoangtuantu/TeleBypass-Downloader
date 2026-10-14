# TeleBypass Downloader — Memory Leak & Security Vulnerability Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate memory exhaustion (RAM leaks / OOM crashes) during single & batch downloads, fix XSS vulnerabilities in chat exports, and restrict wildcard `postMessage` broadcasts to protect sensitive Telegram media URLs.

**Architecture:** 
- In `main.js`: Introduce an async concurrency queue for batch downloading, immediately revoke Object URLs (3s instead of 60s), safely purge binary buffers on error/completion in `downloadVideo` and `handleDownload`, downscale `audioInstances` retention with proper cleanup, and restrict `postMessage` target origin to `window.location.origin`.
- In `assets/index.js-DAHusJNd.js`: Sanitize reaction emoji with `z(e.emoji)`, enforce URL protocol whitelisting on exported links to prevent stored XSS, and scope `postMessage` targets.

**Tech Stack:** Vanilla JavaScript (ES6+ / Web Extensions Manifest V3), Chrome Extensions API, Node.js test runner for assertions.

**Spec:** Security & Memory audit findings confirmed in conversation (P1.1 - P1.5, P1.6, P2.1 - P2.3).

---

## Global Constraints
- Target platform: Chromium Extension Manifest V3 on `web.telegram.org` (both `/k` and `/a` variants).
- Do not break Telegram Web's internal UI or existing single/batch download flow.
- All modifications must preserve valid syntax in both unbundled `main.js` and minified `assets/index.js-DAHusJNd.js`.

## Review Focus
1. Downloading large single file (1GB+) must not keep chunks in memory after error or save.
2. Batch downloading 20+ items must process via queue (max 2 parallel) rather than firing all simultaneously.
3. Chat export containing `<script>` or event handlers in reaction emoji must render escaped text, not HTML.
4. Export links with `javascript:` pseudo-protocols must be sanitized to `#` or safe fallbacks.
5. `postMessage` must not use wildcard `*` for sensitive media responses.

---

### Task 1: Fix Memory Leaks and Buffer Retention in `main.js`

**Files:**
- Modify: `/data/D/TeleBypass-Downloader/main.js`
- Test: `/data/D/TeleBypass-Downloader/tests/test_memory_fixes.js`

**Interfaces:**
- `saveFile(url, filename)`: Revokes Object URL after 3000ms instead of 60000ms.
- `downloadVideo(url, id, page, download_id, detail)`: Safely resets `blobs = []` in `.catch()` and `.finally()`.
- `handleDownload(url, id, page, download_id, detail)`: Clears `h` and `results` references immediately after `new Blob()`.
- `audioInstances`: Truncate maximum tracked instances to 5 and detach ended audio elements.

- [ ] **Step 1: Write test checking revoke timeout, buffer cleanup, and audioInstances cap**
Create `/data/D/TeleBypass-Downloader/tests/test_memory_fixes.js` to assert:
- `saveFile` timeout is `<= 5000ms`.
- `audioInstances` max length is `<= 10`.
- `blobs` is cleared in `catch` during download error.

- [ ] **Step 2: Run test to verify it fails**
Run: `node /data/D/TeleBypass-Downloader/tests/test_memory_fixes.js`

- [ ] **Step 3: Implement fixes in `main.js`**
- Update `saveFile` and `downloadVideo.saveFile` timeout from `60000` to `3000`.
- In `downloadVideo`, add `blobs = []` in `.catch()` and in cleanup.
- In `handleDownload`, add `h = null` after `m = new Blob(h)`.
- In `hookAudioConstructor`, reduce `audioInstances.length > 80` to `audioInstances.length > 5`, and listen to `audio.addEventListener('ended', () => { ... })` to remove it early.

- [ ] **Step 4: Run test to verify it passes**
Run: `node /data/D/TeleBypass-Downloader/tests/test_memory_fixes.js`

---

### Task 2: Implement Async Concurrency Queue for Batch Downloads in `main.js`

**Files:**
- Modify: `/data/D/TeleBypass-Downloader/main.js:386-398`
- Test: `/data/D/TeleBypass-Downloader/tests/test_batch_queue.js`

**Interfaces:**
- `runBatchQueue(items, concurrency, workerFn)`: Async worker pool that processes items with bounded concurrency (default: 2).

- [ ] **Step 1: Write test for batch queue limiter**
Create `/data/D/TeleBypass-Downloader/tests/test_batch_queue.js` asserting:
- Concurrency never exceeds `2` simultaneous jobs.
- All items in batch complete or report error gracefully.

- [ ] **Step 2: Run test to verify it fails**
Run: `node /data/D/TeleBypass-Downloader/tests/test_batch_queue.js`

- [ ] **Step 3: Implement `runBatchQueue` in `main.js`**
Replace unthrottled `for` loop in `detail.type == 'batch'` with an async pool (concurrency = 2).

- [ ] **Step 4: Run test to verify it passes**
Run: `node /data/D/TeleBypass-Downloader/tests/test_batch_queue.js`

---

### Task 3: Patch Security Holes (`postMessage` Wildcard & Chat Export XSS)

**Files:**
- Modify: `/data/D/TeleBypass-Downloader/main.js`
- Modify: `/data/D/TeleBypass-Downloader/assets/index.js-DAHusJNd.js`
- Test: `/data/D/TeleBypass-Downloader/tests/test_security_fixes.js`

**Interfaces:**
- `respondWithTrackedMediaUrls`: uses `window.location.origin` instead of `'*'`.
- All `window.postMessage` calls in `main.js`: specify target origin `window.location.origin`.
- In `assets/index.js-DAHusJNd.js`:
  - `a.reactions.map(e => ...)` escapes `e.emoji` with `z(e.emoji)`.
  - Link generation sanitizes `e.src` to reject `javascript:` pseudo-protocols.

- [ ] **Step 1: Write test asserting postMessage origin and XSS escaping**
Create `/data/D/TeleBypass-Downloader/tests/test_security_fixes.js` asserting:
- No `postMessage(..., '*')` remains in `main.js`.
- Emoji with `<script>` is sanitized to `&lt;script&gt;`.
- Link with `javascript:alert(1)` is sanitized to `#`.

- [ ] **Step 2: Run test to verify it fails**
Run: `node /data/D/TeleBypass-Downloader/tests/test_security_fixes.js`

- [ ] **Step 3: Apply security patches to `main.js` and `assets/index.js-DAHusJNd.js`**
- Replace wildcard `'*'` with `(window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*')`.
- In `assets/index.js-DAHusJNd.js`:
  - Replace `${e.emoji}` with `${z(e.emoji)}`.
  - In link renderer, sanitize `e.src` (`/^javascript:/i.test(e.src) ? '#' : z(e.src)`).

- [ ] **Step 4: Run test to verify it passes**
Run: `node /data/D/TeleBypass-Downloader/tests/test_security_fixes.js`

---

### Task 4: Full Regression & Bundle Integrity Verification

**Files:**
- Review: `/data/D/TeleBypass-Downloader/manifest.json`
- Review: `/data/D/TeleBypass-Downloader/main.js`
- Review: `/data/D/TeleBypass-Downloader/assets/index.js-DAHusJNd.js`

- [ ] **Step 1: Run all test suites**
Run: `node /data/D/TeleBypass-Downloader/tests/test_memory_fixes.js && node /data/D/TeleBypass-Downloader/tests/test_batch_queue.js && node /data/D/TeleBypass-Downloader/tests/test_security_fixes.js`

- [ ] **Step 2: Verify JavaScript syntax validity with Node syntax check**
Run: `node --check /data/D/TeleBypass-Downloader/main.js && node --check /data/D/TeleBypass-Downloader/assets/index.js-DAHusJNd.js`

- [ ] **Step 3: Commit changes to Git**
Run: `git commit -am "fix: resolve memory leaks, batch concurrency queue, and XSS/postMessage security flaws"`
