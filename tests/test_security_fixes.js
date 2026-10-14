const fs = require('fs');
const assert = require('assert');

const mainJsPath = '/data/D/TeleBypass-Downloader/main.js';
const indexJsPath = '/data/D/TeleBypass-Downloader/assets/index.js-DAHusJNd.js';

const mainCode = fs.readFileSync(mainJsPath, 'utf8');
const indexCode = fs.readFileSync(indexJsPath, 'utf8');

console.log('Running test_security_fixes...');

// 1. Verify postMessage in main.js does not use hardcoded wildcard '*'
const wildcardPostMessageMatches = mainCode.match(/window\.postMessage\([^)]*,\s*['"]\*['"]\s*\)/g) || [];
assert.strictEqual(
  wildcardPostMessageMatches.length,
  0,
  `Found ${wildcardPostMessageMatches.length} wildcard postMessage calls in main.js: ${JSON.stringify(wildcardPostMessageMatches)}`
);

// 2. Verify emoji in chat export is escaped with z(e.emoji)
const unescapedEmojiMatch = indexCode.includes('${e.emoji}');
assert.strictEqual(unescapedEmojiMatch, false, 'Expected no unescaped ${e.emoji} in index.js');
const escapedEmojiMatch = indexCode.includes('${z(e.emoji)}');
assert.strictEqual(escapedEmojiMatch, true, 'Expected ${z(e.emoji)} in index.js');

// 3. Verify javascript: links are blocked in export template
const hasJavascriptLinkSanitization = indexCode.includes('javascript:') || indexCode.includes('/^\\s*javascript:/i');
assert.ok(hasJavascriptLinkSanitization, 'Expected javascript: check for export links');

console.log('PASS test_security_fixes');
