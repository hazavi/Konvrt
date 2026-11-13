const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeBmp } = require('../electron/bmp.cjs');

test('BMP stores padded bottom-up BGR rows without losing pixel colors', () => {
  const bmp = encodeBmp(Buffer.from([255,0,0, 0,255,0, 0,0,255, 255,255,255]), 2, 2);
  assert.equal(bmp.toString('ascii', 0, 2), 'BM');
  assert.equal(bmp.length, 70);
  assert.equal(bmp.readUInt32LE(2), bmp.length);
  assert.equal(bmp.readUInt16LE(28), 24);
  assert.deepEqual([...bmp.subarray(54, 62)], [255,0,0, 255,255,255, 0,0]);
  assert.deepEqual([...bmp.subarray(62)], [0,0,255, 0,255,0, 0,0]);
});
