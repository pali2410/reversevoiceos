"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "d45a9703-34a4-4689-8ffd-af43b7847071", e._sentryDebugIdIdentifier = "sentry-dbid-d45a9703-34a4-4689-8ffd-af43b7847071");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const log = require("electron-log");
const electron = require("electron");
const ICON_SIZE = 256;
const LOGO_SCALE = 0.56;
const FETCH_TIMEOUT_MS = 6e3;
const RENDER_TIMEOUT_MS = 8e3;
const COMPOSE_TIMEOUT_MS = 12e3;
const WEDGED = Symbol("wedged");
const MIN_USABLE_PX = 48;
const MIN_REQUESTED_PX = 32;
function logoCandidates(domain) {
  return [
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/apple-touch-icon-precomposed.png`
  ];
}
const isImage = (type) => /^image\/(png|jpeg|x-icon|vnd\.microsoft\.icon|webp|gif|svg\+xml)/i.test(
  type
);
async function fetchCandidate(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow"
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!isImage(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 200) return null;
    return {
      base64: bytes.toString("base64"),
      mimeType: type.split(";")[0].trim(),
      bytes: bytes.length,
      source: url
    };
  } catch {
    return null;
  }
}
async function fetchBrandLogos(domain) {
  const settled = await Promise.all(
    logoCandidates(domain).map((url) => fetchCandidate(url))
  );
  return settled.filter((logo) => logo !== null);
}
function buildComposerDocument(logos, minUsablePx = MIN_USABLE_PX) {
  const sources = logos.map((logo) => ({
    url: `data:${logo.mimeType};base64,${logo.base64}`,
    source: logo.source
  }));
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  #stage{width:${ICON_SIZE}px;height:${ICON_SIZE}px;position:relative;overflow:hidden}
  #bg{position:absolute;inset:0}
  /* Inset treatment: a bare glyph needs breathing room and a ground. */
  #mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    width:${Math.round(ICON_SIZE * LOGO_SCALE)}px;height:${Math.round(ICON_SIZE * LOGO_SCALE)}px;
    object-fit:contain;image-rendering:auto}
  /* Full-bleed treatment: the source IS already the app icon. */
  #stage.bleed #mark{width:100%;height:100%;object-fit:cover}
</style></head>
<body><div id="stage"><div id="bg"></div><img id="mark" alt=""></div>
<script>
(function () {
  var SOURCES = ${JSON.stringify(sources)};
  var state = { done: false, dominant: "#3987e5", px: 0, source: "", usable: false, bleed: false, fill: 0 };
  window.__brandIcon = state;

  function load(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /* Dominant colour of the MARK, not of the image.
     Transparent padding, the white a logo sits on, and near-black outlines are
     all excluded, because every one of them is the majority pixel in some
     real logo and none of them is that brand's colour. What is left is scored
     by saturation so a colourful mark beats residual grey. */
  function dominantColor(img) {
    var N = 64;
    var c = document.createElement("canvas");
    c.width = N; c.height = N;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, N, N);
    var data;
    try { data = ctx.getImageData(0, 0, N, N).data; } catch (e) { return null; }

    var buckets = {};
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a < 160) continue;
      var max = Math.max(r,g,b), min = Math.min(r,g,b);
      var lum = (max + min) / 2;
      var sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      if (lum > 242 || lum < 14) continue;          // paper white / pure black
      if (sat < 0.12 && lum > 200) continue;         // off-white backdrop
      var key = (r>>4) + "," + (g>>4) + "," + (b>>4);
      var bucket = buckets[key] || (buckets[key] = { r:0, g:0, b:0, n:0, sat:sat });
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++;
      if (sat > bucket.sat) bucket.sat = sat;
    }

    var best = null, bestScore = -1;
    for (var k in buckets) {
      var v = buckets[k];
      // Frequency decides, but saturation breaks ties hard — a logo that is
      // 70% grey chrome and 30% brand colour should report the brand colour.
      var score = v.n * (0.35 + v.sat);
      if (score > bestScore) { bestScore = score; best = v; }
    }
    if (!best) return null;
    var hex = function (x) { return ("0" + Math.round(x / best.n).toString(16)).slice(-2); };
    return "#" + hex(best.r) + hex(best.g) + hex(best.b);
  }

  /* Crop to the artwork, then ask what shape it is.
     Sources arrive padded in every combination: a bare glyph on transparency,
     a full-bleed tile, and — the case that fooled a naive edge test — a
     rounded tile with its own transparent margin already baked in. Measuring
     the raw canvas calls that last one "a glyph" and pads it a second time,
     producing a small tile floating inside a bigger one. So find the artwork's
     bounding box first and judge only what is inside it: a box that is
     essentially solid is an app icon and gets used corner to corner, anything
     sparser is a mark that wants a ground. */
  function contentProfile(img) {
    var N = 48;
    var c = document.createElement("canvas");
    c.width = N; c.height = N;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, N, N);
    var data;
    try { data = ctx.getImageData(0, 0, N, N).data; } catch (e) { return null; }

    var minX = N, minY = N, maxX = -1, maxY = -1;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        if (data[(y * N + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;

    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    var opaque = 0;
    for (var yy = minY; yy <= maxY; yy++) {
      for (var xx = minX; xx <= maxX; xx++) {
        if (data[(yy * N + xx) * 4 + 3] > 128) opaque++;
      }
    }
    var scale = img.naturalWidth / N;
    return {
      fill: opaque / (bw * bh),
      // Natural-pixel crop rect, so the redraw loses no resolution.
      crop: {
        x: Math.max(0, Math.floor(minX * scale)),
        y: Math.max(0, Math.floor(minY * scale)),
        w: Math.min(img.naturalWidth, Math.ceil(bw * scale)),
        h: Math.min(img.naturalHeight, Math.ceil(bh * scale)),
      },
    };
  }

  /* Re-render just the artwork, square, at output resolution. Removing the
     source's own padding is what stops us adding padding on top of padding. */
  function cropToSquare(img, crop) {
    var side = Math.max(crop.w, crop.h);
    var c = document.createElement("canvas");
    c.width = side; c.height = side;
    var ctx = c.getContext("2d");
    ctx.drawImage(
      img,
      crop.x, crop.y, crop.w, crop.h,
      Math.round((side - crop.w) / 2), Math.round((side - crop.h) / 2), crop.w, crop.h,
    );
    try { return c.toDataURL("image/png"); } catch (e) { return img.src; }
  }

  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  (async function () {
    var best = null;
    for (var i = 0; i < SOURCES.length; i++) {
      var img = await load(SOURCES[i].url);
      if (!img || !img.naturalWidth) continue;
      if (!best || img.naturalWidth > best.img.naturalWidth) {
        best = { img: img, source: SOURCES[i].source };
      }
    }
    if (!best) { state.done = true; return; }

    state.px = best.img.naturalWidth;
    state.source = best.source;
    state.usable = best.img.naturalWidth >= ${minUsablePx};

    var dom = dominantColor(best.img) || "#3987e5";
    state.dominant = dom;

    var profile = contentProfile(best.img);
    var markSrc = profile ? cropToSquare(best.img, profile.crop) : best.img.src;
    // A near-solid bounding box means the artwork IS the tile.
    state.fill = profile ? Math.round(profile.fill * 100) / 100 : 0;
    // A circle fills ~0.79 of its box, a rounded tile ~0.9+ — the gap is where
    // this sits, so a round logo keeps its ground and a tile goes full-bleed.
    var bleed = !!profile && profile.fill > 0.84;
    state.bleed = bleed;

    var bg = document.getElementById("bg");
    if (bleed) {
      /* Its own tile, used as-is. The ground only shows through rounded
         corners, so it matches the mark rather than contrasting with it. */
      document.getElementById("stage").className = "bleed";
      bg.style.background = dom;
    } else {
      /* A bare glyph. Here the ground is chosen for CONTRAST WITH THE MARK,
         not brand loyalty: painting a green logo onto its own green makes it
         vanish. Light marks get a near-black field, everything else near-white
         — which is what most real app icons for these services already do. */
      bg.style.background = luminance(dom) > 0.72
        ? "linear-gradient(180deg,#2b2b2f 0%,#161617 100%)"
        : "linear-gradient(180deg,#ffffff 0%,#f1f1f4 100%)";
    }

    document.getElementById("mark").src = markSrc;
    state.done = true;
  })();
})();
<\/script></body></html>`;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function buildBrandIcon(domain, options = {}) {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(clean)) return null;
  const logos = await fetchBrandLogos(clean);
  if (logos.length === 0) return null;
  let win = null;
  try {
    win = new electron.BrowserWindow({
      show: false,
      width: ICON_SIZE,
      height: ICON_SIZE,
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    const composed = await Promise.race([
      composeBrandIcon(win, logos, options.requested === true),
      delay(COMPOSE_TIMEOUT_MS).then(() => WEDGED)
    ]);
    if (composed === WEDGED) {
      log.warn(
        `[IntegrationStudio] Brand icon composite wedged for ${clean} after ${COMPOSE_TIMEOUT_MS}ms`
      );
      return null;
    }
    return composed;
  } catch (err) {
    log.warn(
      "[IntegrationStudio] Brand icon composite failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}
async function composeBrandIcon(win, logos, requested) {
  await win.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(
      buildComposerDocument(
        logos,
        requested ? MIN_REQUESTED_PX : MIN_USABLE_PX
      )
    )
  );
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let state = null;
  while (Date.now() < deadline) {
    state = await win.webContents.executeJavaScript(
      "window.__brandIcon ? JSON.parse(JSON.stringify(window.__brandIcon)) : null"
    );
    if (state?.done) break;
    await delay(60);
  }
  if (!state?.done || !state.usable) return null;
  await win.webContents.executeJavaScript(
    "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))))"
  );
  await delay(180);
  const image = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: ICON_SIZE,
    height: ICON_SIZE
  });
  if (image.isEmpty() || isBlankCapture(image)) {
    log.warn(
      `[IntegrationStudio] Brand icon capture came back blank for ${state.source}`
    );
    return null;
  }
  return {
    png: image.resize({ width: ICON_SIZE, height: ICON_SIZE }).toPNG(),
    dominantColor: state.dominant,
    sourcePx: state.px,
    source: state.source,
    fullBleed: state.bleed,
    fill: state.fill
  };
}
function isBlankCapture(image) {
  try {
    return isBlankBitmap(image.toBitmap());
  } catch {
    return false;
  }
}
function isBlankBitmap(bitmap) {
  const pixels = Math.floor(bitmap.length / 4);
  if (pixels === 0) return true;
  const step = Math.max(1, Math.floor(pixels / 4096)) * 4;
  let maxAlpha = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i + 3 < bitmap.length; i += step) {
    const alpha = bitmap[i + 3];
    if (alpha > maxAlpha) maxAlpha = alpha;
    if (alpha < 24) continue;
    for (let channel = 0; channel < 3; channel++) {
      const value = bitmap[i + channel];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return maxAlpha < 24 || max - min <= 4;
}
exports.buildBrandIcon = buildBrandIcon;
exports.fetchBrandLogos = fetchBrandLogos;
exports.isBlankBitmap = isBlankBitmap;
