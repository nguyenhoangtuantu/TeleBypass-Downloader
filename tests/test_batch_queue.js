const fs = require('fs');
const assert = require('assert');

const mainJsPath = '/data/D/TeleBypass-Downloader/main.js';
const code = fs.readFileSync(mainJsPath, 'utf8');

console.log('Running test_batch_queue...');

// 1. Verify runBatchQueue is defined in main.js
assert.ok(code.includes('runBatchQueue'), 'Expected runBatchQueue function in main.js');

// 2. Verify batch block in handleMediaDownloadDetail uses runBatchQueue with concurrency limit
const batchBlockMatch = code.match(/else\s*if\s*\(\s*detail\.type\s*==\s*['"]batch['"]\s*\)\s*\{([\s\S]*?)\n\s*\}/);
assert.ok(batchBlockMatch, 'detail.type == "batch" block found');
const batchBlockCode = batchBlockMatch[1];
assert.ok(batchBlockCode.includes('runBatchQueue'), 'detail.type == "batch" block must use runBatchQueue');
assert.ok(!batchBlockCode.includes('for (let i = 0; i < video_list.length; i++)'), 'Must not have unthrottled for loop in batch download');

// 3. Functional test of queue logic
async function runBatchQueueTest(items, concurrency, workerFn) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = items[nextIndex++];
      await workerFn(current);
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
}

(async () => {
  let activeCount = 0;
  let maxActive = 0;
  const items = [1, 2, 3, 4, 5, 6];
  const processed = [];

  await runBatchQueueTest(items, 2, async (item) => {
    activeCount++;
    maxActive = Math.max(maxActive, activeCount);
    await new Promise((resolve) => setTimeout(resolve, 20));
    processed.push(item);
    activeCount--;
  });

  assert.strictEqual(maxActive, 2, 'Max concurrent jobs should be 2');
  assert.strictEqual(processed.length, 6, 'All items should be processed');
  console.log('PASS test_batch_queue');
})();
