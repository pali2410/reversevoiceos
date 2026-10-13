"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "af05ad05-8633-42ad-a34c-9af52f6699be", e._sentryDebugIdIdentifier = "sentry-dbid-af05ad05-8633-42ad-a34c-9af52f6699be");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const VIEWPORT = { width: 1280, height: 860 };
const OUTPUT_WIDTH = 800;
const JPEG_QUALITY = 68;
const LOAD_TIMEOUT_MS = 12e3;
const SETTLE_MS = 1400;
const CANDIDATE_PATHS = ["", "/product", "/pricing"];
const MAX_SHOTS = 2;
const DECLUTTER_CSS = `
  #onetrust-consent-sdk, #onetrust-banner-sdk, #CybotCookiebotDialog,
  #usercentrics-root, #hs-eu-cookie-confirmation, #cookie-banner, #cookieConsent,
  .cookie-banner, .cookie-consent, .cc-window, .osano-cm-window,
  [id*="cookie-banner" i], [class*="cookie-banner" i],
  [aria-label*="cookie" i], [aria-label*="consent" i],
  [id*="intercom" i], [class*="intercom-" i], [id*="drift-" i],
  [class*="drift-frame" i], #hubspot-messages-iframe-container {
    display: none !important;
  }
  html { scroll-behavior: auto !important; }
`;
function normalizeDomain(domain) {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(clean) ? clean : null;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function captureUrl(url) {
  let win = null;
  try {
    win = new electron.BrowserWindow({
      show: false,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // In-memory partition: no cookies, no cache, no trace afterwards.
        partition: `integration-site-capture-${Date.now()}`,
        images: true,
        javascript: true
      }
    });
    await Promise.race([
      win.loadURL(url),
      delay(LOAD_TIMEOUT_MS).then(() => {
        throw new Error("timed out");
      })
    ]);
    if (win.isDestroyed()) return null;
    await win.webContents.insertCSS(DECLUTTER_CSS);
    await delay(SETTLE_MS);
    if (win.isDestroyed()) return null;
    await win.webContents.executeJavaScript(
      "new Promise((r)=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0))))"
    ).catch(() => void 0);
    const image = await win.webContents.capturePage();
    if (image.isEmpty()) return null;
    const { width, height } = image.getSize();
    if (width < 200 || height < 200) return null;
    const scaled = image.resize({
      width: OUTPUT_WIDTH,
      height: Math.round(height / width * OUTPUT_WIDTH),
      quality: "good"
    });
    const jpeg = scaled.toJPEG(JPEG_QUALITY);
    if (jpeg.length < 2e3) return null;
    return { base64: jpeg.toString("base64"), mimeType: "image/jpeg", url };
  } catch {
    return null;
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}
async function captureSiteReference(domain, options) {
  const host = normalizeDomain(domain);
  if (!host) return [];
  const shots = [];
  for (const path of CANDIDATE_PATHS) {
    if (shots.length >= MAX_SHOTS) break;
    if (options?.signal?.aborted) break;
    const shot = await captureUrl(`https://${host}${path}`);
    if (shot) shots.push(shot);
  }
  if (shots.length > 0) {
    const kb = Math.round(
      shots.reduce((sum, shot) => sum + shot.base64.length, 0) / 1024
    );
    console.log(
      `[IntegrationStudio] Captured ${shots.length} reference shot(s) of ${host} (~${kb} KB)`
    );
  }
  return shots;
}
exports.captureSiteReference = captureSiteReference;
