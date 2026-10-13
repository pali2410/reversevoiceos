"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "ebcb1766-da95-4c42-8622-e003d8788d5c", e._sentryDebugIdIdentifier = "sentry-dbid-ebcb1766-da95-4c42-8622-e003d8788d5c");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const main = require("../main.js");
require("zod");
require("path");
require("node:child_process");
require("node:fs");
require("node:fs/promises");
require("node:path");
require("electron-log");
require("ws");
require("node:os");
require("electron-store");
require("crypto");
require("@bufbuild/protobuf/codegenv2");
require("@bufbuild/protobuf/wkt");
require("node:crypto");
require("psl");
require("url");
require("child_process");
require("node:readline");
require("os");
require("fs");
require("@connectrpc/connect");
require("@connectrpc/connect-node");
require("@bufbuild/protobuf");
require("http-proxy-agent");
require("https-proxy-agent");
require("sqlite3");
require("uuid");
require("events");
require("string_decoder");
require("posthog-node");
require("node-machine-id");
require("dotenv");
require("@sentry/electron/main");
require("@electron-toolkit/utils");
require("readline");
require("node:perf_hooks");
require("node:url");
require("node:net");
require("node:stream");
require("node:util");
require("electron-updater");
require("util");
require("ajv");
require("ajv/dist/2020");
require("@modelcontextprotocol/sdk/client/index.js");
require("@modelcontextprotocol/sdk/types.js");
require("@modelcontextprotocol/sdk/server/zod-compat.js");
require("@modelcontextprotocol/sdk/validation/ajv-provider.js");
require("@modelcontextprotocol/sdk/client/stdio.js");
require("@modelcontextprotocol/sdk/client/streamableHttp.js");
require("@modelcontextprotocol/sdk/client/sse.js");
require("node:zlib");
require("worker_threads");
require("fs/promises");
require("marked");
require("fflate");
require("http");
require("dgram");
const CARD_WIDTH = 388;
const MAX_CARD_HEIGHT = 420;
const MIN_CARD_HEIGHT = 60;
const STAGE_PADDING = 12;
const CARD_SURFACE_RADIUS_PX = main.WIDGET_SURFACE_RADIUS_PX;
const CAPTURE_SCALE = 2;
const BRIDGE_SETTLE_TIMEOUT_MS = 2500;
const PAINT_SETTLE_MS = 220;
const PER_CARD_TIMEOUT_MS = 8e3;
const escapeAttribute = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
function buildHostDocument(request, theme) {
  const surface = theme === "light" ? "#f2f2f4" : "#0a0a0c";
  const confirmOverlay = request.kind === "confirmation" ? `<div id="confirm">${escapeHtmlText(request.confirmLabel?.trim() || "Confirm")}</div>` : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:${surface};}
  #stage{position:relative;width:${CARD_WIDTH}px;padding:${STAGE_PADDING}px;}
  iframe{display:block;width:100%;border:0;border-radius:${CARD_SURFACE_RADIUS_PX}px;
    background:${theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"};}
  /* The button VoiceOS floats over the widget — copied from
     FloatingConfirmButton so the review sees the real occlusion. */
  #confirm{position:absolute;right:${STAGE_PADDING + 12}px;bottom:${STAGE_PADDING + 10}px;
    height:30px;padding:0 18px;display:flex;align-items:center;
    font:600 13px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
    letter-spacing:0.01em;color:rgba(255,255,255,0.96);background:rgba(17,18,21,0.85);
    border:1px solid rgba(255,255,255,0.22);border-radius:999px;
    box-shadow:0 3px 12px rgba(0,0,0,0.32),0 1px 3px rgba(0,0,0,0.28);}
</style></head>
<body>
<div id="stage">
  <iframe id="frame" sandbox="allow-scripts" srcdoc="${escapeAttribute(main.hardenWidgetDocument(request.html))}"></iframe>
  ${confirmOverlay}
</div>
<script>
(function () {
  var frame = document.getElementById("frame");
  var state = { settled: false, measured: 0, errors: [] };
  window.__voiceosCapture = state;

  window.addEventListener("error", function (e) {
    state.errors.push(String((e && e.message) || "error"));
  });

  window.addEventListener("message", function (event) {
    if (event.source !== frame.contentWindow) return;
    var msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "voiceos:resize" && typeof msg.height === "number") {
      state.measured = msg.height;
      frame.style.height =
        Math.min(${MAX_CARD_HEIGHT}, Math.max(${MIN_CARD_HEIGHT}, msg.height)) + "px";
      state.settled = true;
    }
  });

  frame.addEventListener("load", function () {
    frame.style.height = ${clampHeight(request.declaredHeight)} + "px";
    try {
      frame.contentWindow.postMessage(${JSON.stringify({
    type: "voiceos:init",
    data: request.data ?? null,
    args: request.args ?? {},
    theme: { mode: theme },
    // Same corner the real hosts send, so a card that draws its own edge
    // is reviewed at the radius it will actually ship at.
    radius: CARD_SURFACE_RADIUS_PX
  })}, "*");
    } catch (err) {
      state.errors.push("init postMessage failed: " + err);
    }
  });
})();
<\/script>
</body></html>`;
}
function escapeHtmlText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function clampHeight(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 180;
  return Math.min(
    MAX_CARD_HEIGHT,
    Math.max(MIN_CARD_HEIGHT, Math.round(value))
  );
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function captureOne(win, request, theme) {
  const declaredHeight = clampHeight(request.declaredHeight);
  const document = buildHostDocument(request, theme);
  await win.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(document)
  );
  let bridgeSettled = false;
  const deadline = Date.now() + BRIDGE_SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    bridgeSettled = await win.webContents.executeJavaScript(
      "window.__voiceosCapture ? window.__voiceosCapture.settled === true : false"
    );
    if (bridgeSettled) break;
    await delay(60);
  }
  await win.webContents.executeJavaScript(
    "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))))"
  );
  await delay(PAINT_SETTLE_MS);
  const probe = await win.webContents.executeJavaScript(`(() => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    const state = window.__voiceosCapture || {};
    let inner = 0;
    try {
      inner = document.getElementById("frame").contentDocument.documentElement.scrollHeight;
    } catch (e) { inner = 0; }
    return {
      width: Math.ceil(stage.width),
      height: Math.ceil(stage.height),
      measured: state.measured || inner || 0,
      errors: (state.errors || []).slice(0, 5),
    };
  })()`);
  const image = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: probe.width,
    height: probe.height
  });
  const normalized = image.resize({
    width: probe.width * CAPTURE_SCALE,
    height: probe.height * CAPTURE_SCALE,
    quality: "best"
  });
  const measuredHeight = probe.measured || declaredHeight;
  return {
    id: request.id,
    toolName: request.toolName,
    label: request.label,
    kind: request.kind,
    theme,
    pngBase64: normalized.toPNG().toString("base64"),
    width: probe.width,
    height: probe.height,
    measuredHeight,
    declaredHeight,
    clipped: measuredHeight > MAX_CARD_HEIGHT,
    bridgeSettled,
    consoleErrors: probe.errors ?? []
  };
}
async function captureStudioCards(requests, options) {
  const themes = options?.themes?.length ? options.themes : ["dark"];
  if (requests.length === 0) return [];
  let win = null;
  const shots = [];
  try {
    win = new electron.BrowserWindow({
      show: false,
      width: CARD_WIDTH + STAGE_PADDING * 2,
      height: MAX_CARD_HEIGHT + STAGE_PADDING * 2,
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // The widget frame is untrusted integration markup; keep it as locked
        // down here as it is in the notch.
        webSecurity: true
      }
    });
    for (const request of requests) {
      for (const theme of themes) {
        if (options?.signal?.aborted) return shots;
        try {
          const shot = await Promise.race([
            captureOne(win, request, theme),
            delay(PER_CARD_TIMEOUT_MS).then(() => null)
          ]);
          if (shot) shots.push(shot);
          else {
            console.warn(
              `[IntegrationStudio] Card capture timed out: ${request.id} (${theme})`
            );
          }
        } catch (err) {
          console.warn(
            `[IntegrationStudio] Card capture failed for ${request.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Offscreen capture window unavailable:",
      err instanceof Error ? err.message : err
    );
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
  return shots;
}
function asWidget(value) {
  const block = value;
  if (!block || typeof block !== "object") return null;
  if (block.type !== "widget") return null;
  return typeof block.html === "string" && block.html.trim() ? block : null;
}
function findWidgetInView(node, depth = 0) {
  if (depth > 8 || !node || typeof node !== "object") return null;
  const direct = asWidget(node);
  if (direct) return direct;
  const record = node;
  for (const key of ["root", "children", "footer", "items", "rows"]) {
    const child = record[key];
    if (Array.isArray(child)) {
      for (const entry of child) {
        const found = findWidgetInView(entry, depth + 1);
        if (found) return found;
      }
    } else if (child) {
      const found = findWidgetInView(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function findWidgetInGlance(glance) {
  const blocks = glance?.blocks;
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    const widget = asWidget(block);
    if (widget) return widget;
  }
  return null;
}
const heightOf = (widget) => typeof widget.height === "number" ? widget.height : void 0;
const LIVE_TOOL_TIMEOUT_MS = 2e4;
async function liveCard(deps, toolName) {
  let timer;
  try {
    const result = await Promise.race([
      // Swallowed on the promise itself, not just by the catch below: a tool
      // that rejects AFTER the timeout won the race would otherwise reject
      // with nobody left listening.
      deps.previewToolResult(toolName).catch(() => null),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          console.warn(
            `[IntegrationStudio] Live card for ${toolName} timed out — reviewing its sample card instead`
          );
          resolve(null);
        }, deps.toolTimeoutMs ?? LIVE_TOOL_TIMEOUT_MS);
      })
    ]);
    return result?.success ? result.glance ?? null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function collectStudioCards(artifact, deps) {
  const requests = [];
  const fixtures = artifact.preview?.toolPreviews ?? [];
  for (const tool of artifact.manifest.tools) {
    const fixture = fixtures.find((entry) => entry.tool === tool.name);
    const title = tool.title || tool.name;
    if (tool.confirmation) {
      const widget2 = findWidgetInView(tool.confirmation);
      if (!widget2) continue;
      requests.push({
        id: `${tool.name}:confirmation`,
        toolName: tool.name,
        label: `${title} — confirmation card (shown before the action runs)`,
        kind: "confirmation",
        html: String(widget2.html),
        args: fixture?.sampleArgs ?? {},
        data: widget2.data,
        declaredHeight: heightOf(widget2),
        confirmLabel: typeof widget2.confirmLabel === "string" ? widget2.confirmLabel : void 0
      });
      continue;
    }
    const live = await liveCard(deps, tool.name);
    let widget = live ? findWidgetInGlance(live) : null;
    if (!widget) widget = findWidgetInGlance(fixture?.sampleGlance);
    if (!widget) continue;
    requests.push({
      id: `${tool.name}:result`,
      toolName: tool.name,
      label: `${title} — result card (shown after the action runs)`,
      kind: "result",
      html: String(widget.html),
      data: widget.data,
      declaredHeight: heightOf(widget)
    });
  }
  return requests;
}
const MAX_AUTO_REVIEW_ROUNDS = 3;
function shouldReviewRound(input) {
  return input.isCreateRun && input.roundsSoFar < MAX_AUTO_REVIEW_ROUNDS;
}
function shouldApplyReviewFeedback(input) {
  return input.roundsSoFar < MAX_AUTO_REVIEW_ROUNDS;
}
const EMPTY = {
  reviewed: 0,
  findings: [],
  feedback: null
};
const KIT_BASE_CSS_SENTINEL = "@keyframes k-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}";
const MAX_STYLE_SOURCE_CHARS = 4e3;
function extractAuthorStyle(html) {
  const open = html.indexOf("<style>");
  const close = html.indexOf("</style>", open);
  if (open < 0 || close < 0) return "";
  const sheet = html.slice(open + "<style>".length, close);
  const boundary = sheet.lastIndexOf(KIT_BASE_CSS_SENTINEL);
  const authored = (boundary < 0 ? (
    // Sentinel moved: fall back to the tail, which is still the authored
    // end of the sheet, rather than returning nothing.
    sheet.slice(-MAX_STYLE_SOURCE_CHARS)
  ) : sheet.slice(boundary + KIT_BASE_CSS_SENTINEL.length)).trim();
  return authored.length > MAX_STYLE_SOURCE_CHARS ? `${authored.slice(0, MAX_STYLE_SOURCE_CHARS)}
/* …truncated */` : authored;
}
async function runVisualReview(artifact, deps) {
  try {
    const archive = (shots2, findings2, feedback2, note) => deps.archive?.({ shots: shots2, findings: findings2, feedback: feedback2, note });
    const requests = await collectStudioCards(artifact, deps);
    if (requests.length === 0) {
      const reason = "no custom cards to review";
      archive([], [], null, reason);
      return { ...EMPTY, skippedReason: reason };
    }
    const shots = await captureStudioCards(requests, {
      themes: ["dark"],
      signal: deps.signal
    });
    if (shots.length === 0) {
      const reason = "offscreen capture produced no images";
      archive([], [], null, reason);
      return { ...EMPTY, skippedReason: reason };
    }
    if (deps.signal?.aborted) {
      archive(shots, [], null, "cancelled before the critique");
      return { ...EMPTY, skippedReason: "cancelled" };
    }
    const styleById = new Map(
      requests.map((request) => [request.id, extractAuthorStyle(request.html)])
    );
    const critique = deps.critique({
      artifact,
      cards: shots.map((shot) => ({
        id: shot.id,
        toolName: shot.toolName,
        label: shot.label,
        kind: shot.kind,
        theme: shot.theme,
        pngBase64: shot.pngBase64,
        declaredHeight: shot.declaredHeight,
        measuredHeight: shot.measuredHeight,
        clipped: shot.clipped,
        bridgeSettled: shot.bridgeSettled,
        consoleErrors: shot.consoleErrors,
        styleSource: styleById.get(shot.id) || void 0
      }))
    });
    const verdict = await critique.catch((err) => {
      archive(
        shots,
        [],
        null,
        `the critic failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
      throw err;
    });
    const findings = verdict?.findings ?? [];
    const feedback = verdict?.feedback?.trim() || null;
    archive(
      shots,
      findings,
      feedback,
      verdict ? void 0 : "the critic did not answer"
    );
    return { reviewed: shots.length, findings, feedback };
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Visual review failed:",
      err instanceof Error ? err.message : err
    );
    return { ...EMPTY, skippedReason: "review errored" };
  }
}
exports.MAX_AUTO_REVIEW_ROUNDS = MAX_AUTO_REVIEW_ROUNDS;
exports.collectStudioCards = collectStudioCards;
exports.extractAuthorStyle = extractAuthorStyle;
exports.runVisualReview = runVisualReview;
exports.shouldApplyReviewFeedback = shouldApplyReviewFeedback;
exports.shouldReviewRound = shouldReviewRound;
