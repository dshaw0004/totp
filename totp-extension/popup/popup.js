import * as storage from "../src/storage.js";
import { totp, secondsRemaining } from "../src/otp.js";
import { parseMigrationUri, parseOtpauthUri } from "../src/migrate.js";

const app = document.getElementById("app");
const lockBtn = document.getElementById("lockBtn");

let refreshTimer = null;

lockBtn.addEventListener("click", async () => {
  await storage.lock();
  clearInterval(refreshTimer);
  render();
});

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

async function getPendingScan() {
  return new Promise((resolve) => {
    chrome.storage.session.get("pendingScan", (r) => resolve(r.pendingScan || null));
  });
}
async function clearPendingScan() {
  chrome.runtime.sendMessage({ type: "CLEAR_PENDING_SCAN" });
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

async function render() {
  clearInterval(refreshTimer);
  const setUp = await storage.isSetUp();
  if (!setUp) {
    lockBtn.hidden = true;
    return renderSetup();
  }
  const key = await storage.getCachedKey();
  if (!key) {
    lockBtn.hidden = true;
    return renderUnlock();
  }
  lockBtn.hidden = false;
  return renderMain();
}

function renderSetup() {
  app.innerHTML = "";
  app.appendChild(
    el(`
    <div>
      <p>First time setup — choose a master password. It encrypts everything
      stored by this extension; there's no recovery if you forget it.</p>
      <div class="field">
        <label>Master password</label>
        <input type="password" id="pw1" />
      </div>
      <div class="field">
        <label>Confirm password</label>
        <input type="password" id="pw2" />
      </div>
      <div id="msg"></div>
      <button class="btn" id="setupBtn">Create vault</button>
    </div>
  `)
  );
  document.getElementById("setupBtn").addEventListener("click", async () => {
    const pw1 = document.getElementById("pw1").value;
    const pw2 = document.getElementById("pw2").value;
    const msg = document.getElementById("msg");
    if (pw1.length < 8) {
      msg.innerHTML = `<p class="error">Use at least 8 characters.</p>`;
      return;
    }
    if (pw1 !== pw2) {
      msg.innerHTML = `<p class="error">Passwords don't match.</p>`;
      return;
    }
    await storage.setupVault(pw1);
    render();
  });
}

function renderUnlock() {
  app.innerHTML = "";
  app.appendChild(
    el(`
    <div>
      <div class="field">
        <label>Master password</label>
        <input type="password" id="pw" />
      </div>
      <div id="msg"></div>
      <button class="btn" id="unlockBtn">Unlock</button>
    </div>
  `)
  );
  const pwInput = document.getElementById("pw");
  const doUnlock = async () => {
    const msg = document.getElementById("msg");
    try {
      await storage.unlock(pwInput.value);
      render();
    } catch (e) {
      msg.innerHTML = `<p class="error">${e.message}</p>`;
    }
  };
  document.getElementById("unlockBtn").addEventListener("click", doUnlock);
  pwInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doUnlock();
  });
  pwInput.focus();
}

async function renderMain() {
  app.innerHTML = "";

  const pending = await getPendingScan();
  if (pending) {
    if (pending.text) {
      return renderConfirmAdd(pending.text, { fromPending: true });
    } else if (pending.error) {
      app.appendChild(el(`<p class="error">${pending.error}</p>`));
      await clearPendingScan();
    }
  }

  const container = el(`
    <div>
      <div class="row">
        <button class="btn" id="addNewBtn">+ Add new</button>
        <button class="btn secondary" id="manualBtn">Manual entry</button>
      </div>
      <div id="addStatus"></div>
      <ul class="account-list" id="accountList"></ul>
    </div>
  `);
  app.appendChild(container);

  document.getElementById("addNewBtn").addEventListener("click", onAddNewClick);
  document.getElementById("manualBtn").addEventListener("click", () => renderManualForm());

  await renderAccountList();
}

