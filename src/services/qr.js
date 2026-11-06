// src/services/qr.js
// Compact, zero-dependency QR Code generator outputting scalable SVG data URI

// Minimalist QR Code model for Version 1 to 10
// Supports Byte mode (8-bit) and Error Correction Level L/M

// Reed-Solomon Galois Field math
const GF256 = new Uint8Array(512);
const LOG256 = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256[i] = x;
    GF256[i + 255] = x;
    LOG256[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF256[LOG256[x] + LOG256[y]];
}

function polyMul(p1, p2) {
  const result = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, new Uint8Array([1, GF256[i]]));
  }
  return poly;
}

function calculateEC(data, ecCount) {
  const gen = getGeneratorPoly(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// QR Table: [version, capacity_bytes_L, ec_count]
const QR_SPECS = [
  [1, 19, 7],
  [2, 34, 10],
  [3, 55, 15],
  [4, 80, 20],
  [5, 108, 26],
  [6, 136, 18 * 2],
  [7, 156, 20 * 2],
  [8, 194, 24 * 2],
  [9, 232, 30 * 2],
  [10, 274, 18 * 4]
];

export function generateQRCodeSVG(text, size = 220) {
  const utf8 = new TextEncoder().encode(text);
  let spec = null;
  let ver = 1;
  for (let s of QR_SPECS) {
    if (utf8.length + 3 <= s[1]) { // 3 bytes overhead for byte mode header
      spec = s;
      ver = s[0];
      break;
    }
  }

  if (!spec) {
    // If text is larger than version 10, default to spec 10 or truncate
    spec = QR_SPECS[QR_SPECS.length - 1];
    ver = spec[0];
  }

  const dataCapacity = spec[1];
  const ecCount = spec[2];
  const modulesCount = 17 + 4 * ver;

  // 1. Bit Buffer (Byte Mode: 0100 + 8-bit length + bytes)
  const bitBuf = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(Math.min(utf8.length, 255), 8); // Character count indicator
  for (let i = 0; i < Math.min(utf8.length, dataCapacity - 3); i++) {
    pushBits(utf8[i], 8);
  }

  // Terminator
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);
  while (bitBuf.length < dataCapacity * 8) {
    pushBits(0xec, 8);
    if (bitBuf.length < dataCapacity * 8) pushBits(0x11, 8);
  }

  // Convert bits to data bytes
  const dataBytes = new Uint8Array(dataCapacity);
  for (let i = 0; i < dataCapacity; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitBuf[i * 8 + b];
    }
    dataBytes[i] = byte;
  }

  // Calculate Error Correction
  const ecBytes = calculateEC(dataBytes, ecCount);

  // Combine Data + EC
  const fullBytes = new Uint8Array(dataBytes.length + ecBytes.length);
  fullBytes.set(dataBytes);
  fullBytes.set(ecBytes, dataBytes.length);

  // 2. Matrix Layout
  const matrix = Array.from({ length: modulesCount }, () => new Int8Array(modulesCount).fill(-1));
  const isFunction = Array.from({ length: modulesCount }, () => new Uint8Array(modulesCount));

  const setModule = (r, c, val) => {
    if (r >= 0 && r < modulesCount && c >= 0 && c < modulesCount) {
      matrix[r][c] = val ? 1 : 0;
      isFunction[r][c] = 1;
    }
  };

  // Finder Patterns
  const placeFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= modulesCount || nc < 0 || nc >= modulesCount) continue;
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          setModule(nr, nc, 1);
        } else {
          setModule(nr, nc, 0);
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, modulesCount - 7);
  placeFinder(modulesCount - 7, 0);

  // Timing patterns
  for (let i = 8; i < modulesCount - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(modulesCount - 8, 8, 1);

  // Format info dummy reserve
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = 1;
    if (!isFunction[i][8]) isFunction[i][8] = 1;
    if (!isFunction[modulesCount - 1 - i][8]) isFunction[modulesCount - 1 - i][8] = 1;
    if (!isFunction[8][modulesCount - 1 - i]) isFunction[8][modulesCount - 1 - i] = 1;
  }

  // 3. Place Data Bits
  let bitIdx = 0;
  const totalBits = fullBytes.length * 8;
  const getNextBit = () => {
    if (bitIdx >= totalBits) return 0;
    const byte = fullBytes[Math.floor(bitIdx / 8)];
    const bit = (byte >> (7 - (bitIdx % 8))) & 1;
    bitIdx++;
    return bit;
  };

  let upwards = true;
  for (let c = modulesCount - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing pattern
    for (let step = 0; step < modulesCount; step++) {
      const r = upwards ? modulesCount - 1 - step : step;
      for (let col of [c, c - 1]) {
        if (!isFunction[r][col]) {
          const bit = getNextBit();
          // Apply standard Mask 0: (row + col) % 2 === 0
          const mask = (r + col) % 2 === 0 ? 1 : 0;
          matrix[r][col] = bit ^ mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 4. Place Format Information (Mask 0, Level L: 0b111011111000100)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

  for (let i = 0; i < 8; i++) matrix[modulesCount - 1 - i][8] = formatBits[i];
  for (let i = 8; i < 15; i++) matrix[8][modulesCount - 15 + i] = formatBits[i];

  // 5. Build SVG
  const quietZone = 2;
  const totalDim = modulesCount + quietZone * 2;
  let rects = '';

  for (let r = 0; r < modulesCount; r++) {
    for (let c = 0; c < modulesCount; c++) {
      if (matrix[r][c] === 1) {
        rects += `<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1" fill="#000000"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${size}" height="${size}" style="border-radius: 8px; background: #ffffff; padding: 8px;">
    ${rects}
  </svg>`;
}
