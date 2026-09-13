import { decodeMigrationPayload, DIGITS_MAP, ALGO_MAP } from "./protolite.js";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32FromBytes(bytes) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    let chunk = bits.slice(i, i + 5);
    if (chunk.length < 5) chunk = chunk.padEnd(5, "0");
    out += B32_ALPHABET[parseInt(chunk, 2)];
  }
  return out; // unpadded, matches Python's rstrip("=")
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Accepts a full 'otpauth-migration://offline?data=...' string, or just the
// raw base64 data param. Returns array of:
// { name, issuer, secretB32, algorithm, digits, otpType, counter }
function parseMigrationUri(uriRaw) {
  const uri = uriRaw.trim();
  let dataB64;
  if (uri.startsWith("otpauth-migration://")) {
    const parsed = new URL(uri);
    dataB64 = parsed.searchParams.get("data");
    if (!dataB64) throw new Error("No 'data' parameter found in URI");
  } else {
    dataB64 = uri;
  }
  dataB64 = decodeURIComponent(dataB64);
  // pad to multiple of 4
  dataB64 = dataB64 + "=".repeat((4 - (dataB64.length % 4)) % 4);
  const raw = base64ToBytes(dataB64);

  const entries = decodeMigrationPayload(raw);
  return entries.map((e) => ({
    name: e.name || "(unnamed)",
    issuer: e.issuer || "",
    secretB32: base32FromBytes(e.secret),
    algorithm: ALGO_MAP[e.algorithm] || "SHA1",
    digits: DIGITS_MAP[e.digits] || 6,
    otpType: e.otpType === 1 ? "HOTP" : "TOTP",
    counter: Number(e.counter || 0n),
  }));
}

// Parses a single standard otpauth://totp/... or otpauth://hotp/... URI
// (what most sites give you directly, outside of Google's bulk migration format)
function parseOtpauthUri(uriRaw) {
  const uri = uriRaw.trim();
  const parsed = new URL(uri);
  if (parsed.protocol !== "otpauth:") throw new Error("Not an otpauth:// URI");
  const otpType = parsed.host.toLowerCase() === "hotp" ? "HOTP" : "TOTP";
  const label = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  let issuer = parsed.searchParams.get("issuer") || "";
  let name = label;
  if (label.includes(":")) {
    const [maybeIssuer, rest] = label.split(":", 2);
    if (!issuer) issuer = maybeIssuer;
    name = rest;
  }
  const secretB32 = (parsed.searchParams.get("secret") || "").toUpperCase();
  if (!secretB32) throw new Error("No 'secret' parameter found in URI");
  const digits = parseInt(parsed.searchParams.get("digits") || "6", 10);
  const algorithm = (parsed.searchParams.get("algorithm") || "SHA1").toUpperCase();
  const counter = parseInt(parsed.searchParams.get("counter") || "0", 10);

  return [{ name, issuer, secretB32, algorithm, digits, otpType, counter }];
}

export { parseMigrationUri, parseOtpauthUri, base32FromBytes };