async function onAddNewClick() {
  const status = document.getElementById("addStatus");
  status.innerHTML = `<p class="muted">Scanning visible tab…</p>`;
  chrome.runtime.sendMessage({ type: "SCAN_VISIBLE_TAB" }, async (resp) => {
    if (!resp || !resp.ok) {
      status.innerHTML = `<p class="error">Scan failed: ${resp ? resp.error : "no response"}</p>`;
      return;
    }
    if (resp.text) {
      renderConfirmAdd(resp.text, { fromPending: false });
      return;
    }
    status.innerHTML = el(`<div></div>`).outerHTML;
    status.innerHTML = "";
    status.appendChild(
      el(`
      <div>
        <p class="muted">No QR code found on the visible part of this tab.</p>
        <button class="btn secondary" id="selectRegionBtn">Select region on page…</button>
        <p class="scan-hint">Draw a box around the QR code on the page. This closes the popup — reopen the extension after selecting.</p>
      </div>
    `)
    );
    document.getElementById("selectRegionBtn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "START_REGION_SELECT" }, () => {
        window.close();
      });
    });
  });
}

function renderConfirmAdd(rawText, { fromPending }) {
  app.innerHTML = "";
  let entries = [];
  let parseError = null;
  try {
    if (rawText.startsWith("otpauth-migration://")) {
      entries = parseMigrationUri(rawText);
    } else if (rawText.startsWith("otpauth://")) {
      entries = parseOtpauthUri(rawText);
    } else {
      // Some exports hand you just the base64 data param
      entries = parseMigrationUri(rawText);
    }
  } catch (e) {
    parseError = e.message;
  }

  if (parseError || entries.length === 0) {
    app.appendChild(
      el(`
      <div>
        <p class="error">Found a QR code, but couldn't parse it as an authenticator code${
          parseError ? `: ${parseError}` : ""
        }.</p>
        <button class="btn secondary" id="backBtn">Back</button>
      </div>
    `)
    );
    document.getElementById("backBtn").addEventListener("click", async () => {
      if (fromPending) await clearPendingScan();
      render();
    });
    return;
  }

  const list = entries
    .map(
      (e, i) => `
    <div class="account" style="align-items:flex-start">
      <div class="account-info">
        <span class="account-name">${escapeHtml(e.name)}</span>
        <span class="account-issuer">${escapeHtml(e.issuer || "")} · ${e.otpType}, ${e.digits} digits, ${e.algorithm}</span>
      </div>
    </div>
  `
    )
    .join("");

  app.appendChild(
    el(`
    <div>
      <p>Found ${entries.length} account${entries.length > 1 ? "s" : ""}:</p>
      <div>${list}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn secondary" id="cancelAddBtn">Cancel</button>
        <button class="btn" id="confirmAddBtn">Save ${entries.length > 1 ? "all" : ""}</button>
      </div>
    </div>
  `)
  );

  document.getElementById("cancelAddBtn").addEventListener("click", async () => {
    if (fromPending) await clearPendingScan();
    render();
  });
  document.getElementById("confirmAddBtn").addEventListener("click", async () => {
    for (const e of entries) {
      await storage.addAccount({
        name: e.name,
        issuer: e.issuer,
        secretB32: e.secretB32,
        algorithm: e.algorithm,
        digits: e.digits,
        otpType: e.otpType,
        counter: e.counter || 0,
      });
    }
    if (fromPending) await clearPendingScan();
    render();
  });
}

