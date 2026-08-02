import { writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "app", "icons");
const sizes = [180, 192, 512];

const palette = {
  background: [7, 21, 21, 255],
  surface: [16, 42, 42, 255],
  gold: [245, 191, 99, 255],
  cream: [244, 242, 233, 255],
  green: [101, 223, 169, 255]
};

for (const size of sizes) {
  const pixels = new Uint8Array(size * size * 4);
  fill(pixels, palette.background);
  drawIcon(pixels, size);
  const png = encodePng(pixels, size, size);
  await writeFile(path.join(outputDirectory, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png`);
}

function drawIcon(pixels, size) {
  const scale = size / 512;
  const unit = (value) => Math.round(value * scale);

  circle(pixels, size, unit(256), unit(256), unit(218), palette.surface);
  ring(pixels, size, unit(256), unit(256), unit(218), unit(9), palette.gold);

  roundedRect(pixels, size, unit(166), unit(126), unit(180), unit(286), unit(50), palette.gold);
  roundedRect(pixels, size, unit(184), unit(145), unit(144), unit(248), unit(38), palette.surface);

  roundedRect(pixels, size, unit(116), unit(172), unit(74), unit(34), unit(13), palette.gold);
  roundedRect(pixels, size, unit(322), unit(172), unit(74), unit(34), unit(13), palette.gold);
  roundedRect(pixels, size, unit(116), unit(306), unit(74), unit(34), unit(13), palette.gold);
  roundedRect(pixels, size, unit(322), unit(306), unit(74), unit(34), unit(13), palette.gold);

  for (const x of [223, 245, 267, 289]) {
    roundedRect(pixels, size, unit(x), unit(173), Math.max(1, unit(4)), unit(182), unit(2), palette.cream);
  }

  for (const [x, y] of [[133, 189], [379, 189], [133, 323], [379, 323]]) {
    circle(pixels, size, unit(x), unit(y), unit(22), palette.green);
    ring(pixels, size, unit(x), unit(y), unit(22), Math.max(1, unit(5)), palette.cream);
  }
}

function fill(pixels, color) {
  for (let index = 0; index < pixels.length; index += 4) {
    pixels.set(color, index);
  }
}

function roundedRect(pixels, width, x, y, rectWidth, rectHeight, radius, color) {
  const right = x + rectWidth - 1;
  const bottom = y + rectHeight - 1;
  const safeRadius = Math.min(radius, Math.floor(rectWidth / 2), Math.floor(rectHeight / 2));

  for (let py = y; py <= bottom; py += 1) {
    for (let px = x; px <= right; px += 1) {
      const nearestX = Math.max(x + safeRadius, Math.min(px, right - safeRadius));
      const nearestY = Math.max(y + safeRadius, Math.min(py, bottom - safeRadius));
      const dx = px - nearestX;
      const dy = py - nearestY;
      if ((dx * dx) + (dy * dy) <= safeRadius * safeRadius) {
        setPixel(pixels, width, px, py, color);
      }
    }
  }
}

function circle(pixels, width, centerX, centerY, radius, color) {
  const radiusSquared = radius * radius;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if ((dx * dx) + (dy * dy) <= radiusSquared) {
        setPixel(pixels, width, x, y, color);
      }
    }
  }
}

function ring(pixels, width, centerX, centerY, radius, thickness, color) {
  const outerSquared = radius * radius;
  const innerRadius = Math.max(0, radius - thickness);
  const innerSquared = innerRadius * innerRadius;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared <= outerSquared && distanceSquared >= innerSquared) {
        setPixel(pixels, width, x, y, color);
      }
    }
  }
}

function setPixel(pixels, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= width) {
    return;
  }
  pixels.set(color, ((y * width) + x) * 4);
}

function encodePng(pixels, width, height) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const destination = y * (width * 4 + 1);
    scanlines[destination] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4)
      .copy(scanlines, destination + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
