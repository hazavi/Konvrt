// Encode an uncompressed 24-bit BMP. Sharp supplies RGB pixels and handles resizing.
function encodeBmp(data, width, height) {
  const stride = Math.ceil(width * 3 / 4) * 4;
  const size = 54 + stride * height;
  if (!Number.isSafeInteger(size) || size > 512 * 1024 * 1024) throw new Error('BMP output exceeds 512 MB. Choose smaller dimensions.');
  const output = Buffer.alloc(size);
  output.write('BM');
  output.writeUInt32LE(size, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 3;
      const target = 54 + (height - 1 - y) * stride + x * 3;
      output[target] = data[source + 2];
      output[target + 1] = data[source + 1];
      output[target + 2] = data[source];
    }
  }
  return output;
}

async function writeBmp(image, output) {
  const { data, info } = await image.flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await require('node:fs/promises').writeFile(output, encodeBmp(data, info.width, info.height));
}
module.exports = { encodeBmp, writeBmp };
