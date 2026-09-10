// src/services/crypto.js

// Generate a cryptographically secure random room secret using Web Crypto
export const generateSecureRoomSecret = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const randomValues = new Uint32Array(24);
  crypto.getRandomValues(randomValues);
  let secret = '';
  for (let i = 0; i < 24; i++) {
    secret += chars.charAt(randomValues[i] % chars.length);
  }
  return secret;
};

// Generate a visually verifiable fingerprint (like WhatsApp/Signal safety numbers)
export const generateRoomFingerprint = async (roomName, secret) => {
  if (!secret) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(roomName + ':' + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 24).match(/.{1,4}/g).join(' ').toUpperCase();
};

export const deriveKeys = async (secret, roomName) => {
  if (!secret) return null;
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const saltEnc = encoder.encode("encryption_salt_" + roomName);
  const saltAuth = encoder.encode("auth_salt_" + roomName);

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltEnc,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const authBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltAuth,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  const authHash = Array.from(new Uint8Array(authBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return { encryptionKey, authHash };
};

export const generateIv = () => {
  return crypto.getRandomValues(new Uint8Array(12));
};

export const encryptMessage = async (message, key) => {
  if (!key) throw new Error("Key is required for encryption");
  
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);
  const iv = generateIv();
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encoded
  );

  const ivArray = Array.from(iv);
  const ciphertextArray = Array.from(new Uint8Array(ciphertextBuffer));
  
  return JSON.stringify({
    iv: btoa(String.fromCharCode.apply(null, ivArray)),
    ciphertext: btoa(String.fromCharCode.apply(null, ciphertextArray))
  });
};

export const decryptMessage = async (payloadStr, key) => {
  if (!key) throw new Error("Key is required for decryption");
  
  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch (e) {
    throw new Error("Invalid message format");
  }

  if (!payload.iv || !payload.ciphertext) {
    throw new Error("Invalid message format");
  }

  const ivArray = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const ciphertextArray = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivArray
    },
    key,
    ciphertextArray
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};

export const encryptAttachment = async (fileBlob) => {
  const attachmentKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  const iv = generateIv();
  const fileBuffer = await fileBlob.arrayBuffer();
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    attachmentKey,
    fileBuffer
  );

  const exportedKey = await crypto.subtle.exportKey("raw", attachmentKey);
  const keyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(exportedKey)));
  const ivBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(iv)));
  
  return {
    ciphertextBlob: new Blob([ciphertextBuffer], { type: 'application/octet-stream' }),
    attachmentKeyStr: keyBase64,
    ivStr: ivBase64
  };
};

export const decryptAttachment = async (ciphertextBlob, attachmentKeyStr, ivStr) => {
  const keyArray = Uint8Array.from(atob(attachmentKeyStr), c => c.charCodeAt(0));
  const ivArray = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));

  const attachmentKey = await crypto.subtle.importKey(
    "raw",
    keyArray,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const ciphertextBuffer = await ciphertextBlob.arrayBuffer();

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivArray },
    attachmentKey,
    ciphertextBuffer
  );

  return new Blob([decryptedBuffer]); // Intentionally opaque blob, UI can set type
};
