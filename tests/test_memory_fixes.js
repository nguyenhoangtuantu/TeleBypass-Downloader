const fs = require('fs');
const assert = require('assert');

const mainJsPath = '/data/D/TeleBypass-Downloader/main.js';
const code = fs.readFileSync(mainJsPath, 'utf8');

console.log('Running test_memory_fixes...');

// 1. Verify revokeObjectURL timeout is <= 5000ms (not 60000ms)
const has60sTimeout = /setTimeout\s*\(\s*\(\)\s*=>\s*\{[^}]*revokeObjectURL[^}]*\}\s*,\s*60000\s*\)/s.test(code) || code.includes('60000');
assert.strictEqual(has60sTimeout, false, 'Expected no 60000ms delay for revokeObjectURL (should be <= 5000ms)');

// 2. Verify audioInstances cap is <= 10 (not 80)
const has80Cap = /audioInstances\.length\s*>\s*80/.test(code);
assert.strictEqual(has80Cap, false, 'Expected audioInstances cap to be <= 10, not 80');

const hasSmallCap = /audioInstances\.length\s*>\s*([1-9]|10)\b/.test(code);
assert.strictEqual(hasSmallCap, true, 'Expected audioInstances cap to be <= 10');

// 3. Verify downloadVideo cleans up blobs in catch/finally
const downloadVideoMatch = code.match(/const downloadVideo =[\s\S]*?fetchNextPart\(\);[\s\S]*?\};/);
assert.ok(downloadVideoMatch, 'downloadVideo function found');
const downloadVideoCode = downloadVideoMatch[0];
const hasCatchBlobsCleanup = /\.catch\s*\([^)]*\)\s*=>\s*\{[\s\S]*?blobs\s*=\s*\[\s*\]/m.test(downloadVideoCode);
assert.strictEqual(hasCatchBlobsCleanup, true, 'downloadVideo must clear blobs in catch block on error');

console.log('PASS test_memory_fixes');
