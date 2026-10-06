const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { processFile } = require('../electron/converter.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'konvrt-image-options-'));
const input = path.join(dir, 'source.png');

after(() => {
  for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name));
  fs.rmdirSync(dir);
});

async function convert(format, imageOptions) {
  return processFile({ filePath: input, outputDir: dir, format, quality: 80, mode: 'convert', imageOptions }, () => {});
}

test('image dimensions are preserved unless a size is selected', async () => {
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ff0000' } }).png().toFile(input);
  const output = await convert('webp');
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
});

test('crop and max fit apply the requested bounds', async () => {
  const crop = await convert('png', { width: 64, height: 32, fit: 'crop' });
  const cropMetadata = await sharp(crop).metadata();
  assert.deepEqual([cropMetadata.width, cropMetadata.height], [64, 32]);

  const max = await convert('png', { width: 1024, height: 1024, fit: 'max' });
  const maxMetadata = await sharp(max).metadata();
  assert.deepEqual([maxMetadata.width, maxMetadata.height], [512, 512]);
});

test('ICO defaults to a 256 px frame and accepts an exact selected size', async () => {
  const defaultIco = fs.readFileSync(await convert('ico'));
  assert.equal(defaultIco.readUInt16LE(4), 6);
  assert.equal(defaultIco.readUInt8(6), 0); // ICO encodes 256 as zero.

  const selectedIco = fs.readFileSync(await convert('ico', { width: 64, height: 64, fit: 'scale' }));
  assert.equal(selectedIco.readUInt16LE(4), 1);
  assert.deepEqual([selectedIco.readUInt8(6), selectedIco.readUInt8(7)], [64, 64]);
});