function renderManualForm() {
  app.innerHTML = "";
  app.appendChild(
    el(`
    <div>
      <div class="field">
        <label>Account name</label>
        <input id="mName" placeholder="alice@example.com" />
      </div>
      <div class="field">
        <label>Issuer (optional)</label>
        <input id="mIssuer" placeholder="Example Co" />
      </div>
      <div class="field">
        <label>Secret key</label>
        <input id="mSecret" placeholder="JBSW Y3DP EHPK 3PXP" />
      </div>
      <div class="row">
        <div class="field">
          <label>Type</label>
          <select id="mType">
            <option value="TOTP">Time-based (TOTP)</option>
            <option value="HOTP">Counter-based (HOTP)</option>
          </select>
        </div>
        <div class="field">
          <label>Digits</label>
          <select id="mDigits">
            <option value="6" selected>6</option>
            <option value="8">8</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Algorithm</label>
        <select id="mAlgo">
          <option value="SHA1" selected>SHA1</option>
          <option value="SHA256">SHA256</option>
          <option value="SHA512">SHA512</option>
        </select>
      </div>
      <div id="mMsg"></div>
      <div class="row">
        <button class="btn secondary" id="mCancel">Cancel</button>
        <button class="btn" id="mSave">Save</button>
      </div>
    </div>
  `)
  );

  document.getElementById("mCancel").addEventListener("click", render);
  document.getElementById("mSave").addEventListener("click", async () => {
    const msg = document.getElementById("mMsg");
    const name = document.getElementById("mName").value.trim();
    const issuer = document.getElementById("mIssuer").value.trim();
    const secretB32 = document.getElementById("mSecret").value.trim().replace(/\s+/g, "").toUpperCase();
    const otpType = document.getElementById("mType").value;
    const digits = parseInt(document.getElementById("mDigits").value, 10);
    const algorithm = document.getElementById("mAlgo").value;

    if (!name || !secretB32) {
      msg.innerHTML = `<p class="error">Name and secret key are required.</p>`;
      return;
    }
    try {
      await totp(secretB32, { digits, algorithm }); // validates the secret decodes cleanly
    } catch (e) {
      msg.innerHTML = `<p class="error">Invalid secret key: ${e.message}</p>`;
      return;
    }
    await storage.addAccount({ name, issuer, secretB32, algorithm, digits, otpType, counter: 0 });
    render();
  });
}

async function renderAccountList() {
  const listEl = document.getElementById("accountList");
  const accounts = await storage.listAccounts();
  if (accounts.length === 0) {
    listEl.innerHTML = `<p class="muted">No accounts yet. Add one above.</p>`;
    return;
  }

  listEl.innerHTML = "";
  const codeCells = new Map();

  for (const acc of accounts) {
    const li = el(`
      <li class="account">
        <div class="account-info">
          <span class="account-name">${escapeHtml(acc.name)}</span>
          <span class="account-issuer">${escapeHtml(acc.issuer || "")}</span>
        </div>
        <div class="account-actions">
          <span class="timer-ring" data-timer></span>
          <span class="account-code" data-code>${acc.otpType === "HOTP" ? "●●●●●●" : "------"}</span>
          ${
            acc.otpType === "HOTP"
              ? `<button class="btn small" data-gen>Gen</button>`
              : ""
          }
          <button class="del-btn" title="Delete" data-del>&times;</button>
        </div>
      </li>
    `);
    listEl.appendChild(li);
    codeCells.set(acc.id, li);

    li.querySelector("[data-del]").addEventListener("click", async () => {
      await storage.deleteAccount(acc.id);
      renderAccountList();
    });

    if (acc.otpType === "HOTP") {
      li.querySelector("[data-gen]").addEventListener("click", async () => {
        const { hotp } = await import("../src/otp.js");
        const code = await hotp(acc.secretB32, acc.counter, { digits: acc.digits, algorithm: acc.algorithm });
        li.querySelector("[data-code]").textContent = code;
        await storage.updateCounter(acc.id, acc.counter + 1);
        acc.counter += 1;
      });
    }
  }

  async function refreshTotp() {
    for (const acc of accounts) {
      if (acc.otpType === "HOTP") continue;
      const li = codeCells.get(acc.id);
      if (!li) continue;
      const code = await totp(acc.secretB32, { digits: acc.digits, algorithm: acc.algorithm });
      li.querySelector("[data-code]").textContent = code;
      li.querySelector("[data-timer]").textContent = `${secondsRemaining(30)}s`;
    }
  }

  await refreshTotp();
  refreshTimer = setInterval(refreshTotp, 1000);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

render();
