const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBytes(b32: string) {
  const clean = b32.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = "";
  for (const c of clean) {
    const idx = B32_ALPHABET.indexOf(c);
    if (idx === -1) throw new Error(`Invalid base32 character: ${c}`);
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

const ALGO_TO_WEBCRYPTO = {
  SHA1: "SHA-1",
  SHA256: "SHA-256",
  SHA512: "SHA-512",
};

async function hmac(algorithm: string, keyBytes, msgBytes) {
  const hashName = ALGO_TO_WEBCRYPTO[algorithm] || "SHA-1";
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: hashName },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

function counterToBytes(counter) {
  // 8-byte big-endian counter
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // JS numbers are safe ints up to 2^53; counters realistically never get near that
  const big = BigInt(counter);
  view.setBigUint64(0, big, false);
  return new Uint8Array(buf);
}

function truncate(hmacBytes, digits) {
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binCode =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binCode % mod).padStart(digits, "0");
}

async function hotp(secretB32, counter, { digits = 6, algorithm = "SHA1" } = {}) {
  const key = base32ToBytes(secretB32);
  const msg = counterToBytes(counter);
  const digest = await hmac(algorithm, key, msg);
  return truncate(digest, digits);
}

async function totp(
  secretB32,
  { digits = 6, algorithm = "SHA1", period = 30, timestamp = Date.now() } = {}
) {
  const counter = Math.floor(timestamp / 1000 / period);
  return hotp(secretB32, counter, { digits, algorithm });
}

function secondsRemaining(period = 30, timestamp = Date.now()) {
  const secs = Math.floor(timestamp / 1000);
  return period - (secs % period);
}

export { totp, hotp, base32ToBytes, secondsRemaining };
