import jsQR from "./lib/jsQR.esm.js";

// --- decode helpers -------------------------------------------------------

async function dataUrlToImageData(dataUrl, cropRect) {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);

  const rect = cropRect || { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return ctx.getImageData(0, 0, rect.width, rect.height);
}

async function decodeQrFromDataUrl(dataUrl, cropRect) {
  const imageData = await dataUrlToImageData(dataUrl, cropRect);
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  return result ? result.data : null;
}

function captureVisibleTab(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(dataUrl);
    });
  });
}

async function setPendingScan(payload) {
  await chrome.storage.session.set({ pendingScan: payload });
  chrome.action.setBadgeText({ text: payload?.text ? "1" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
}

// --- message handling -------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "SCAN_VISIBLE_TAB") {
        const tab = await getActiveTab();
        const dataUrl = await captureVisibleTab(tab.windowId);
        const text = await decodeQrFromDataUrl(dataUrl);
        sendResponse({ ok: true, text });
        return;
      }

      if (msg.type === "SCAN_REGION") {
        // msg.rect is in CSS pixels relative to the viewport; the content
        // script already accounts for devicePixelRatio and scroll offset.
        const tab = sender.tab || (await getActiveTab());
        const dataUrl = await captureVisibleTab(tab.windowId);
        const text = await decodeQrFromDataUrl(dataUrl, msg.rect);
        if (text) {
          await setPendingScan({ text, source: "region", ts: Date.now() });
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "gauth-vault",
            message: "QR code found — open the extension to add it.",
          });
        } else {
          await setPendingScan({ text: null, error: "No QR code found in that selection.", ts: Date.now() });
        }
        sendResponse({ ok: true, text });
        return;
      }

      if (msg.type === "START_REGION_SELECT") {
        const tab = await getActiveTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/overlay.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/overlay.css"],
        });
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === "CLEAR_PENDING_SCAN") {
        await chrome.storage.session.remove("pendingScan");
        chrome.action.setBadgeText({ text: "" });
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  })();
  return true; // keep the message channel open for the async response
});

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(tabs[0]);
    });
  });
}
