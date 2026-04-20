/**
 * AES-256-GCM encryption helpers for post text.
 *
 * Keys are 32-byte (256-bit) random values stored as hex strings in
 * `channelKeys/{channelId}` in Firestore. The IV (initialisation vector)
 * is 12 random bytes stored alongside the ciphertext on each post.
 *
 * Relies on the Web Crypto API (crypto.subtle), available in
 * Hermes/React Native 0.71+ and all modern JS environments.
 */

// ── Encoding helpers ────────────────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Key import helper ───────────────────────────────────────────────────────

async function importKey(keyHex: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const raw = hexToUint8Array(keyHex);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    usage,
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates a random AES-256 key and returns it as a 64-character hex string.
 * This key is stored once per channel in `channelKeys/{channelId}` in Firestore
 * and is only readable by channel members.
 */
export async function generateChannelKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToHex(raw);
}

/**
 * Encrypts `plaintext` using AES-256-GCM with the provided `keyHex`.
 *
 * Returns:
 * - `ciphertext` — base64-encoded encrypted bytes (includes the GCM auth tag)
 * - `iv`         — hex-encoded 12-byte initialisation vector (stored per-post)
 */
export async function encryptText(
  plaintext: string,
  keyHex: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(keyHex, ['encrypt']);
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    encoded,
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToHex(ivBytes.buffer),
  };
}

/**
 * Decrypts `ciphertext` (base64) using AES-256-GCM.
 *
 * Throws if the key or ciphertext is invalid / tampered with.
 */
export async function decryptText(
  ciphertext: string,
  iv: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex, ['decrypt']);
  const ivBytes = hexToUint8Array(iv);
  const cipherBytes = base64ToUint8Array(ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    cipherBytes,
  );

  return new TextDecoder().decode(plainBuffer);
}
