// Master-password-derived encryption for the local vault.
// Secrets are never written to disk in plaintext; only ciphertext + salt + iv
// live in chrome.storage.local.

const PBKDF2_ITERATIONS = 250_000;

function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function randomBytes(len) {
  return crypto.getRandomValues(new Uint8Array(len));
}

async function deriveKey(password, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable, so we can cache raw bytes in session storage
    ["encrypt", "decrypt"]
  );
}

async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(obj));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(ciphertext)),
  };
}

async function decryptJSON(key, blob) {
  const iv = b64ToBytes(blob.iv);
  const data = b64ToBytes(blob.data);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function exportKeyRaw(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToB64(new Uint8Array(raw));
}

async function importKeyRaw(b64) {
  const raw = b64ToBytes(b64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export { deriveKey, encryptJSON, decryptJSON, randomBytes, bytesToB64, b64ToBytes, exportKeyRaw, importKeyRaw };
