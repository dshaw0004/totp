// Minimal hand-rolled protobuf reader for the Google Authenticator
// otpauth-migration export format. No protobuf dependency needed.
//
// Wire format: tag = varint, tag = (field_number << 3) | wire_type
//   wire_type 0 = varint
//   wire_type 2 = length-delimited (bytes/string/embedded message)

function readVarint(buf, pos) {
  let result = 0n;
  let shift = 0n;
  while (true) {
    const b = buf[pos];
    pos += 1;
    result |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7n;
  }
  return [result, pos];
}

function parseFields(buf) {
  // returns Map<fieldNo, Array<Uint8Array|BigInt>>
  const fields = new Map();
  let pos = 0;
  const n = buf.length;
  while (pos < n) {
    let tag;
    [tag, pos] = readVarint(buf, pos);
    const tagNum = Number(tag);
    const fieldNo = tagNum >> 3;
    const wireType = tagNum & 0x7;

    let val;
    if (wireType === 0) {
      let v;
      [v, pos] = readVarint(buf, pos);
      val = v;
    } else if (wireType === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      const l = Number(len);
      val = buf.slice(pos, pos + l);
      pos += l;
    } else {
      throw new Error(`Unsupported wire_type ${wireType} (field ${fieldNo})`);
    }

    if (!fields.has(fieldNo)) fields.set(fieldNo, []);
    fields.get(fieldNo).push(val);
  }
  return fields;
}

const DIGITS_MAP = { 1: 6, 2: 8 };
const ALGO_MAP = { 0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512", 4: "MD5" };

function bytesToUtf8(bytes) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// Decodes the raw migration payload bytes into an array of entries:
// { secret: Uint8Array, name, issuer, algorithm(int), digits(int), otpType(int), counter(bigint) }
function decodeMigrationPayload(raw) {
  const top = parseFields(raw);
  const entries = [];
  const otpParams = top.get(1) || [];
  for (const otpBytes of otpParams) {
    const f = parseFields(otpBytes);
    const secret = (f.get(1) || [new Uint8Array()])[0];
    const nameBytes = (f.get(2) || [new Uint8Array()])[0];
    const issuerBytes = (f.get(3) || [new Uint8Array()])[0];
    const algorithm = Number((f.get(4) || [1n])[0]);
    const digits = Number((f.get(5) || [1n])[0]);
    const otpType = Number((f.get(6) || [2n])[0]);
    const counter = (f.get(7) || [0n])[0];
    entries.push({
      secret,
      name: bytesToUtf8(nameBytes),
      issuer: bytesToUtf8(issuerBytes),
      algorithm,
      digits,
      otpType,
      counter,
    });
  }
  return entries;
}

export { decodeMigrationPayload, DIGITS_MAP, ALGO_MAP };
