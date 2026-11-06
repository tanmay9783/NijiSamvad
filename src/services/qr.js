// src/services/qr.js
// Standards-compliant QR Code SVG generator powered by qrcode
import QRCode from 'qrcode';

/**
 * Generates a clean, standards-compliant QR Code SVG string.
 * @param {string} text - The invite URL or data string
 * @param {number} size - Desired width/height in px
 * @returns {Promise<string>} Clean SVG string
 */
export async function generateQRCodeSVG(text, size = 220) {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR SVG Generation error:', err);
    return '';
  }
}
