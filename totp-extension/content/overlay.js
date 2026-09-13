(() => {
  // Avoid double-injecting if triggered twice.
  if (document.getElementById("gauth-vault-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "gauth-vault-overlay";

  const hint = document.createElement("div");
  hint.id = "gauth-vault-overlay-hint";
  hint.textContent = "Drag a box around the QR code. Press Esc to cancel.";
  overlay.appendChild(hint);

  const selectionBox = document.createElement("div");
  selectionBox.id = "gauth-vault-selection-box";
  overlay.appendChild(selectionBox);

  document.documentElement.appendChild(overlay);

  let startX = 0;
  let startY = 0;
  let dragging = false;

  function cleanup() {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown, true);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }
  document.addEventListener("keydown", onKeyDown, true);

  overlay.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    selectionBox.style.display = "block";
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;
  });

  overlay.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    dragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    cleanup();

    if (w < 10 || h < 10) return; // ignore accidental clicks

    // Convert CSS pixels -> device pixels for the screenshot crop.
    const dpr = window.devicePixelRatio || 1;
    const rect = {
      x: Math.round(x * dpr),
      y: Math.round(y * dpr),
      width: Math.round(w * dpr),
      height: Math.round(h * dpr),
    };

    chrome.runtime.sendMessage({ type: "SCAN_REGION", rect });
  });
})();
