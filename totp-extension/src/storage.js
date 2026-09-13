import { deriveKey, encryptJSON, decryptJSON, randomBytes, bytesToB64, exportKeyRaw, importKeyRaw } from "./crypto.js";

const VERIFIER_PLAINTEXT = "gauth-vault-ok";

async function getLocal(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
async function setLocal(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
async function getSession(keys) {
  return new Promise((resolve) => chrome.storage.session.get(keys, resolve));
}
async function setSession(obj) {
  return new Promise((resolve) => chrome.storage.session.set(obj, resolve));
}
async function clearSession() {
  return new Promise((resolve) => chrome.storage.session.clear(resolve));
}

async function isSetUp() {
  const { salt } = await getLocal("salt");
  return !!salt;
}

// First-time setup: choose a master password.
async function setupVault(password) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const verifier = await encryptJSON(key, { check: VERIFIER_PLAINTEXT });
  const vault = await encryptJSON(key, { accounts: [], nextId: 1 });
  await setLocal({
    salt: bytesToB64(salt),
    verifier,
    vault,
  });
  await setSession({ cachedKey: await exportKeyRaw(key) });
  return true;
}

async function unlock(password) {
  const { salt, verifier } = await getLocal(["salt", "verifier"]);
  if (!salt) throw new Error("Vault not set up yet");
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const key = await deriveKey(password, saltBytes);
  try {
    const check = await decryptJSON(key, verifier);
    if (check.check !== VERIFIER_PLAINTEXT) throw new Error("bad");
  } catch {
    throw new Error("Incorrect master password");
  }
  await setSession({ cachedKey: await exportKeyRaw(key) });
  return key;
}

async function getCachedKey() {
  const { cachedKey } = await getSession("cachedKey");
  if (!cachedKey) return null;
  try {
    return await importKeyRaw(cachedKey);
  } catch {
    return null;
  }
}

async function lock() {
  await clearSession();
}

async function requireKey() {
  const key = await getCachedKey();
  if (!key) throw new Error("LOCKED");
  return key;
}

async function readVault(key) {
  const { vault } = await getLocal("vault");
  return decryptJSON(key, vault);
}

async function writeVault(key, vaultObj) {
  const encrypted = await encryptJSON(key, vaultObj);
  await setLocal({ vault: encrypted });
}

async function listAccounts() {
  const key = await requireKey();
  const v = await readVault(key);
  return v.accounts;
}

async function addAccount(entry) {
  const key = await requireKey();
  const v = await readVault(key);
  const id = v.nextId || 1;
  v.accounts.push({ id, ...entry });
  v.nextId = id + 1;
  await writeVault(key, v);
  return id;
}

async function deleteAccount(id) {
  const key = await requireKey();
  const v = await readVault(key);
  v.accounts = v.accounts.filter((a) => a.id !== id);
  await writeVault(key, v);
}

async function updateCounter(id, counter) {
  const key = await requireKey();
  const v = await readVault(key);
  const acc = v.accounts.find((a) => a.id === id);
  if (acc) acc.counter = counter;
  await writeVault(key, v);
}

export {
  isSetUp,
  setupVault,
  unlock,
  lock,
  getCachedKey,
  listAccounts,
  addAccount,
  deleteAccount,
  updateCounter,
};
