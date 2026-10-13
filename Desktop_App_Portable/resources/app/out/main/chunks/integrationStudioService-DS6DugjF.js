"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "d612883b-4423-4040-b501-bf5dd6b62bb2", e._sentryDebugIdIdentifier = "sentry-dbid-d612883b-4423-4040-b501-bf5dd6b62bb2");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const log = require("electron-log");
const node_crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const electron = require("electron");
const main = require("../main.js");
require("zod");
require("path");
require("node:child_process");
require("node:fs/promises");
require("ws");
require("node:os");
require("electron-store");
require("crypto");
require("@bufbuild/protobuf/codegenv2");
require("@bufbuild/protobuf/wkt");
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
const MAX_STUDIO_CHAT_MESSAGE_CHARS = 4e3;
const INTEGRATION_STUDIO_PHASES = [
  "planning",
  "generating",
  "validating",
  "fixing",
  "installing",
  "illustrating",
  "reviewing"
];
const DEFAULT_PHASE_MS = {
  // Wall-clock of the plan round is mostly the user reading and choosing, so
  // it can't be estimated — keep its share of the bar small and honest.
  planning: 8e3,
  generating: 45e3,
  validating: 400,
  fixing: 3e4,
  installing: 6e3,
  illustrating: 12e3,
  // Screenshotting every card offscreen (~8s) plus one vision round with high
  // thinking (~70s measured) — and, when the review asks for changes, the
  // corrective rebuild that follows, since the run stays in this phase for all
  // of it. Seeded between the two outcomes.
  reviewing: 9e4
};
const MAX_PLAUSIBLE_MS = 10 * 6e4;
function readSamples() {
  const raw = main.store.get(main.STORE_KEYS.INTEGRATION_STUDIO_PHASE_SAMPLES);
  if (!raw || typeof raw !== "object") return {};
  const book = {};
  for (const phase of INTEGRATION_STUDIO_PHASES) {
    const values = raw[phase];
    if (Array.isArray(values)) {
      book[phase] = values.filter((v) => typeof v === "number" && v > 0).slice(-10);
    }
  }
  return book;
}
function recordPhaseDuration(phase, ms) {
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_PLAUSIBLE_MS) return;
  const book = readSamples();
  const next = [...book[phase] ?? [], Math.round(ms)].slice(-10);
  main.store.set(main.STORE_KEYS.INTEGRATION_STUDIO_PHASE_SAMPLES, {
    ...book,
    [phase]: next
  });
}
function readPhaseEstimates() {
  const book = readSamples();
  const estimate = { ...DEFAULT_PHASE_MS };
  for (const phase of INTEGRATION_STUDIO_PHASES) {
    const samples = book[phase];
    if (!samples?.length) continue;
    estimate[phase] = Math.round(
      samples.reduce((sum, value) => sum + value, 0) / samples.length
    );
  }
  return estimate;
}
const PHASE_STALL_MS = {
  planning: 4 * 6e4,
  // The build narrates itself sentence by sentence while the model reasons
  // (see createActivitySink in solClient.ts), so silence here is real silence
  // — but the stretch where it emits the code body carries no reasoning, and
  // that is the one long quiet passage in a healthy build. Hence eight.
  generating: 8 * 6e4,
  validating: 2 * 6e4,
  fixing: 8 * 6e4,
  // Writes the folder, then `bun install`s the integration's dependencies:
  // minutes, legitimately, on a cold cache or a slow network.
  installing: 10 * 6e4,
  illustrating: 4 * 6e4,
  // Screenshots every card, one high-thinking vision round, and possibly a
  // corrective CSS rebuild — the longest honest silence in a build.
  reviewing: 10 * 6e4
};
const WATCHDOG_INTERVAL_MS = 15e3;
const FROZEN_SWEEP_GAP_MS = WATCHDOG_INTERVAL_MS * 2;
function frozenGapMs(msSinceLastSweep) {
  if (!Number.isFinite(msSinceLastSweep)) return 0;
  if (msSinceLastSweep <= FROZEN_SWEEP_GAP_MS) return 0;
  return msSinceLastSweep - WATCHDOG_INTERVAL_MS;
}
function minutes(ms) {
  const mins = Math.round(ms / 6e4);
  return mins <= 1 ? "a minute" : `${mins} minutes`;
}
function checkRunStall(run, now) {
  if (run.status !== "running") return { stalled: false };
  if (run.awaitingUser) return { stalled: false };
  const silentMs = Math.max(0, now - run.lastEventAt);
  const limit = PHASE_STALL_MS[run.phase] ?? PHASE_STALL_MS.generating;
  return silentMs > limit ? {
    stalled: true,
    message: `This build stopped responding — nothing came back for ${minutes(limit)}. Try again.`
  } : { stalled: false };
}
const MAX_FIELDS = 8;
const BODY_KEYS = /body|message|content|text|description|note|prompt|comment/i;
function humanize(key) {
  return key.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase()) || key;
}
function readProperties(tool) {
  const raw = tool.inputSchema?.properties;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw).filter(
    (entry) => !!entry[1] && typeof entry[1] === "object" && !Array.isArray(entry[1])
  ).slice(0, MAX_FIELDS);
}
function readRequired(tool) {
  const raw = tool.inputSchema?.required;
  return new Set(
    Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : []
  );
}
function fieldFor(key, property, required) {
  const label = humanize(key);
  const options = Array.isArray(property.enum) ? property.enum.filter((v) => typeof v === "string" || typeof v === "number").map((v) => ({ label: String(v), value: String(v) })) : [];
  if (options.length > 0) {
    return { type: "select", bind: `{{${key}}}`, label, required, options };
  }
  if (property.type === "boolean") {
    return { type: "toggle", bind: `{{${key}}}`, label, required };
  }
  if (property.type === "array") {
    return { type: "chips", bind: `{{${key}}}`, label, required };
  }
  return {
    type: "textField",
    bind: `{{${key}}}`,
    label,
    required,
    multiline: BODY_KEYS.test(key)
  };
}
function synthesizeToolConfirmationView(tool) {
  const required = readRequired(tool);
  const fields = readProperties(tool).map(
    ([key, property]) => fieldFor(key, property, required.has(key))
  );
  const children = [
    { type: "text", text: tool.description, variant: "body", maxLines: 3 },
    ...fields
  ];
  return {
    schemaVersion: main.UI_SCHEMA_VERSION,
    root: {
      type: "card",
      title: tool.title ?? humanize(tool.name),
      children,
      footer: [
        {
          type: "actions",
          items: [
            { label: "Cancel", role: "cancel" },
            { label: "Run", role: "confirm", color: "accent" }
          ]
        }
      ]
    }
  };
}
function setToolConfirmation(manifest, toolName, required, authored) {
  return {
    ...manifest,
    tools: manifest.tools.map((tool) => {
      if (tool.name !== toolName) return tool;
      if (tool.disabled) return tool;
      if (!required) {
        const { confirmation: _dropped, ...rest } = tool;
        return rest;
      }
      return {
        ...tool,
        confirmation: authored ?? tool.confirmation ?? synthesizeToolConfirmationView(tool)
      };
    })
  };
}
const REFUSED_CHANGE_PATTERN = /^(?:sorry[,!\s]+)?i\s*(?:cannot|can[’']?t|am\s+(?:not\s+able|unable)\s+to|[’']m\s+(?:not\s+able|unable)\s+to|won[’']?t\s+be\s+able\s+to|do\s+not\s+have\s+the\s+ability\s+to|don[’']?t\s+have\s+the\s+ability\s+to)\s+(?:directly\s+)?(?:remove|delete|add|modify|change|edit|rename|update|adjust|restyle|redesign|rework|make\s+(?:any\s+)?(?:changes|modifications|edits))\b/i;
function isRefusedStudioChangeReply(reply) {
  return typeof reply === "string" && REFUSED_CHANGE_PATTERN.test(reply.trim());
}
function buildStudioConfigState(configured, manifest) {
  const secretNames = new Set(
    main.setupFields(manifest).filter((field) => field.secret).map((field) => field.name)
  );
  const values = {};
  const secretLengths = {};
  if (manifest) {
    for (const [key, value] of configured) {
      if (secretNames.has(key)) {
        if (value) secretLengths[key] = value.length;
      } else {
        values[key] = value;
      }
    }
  }
  return {
    success: true,
    configuredFields: [...configured.keys()],
    values,
    secretLengths
  };
}
const SHOTS_DIR_NAME = "integration-studio-shots";
const MAX_ARCHIVED_RUNS = 20;
function studioShotsRoot() {
  return path.join(electron.app.getPath("userData"), SHOTS_DIR_NAME);
}
function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug || "integration";
}
function runFolderName(name, at) {
  const stamp = at.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${stamp}-${slugify(name)}`;
}
function shotFileName(shot) {
  return `${slugify(shot.id)}.${slugify(shot.theme)}.png`;
}
function staleRunFolders(names, keep = MAX_ARCHIVED_RUNS) {
  const sorted = [...names].sort();
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}
let currentRun = null;
function runDir(runKey, runName) {
  try {
    if (currentRun?.key === runKey && fs.existsSync(currentRun.dir)) {
      return currentRun.dir;
    }
    const root = studioShotsRoot();
    fs.mkdirSync(root, { recursive: true });
    prune(root);
    const dir = path.join(root, runFolderName(runName, /* @__PURE__ */ new Date()));
    fs.mkdirSync(dir, { recursive: true });
    currentRun = { key: runKey, dir };
    return dir;
  } catch (err) {
    warn("could not create the shot archive folder", err);
    return null;
  }
}
function prune(root) {
  try {
    const runs = fs.readdirSync(root).filter(
      (name) => fs.statSync(path.join(root, name)).isDirectory()
    );
    for (const stale of staleRunFolders(runs)) {
      fs.rmSync(path.join(root, stale), { recursive: true, force: true });
    }
  } catch (err) {
    warn("could not prune old shot folders", err);
  }
}
function warn(what, err) {
  console.warn(
    `[IntegrationStudio] Shot archive: ${what} —`,
    err instanceof Error ? err.message : err
  );
}
function archiveReferenceShots(input) {
  if (input.shots.length === 0) return;
  const dir = runDir(input.runKey, input.runName);
  if (!dir) return;
  try {
    const refDir = path.join(dir, "reference");
    fs.mkdirSync(refDir, { recursive: true });
    const record = {
      at: (/* @__PURE__ */ new Date()).toISOString(),
      domain: input.domain,
      shots: input.shots.map((shot, index) => {
        const file = `${slugify(input.domain)}-${index + 1}.png`;
        fs.writeFileSync(path.join(refDir, file), Buffer.from(shot.base64, "base64"));
        return { file, url: shot.url };
      })
    };
    fs.writeFileSync(
      path.join(refDir, "reference.json"),
      JSON.stringify(record, null, 2)
    );
    writeContactSheet(dir);
  } catch (err) {
    warn("could not write the reference shots", err);
  }
}
function archiveReviewRound(input) {
  const dir = runDir(input.runKey, input.runName);
  if (!dir) return null;
  try {
    const roundDir = path.join(dir, `round-${input.round}`);
    fs.mkdirSync(roundDir, { recursive: true });
    const record = {
      round: input.round,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      ...input.note ? { note: input.note } : {},
      feedback: input.feedback,
      cards: input.shots.map((shot) => {
        const file = shotFileName(shot);
        fs.writeFileSync(
          path.join(roundDir, file),
          Buffer.from(shot.pngBase64, "base64")
        );
        return {
          file,
          id: shot.id,
          toolName: shot.toolName,
          label: shot.label,
          kind: shot.kind,
          theme: shot.theme,
          declaredHeight: shot.declaredHeight,
          measuredHeight: shot.measuredHeight,
          clipped: shot.clipped,
          bridgeSettled: shot.bridgeSettled,
          consoleErrors: shot.consoleErrors,
          findings: input.findings.filter((finding) => finding.cardId === shot.id).map(({ severity, issue, fix }) => ({ severity, issue, fix }))
        };
      })
    };
    fs.writeFileSync(
      path.join(roundDir, "round.json"),
      JSON.stringify(record, null, 2)
    );
    writeContactSheet(dir);
    return dir;
  } catch (err) {
    warn("could not write a review round", err);
    return null;
  }
}
function writeContactSheet(dir) {
  try {
    const rounds = fs.readdirSync(dir).filter((name) => name.startsWith("round-")).map((name) => readJson(path.join(dir, name, "round.json"))).filter((round) => round !== null).sort((a, b) => a.round - b.round);
    const reference = readJson(
      path.join(dir, "reference", "reference.json")
    );
    fs.writeFileSync(
      path.join(dir, "index.html"),
      buildContactSheet(dir.split("/").pop() || "build", rounds, reference)
    );
  } catch (err) {
    warn("could not write the contact sheet", err);
  }
}
function readJson(path2) {
  try {
    return fs.existsSync(path2) ? JSON.parse(fs.readFileSync(path2, "utf8")) : null;
  } catch {
    return null;
  }
}
const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function buildContactSheet(runName, rounds, reference) {
  const totalShots = rounds.reduce((sum, round) => sum + round.cards.length, 0);
  const cardHtml = (round, card) => {
    const flags = [
      card.clipped ? `<span class="flag bad">clipped</span>` : "",
      card.bridgeSettled ? "" : `<span class="flag bad">bridge never settled</span>`,
      card.consoleErrors.length > 0 ? `<span class="flag bad">${card.consoleErrors.length} console error(s)</span>` : "",
      Math.abs(card.measuredHeight - card.declaredHeight) > 24 ? `<span class="flag warn">height off by ${Math.abs(
        card.measuredHeight - card.declaredHeight
      )}px</span>` : ""
    ].join("");
    const findings = card.findings.map(
      (finding) => `<li><b>${escapeHtml(finding.severity)}</b> —
          ${escapeHtml(finding.issue)}<br><i>${escapeHtml(finding.fix)}</i></li>`
    ).join("");
    return `<figure>
      <img src="round-${round.round}/${escapeHtml(card.file)}" alt="${escapeHtml(card.label)}">
      <figcaption>
        <b>${escapeHtml(card.label)}</b>
        <div class="meta">${escapeHtml(card.kind)} · ${escapeHtml(card.theme)} ·
          declared ${card.declaredHeight}px, measured ${card.measuredHeight}px</div>
        <div>${flags}</div>
        ${findings ? `<ul class="findings">${findings}</ul>` : `<div class="clean">critic raised nothing on this card</div>`}
      </figcaption>
    </figure>`;
  };
  const roundsHtml = rounds.map(
    (round) => `<section>
        <h2>Round ${round.round}
          <span class="meta">${escapeHtml(round.at)} · ${round.cards.length} card(s)</span>
        </h2>
        ${round.note ? `<p class="note">${escapeHtml(round.note)}</p>` : ""}
        ${round.feedback ? `<pre class="feedback">${escapeHtml(round.feedback)}</pre>` : `<p class="clean">Passed — no changes asked for.</p>`}
        <div class="grid">${round.cards.map((card) => cardHtml(round, card)).join("")}</div>
      </section>`
  ).join("");
  const referenceHtml = reference ? `<section>
        <h2>Reference — ${escapeHtml(reference.domain)}
          <span class="meta">what the design pass looked at</span>
        </h2>
        <div class="grid wide">${reference.shots.map(
    (shot) => `<figure><img src="reference/${escapeHtml(shot.file)}" alt="${escapeHtml(shot.url)}">
                <figcaption><div class="meta">${escapeHtml(shot.url)}</div></figcaption></figure>`
  ).join("")}</div>
      </section>` : `<section><p class="note">No reference screenshots — the design pass ran
        without seeing the real product.</p></section>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(runName)} — studio shots</title>
<style>
  body{margin:0;padding:28px;background:#0d0f13;color:#e6eaf0;
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:15px;margin:0 0 12px;border-bottom:1px solid #232a34;padding-bottom:8px}
  section{margin-top:36px}
  .meta{font:11px ui-monospace,Menlo,monospace;color:#8b95a5;font-weight:400}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
  .grid.wide{grid-template-columns:repeat(auto-fill,minmax(420px,1fr))}
  figure{margin:0;background:#151a21;border:1px solid #232a34;border-radius:10px;overflow:hidden}
  img{display:block;width:100%;height:auto;background:#000}
  figcaption{padding:10px 12px;font-size:12.5px}
  .flag{display:inline-block;font:10.5px ui-monospace,Menlo,monospace;padding:2px 6px;
    border-radius:4px;margin:6px 6px 0 0}
  .flag.bad{background:rgba(239,113,103,.16);color:#ef7167}
  .flag.warn{background:rgba(223,168,60,.16);color:#dfa83c}
  .findings{margin:8px 0 0;padding-left:16px;font-size:12.5px;color:#c2cad6}
  .findings b{font:10.5px ui-monospace,Menlo,monospace;color:#dfa83c}
  .findings i{color:#8b95a5}
  .clean{margin-top:6px;font-size:12px;color:#4fbf8f}
  .feedback{white-space:pre-wrap;background:#151a21;border:1px solid #232a34;
    border-radius:8px;padding:11px 13px;font:12px/1.55 ui-monospace,Menlo,monospace;color:#c2cad6}
  .note{color:#dfa83c;font-size:13px}
</style></head><body>
<h1>${escapeHtml(runName)}</h1>
<div class="meta">${rounds.length} review round(s) · ${totalShots} card screenshot(s)</div>
${referenceHtml}
${roundsHtml}
</body></html>`;
}
const sessions = /* @__PURE__ */ new Map();
let staleDraftsCleaned = false;
function createSession() {
  const session = {
    id: `sess_${Date.now().toString(36)}_${node_crypto.randomUUID().slice(0, 8)}`,
    draft: null,
    generation: null,
    plan: null,
    confirmationChoices: /* @__PURE__ */ new Map(),
    authoredConfirmations: /* @__PURE__ */ new Map(),
    icon: null,
    mark: null,
    configValues: /* @__PURE__ */ new Map(),
    lastSelfTestSignature: null,
    visualReview: { rounds: 0, pendingFeedback: null },
    brandReference: null,
    brandCapture: null,
    planResearch: null,
    planRound: null,
    chat: [],
    chatCall: null,
    terminal: [],
    draftLogUnsub: null,
    briefImages: null,
    run: null,
    sender: null,
    editIntegrationId: null
  };
  sessions.set(session.id, session);
  return session;
}
function sessionAlive(session) {
  return sessions.get(session.id) === session;
}
function disposeSession(session) {
  session.generation?.abort();
  session.generation = null;
  session.plan?.abort();
  session.plan = null;
  session.chatCall?.abort();
  session.chatCall = null;
  session.draftLogUnsub?.();
  session.draftLogUnsub = null;
  session.run = null;
  sessions.delete(session.id);
  void Promise.resolve().then(() => require("./integrationStudioTestRunner-C0pMeJO7.js")).then(
    ({ releaseStudioTestSession }) => releaseStudioTestSession(session.id)
  ).catch(() => {
  });
  broadcastRuns();
}
function openIntegrationStudioSession() {
  const session = createSession();
  return { success: true, sessionId: session.id };
}
function draftEnv(session) {
  if (session.configValues.size === 0) return void 0;
  return Object.fromEntries(session.configValues);
}
function resetVisualReview(session) {
  session.visualReview.rounds = 0;
  session.visualReview.pendingFeedback = null;
}
const BRAND_CAPTURE_WAIT_MS = 15e3;
const CRITIQUE_TIMEOUT_MS = 12e4;
function beginBrandCapture(session, domain, brandColor) {
  session.brandReference = { domain, brandColor, shots: [] };
  session.brandCapture = (async () => {
    try {
      const { captureSiteReference } = await Promise.resolve().then(() => require("./integrationSiteCapture-Dsrz4dyR.js"));
      const shots = await captureSiteReference(domain);
      if (sessionAlive(session) && session.brandReference?.domain === domain) {
        session.brandReference.shots = shots;
      }
      archiveReferenceShots({
        runKey: session.run?.runId ?? domain,
        runName: session.run?.name || domain,
        domain,
        shots
      });
    } catch (err) {
      console.warn(
        "[IntegrationStudio] Site reference capture failed:",
        err instanceof Error ? err.message : err
      );
    } finally {
      session.brandCapture = null;
    }
  })();
}
async function brandReferenceForBuild(session) {
  if (session.brandCapture) {
    await Promise.race([
      session.brandCapture,
      new Promise((resolve) => setTimeout(resolve, BRAND_CAPTURE_WAIT_MS))
    ]);
  }
  if (!session.brandReference) return null;
  const { domain, brandColor, shots } = session.brandReference;
  return domain || brandColor || shots.length > 0 ? { domain, brandColor, shots } : null;
}
const MAX_BRIEF_IMAGES = 4;
const MAX_BRIEF_IMAGE_BASE64 = 4 * 1024 * 1024;
function sanitizeBriefImages(images) {
  return (images ?? []).filter(
    (image) => image && typeof image.base64 === "string" && image.base64.length > 0 && image.base64.length <= MAX_BRIEF_IMAGE_BASE64
  ).slice(0, MAX_BRIEF_IMAGES).map((image) => ({
    base64: image.base64,
    mimeType: typeof image.mimeType === "string" && image.mimeType.startsWith("image/") ? image.mimeType : "image/jpeg",
    ...typeof image.name === "string" && image.name ? { name: image.name.slice(0, 120) } : {}
  }));
}
function rememberBriefImages(session, prompt, images) {
  if (images.length > 0) {
    session.briefImages = { prompt, images };
    return;
  }
  if (session.briefImages?.prompt !== prompt) session.briefImages = null;
}
function briefImagesForPrompt(session, prompt) {
  return session.briefImages?.prompt === prompt ? session.briefImages.images : [];
}
function researchForPrompt(session, prompt) {
  if (!session.planResearch || session.planResearch.prompt !== prompt) {
    return void 0;
  }
  return session.planResearch.research || void 0;
}
function resetConfirmationChoices(session) {
  session.confirmationChoices.clear();
  session.authoredConfirmations.clear();
  session.configValues.clear();
  session.lastSelfTestSignature = null;
}
function iconMimeType(fileName) {
  return fileName.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
}
function activeIconDataUrl(session) {
  if (!session.icon) return void 0;
  return `data:${iconMimeType(session.icon.fileName)};base64,${session.icon.data.toString("base64")}`;
}
function adoptServerArtifact(session, artifact) {
  for (const tool of artifact.manifest.tools) {
    if (tool.confirmation)
      session.authoredConfirmations.set(tool.name, tool.confirmation);
  }
  let manifest = artifact.manifest;
  const name = main.clampIntegrationName(manifest.name);
  if (name && name !== manifest.name) manifest = { ...manifest, name };
  for (const [toolName, required] of session.confirmationChoices) {
    if (!manifest.tools.some((tool) => tool.name === toolName)) continue;
    manifest = setToolConfirmation(
      manifest,
      toolName,
      required,
      session.authoredConfirmations.get(toolName)
    );
  }
  return manifest === artifact.manifest ? artifact : { ...artifact, manifest };
}
function writeDraftManifestPatch(draft, patch) {
  const path$1 = path.join(draft.serverDir, "voiceos.integration.json");
  try {
    const onDisk = JSON.parse(fs.readFileSync(path$1, "utf-8"));
    fs.writeFileSync(
      path$1,
      JSON.stringify({ ...onDisk, ...patch }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Draft manifest rewrite failed:",
      err instanceof Error ? err.message : err
    );
  }
}
function setActiveIcon(session, fileName, data) {
  session.icon = { fileName, data };
  session.mark = main.buildWidgetMark(data);
}
function resetSessionBranding(session) {
  session.icon = null;
  session.mark = null;
  session.brandReference = null;
  session.brandCapture = null;
}
async function refreshDraftBranding(session, draft, options) {
  if (!session.icon) return;
  try {
    fs.writeFileSync(
      path.join(draft.serverDir, session.icon.fileName),
      session.icon.data
    );
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Draft icon write failed:",
      err instanceof Error ? err.message : err
    );
    return;
  }
  const manifest = main.applyWidgetMarkToView(
    { ...draft.artifact.manifest, icon: session.icon.fileName },
    session.mark
  );
  draft.artifact = { ...draft.artifact, manifest };
  writeDraftManifestPatch(draft, {
    icon: manifest.icon,
    tools: manifest.tools
  });
  if (!session.mark) return;
  const kitPath = path.join(draft.serverDir, "widgetKit.ts");
  try {
    fs.writeFileSync(
      kitPath,
      main.embedWidgetMark(main.WIDGET_KIT_SOURCE, session.mark),
      "utf-8"
    );
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Draft widget kit rebrand failed:",
      err instanceof Error ? err.message : err
    );
    return;
  }
  if (!options?.relaunch) return;
  try {
    await main.getMcpClientManager().updateServer(draft.serverId, {});
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Draft relaunch after rebrand failed:",
      err instanceof Error ? err.message : err
    );
  }
}
function writeStudioMeta(draft) {
  try {
    fs.writeFileSync(
      path.join(draft.serverDir, "studio-meta.json"),
      JSON.stringify(
        {
          originalPrompt: draft.originalPrompt,
          preview: draft.artifact.preview,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (err) {
    console.warn(
      "[IntegrationStudio] studio-meta write failed:",
      err instanceof Error ? err.message : err
    );
  }
}
async function cleanupStaleDrafts() {
  if (staleDraftsCleaned) return;
  staleDraftsCleaned = true;
  try {
    const liveDraftIds = new Set(
      [...sessions.values()].map((session) => session.draft?.serverId).filter((id) => Boolean(id))
    );
    const manager = main.getMcpClientManager();
    const servers = await manager.listServers();
    for (const server of servers) {
      if (!server.draft) continue;
      if (liveDraftIds.has(server.id)) continue;
      console.log(
        `[IntegrationStudio] Removing stale draft "${server.name}" (${server.id})`
      );
      await manager.removeServer(server.id);
    }
  } catch (err) {
    console.warn("[IntegrationStudio] Stale draft cleanup failed:", err);
  }
}
const MAX_TERMINAL_LINES = 300;
function recordTerminal(session, line) {
  session.terminal.push(line);
  if (session.terminal.length > MAX_TERMINAL_LINES) {
    session.terminal.splice(0, session.terminal.length - MAX_TERMINAL_LINES);
  }
}
function sendEvent(session, sender, event) {
  if (event.type === "server-log") {
    recordTerminal(session, {
      at: event.at,
      text: event.text,
      level: event.level
    });
  } else if (event.type === "log") {
    recordTerminal(session, {
      at: Date.now(),
      text: event.message,
      level: event.tone
    });
  }
  try {
    if (!sender.isDestroyed()) {
      sender.send(main.IPC_EVENTS.INTEGRATION_STUDIO_EVENT, {
        ...event,
        sessionId: session.id
      });
    }
  } catch {
  }
}
function watchDraftServerLogs(session, sender, serverId) {
  session.draftLogUnsub?.();
  session.draftLogUnsub = main.getMcpClientManager().subscribeServerLogs(
    serverId,
    (entry) => {
      const target = session.sender && !session.sender.isDestroyed() ? session.sender : sender;
      sendEvent(session, target, {
        type: "server-log",
        at: entry.timestamp,
        text: entry.text,
        level: entry.level
      });
    }
  );
}
function runIsLive(session) {
  return session.run !== null && session.run.status !== "error";
}
function runIsRunning(session) {
  return session.run?.status === "running";
}
function allRuns() {
  return [...sessions.values()].map((session) => session.run).filter((run) => run !== null).sort((a, b) => a.startedAt - b.startedAt);
}
function broadcastRuns() {
  void Promise.resolve().then(() => require("../main.js")).then((n) => n.app).then(({ mainWindow }) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          main.IPC_EVENTS.INTEGRATION_STUDIO_RUN,
          allRuns()
        );
      }
    } catch {
    }
  });
}
function touchRun(session) {
  if (!session.run || session.run.status !== "running") return;
  session.run.lastEventAt = Date.now();
}
function setAwaitingUser(session, awaiting) {
  if (!session.run || Boolean(session.run.awaitingUser) === awaiting) return;
  session.run.awaitingUser = awaiting;
  session.run.lastEventAt = Date.now();
  broadcastRuns();
}
function nameFromPrompt(prompt) {
  const firstClause = prompt.trim().split(/[.!?\n]/)[0]?.trim() ?? "";
  if (!firstClause) return "New integration";
  const words = firstClause.split(/\s+/).slice(0, 6).join(" ");
  return words.length > 48 ? `${words.slice(0, 45)}…` : words;
}
function beginRun(session, mode, prompt, name) {
  const now = Date.now();
  session.run = {
    runId: `run_${now.toString(36)}_${session.id.slice(-4)}`,
    sessionId: session.id,
    mode,
    ...session.editIntegrationId ? { integrationId: session.editIntegrationId } : {},
    name: name?.trim() || nameFromPrompt(prompt),
    // Every round mints a NEW run, and the row must not lose its face when it
    // does: an edit wears the installed integration's icon from the first
    // second, and a refine keeps whatever the last round drew. Without this a
    // second round blanks the artwork down to a generic sparkle — then a green
    // check when it lands — and the row reads as something else entirely.
    // Overwritten the moment this run draws its own.
    iconDataUrl: activeIconDataUrl(session),
    prompt: prompt.trim(),
    phase: "generating",
    message: "Starting…",
    attempt: 1,
    startedAt: now,
    phaseStartedAt: now,
    lastEventAt: now,
    status: "running",
    hasDraft: false,
    estimate: readPhaseEstimates()
  };
  ensureStallWatchdog();
  broadcastRuns();
}
function nameRun(session, name, summary) {
  if (!runIsLive(session)) return;
  session.run.name = name;
  if (summary) session.run.summary = summary;
  session.run.lastEventAt = Date.now();
  broadcastRuns();
}
function setRunIcon(session, iconDataUrl) {
  if (!runIsLive(session) || !iconDataUrl) return;
  session.run.iconDataUrl = iconDataUrl;
  session.run.lastEventAt = Date.now();
  broadcastRuns();
}
function advanceRun(session, phase, message, attempt) {
  if (!runIsRunning(session)) return;
  const now = Date.now();
  if (session.run.phase !== phase) {
    recordPhaseDuration(session.run.phase, now - session.run.phaseStartedAt);
    session.run.phase = phase;
    session.run.phaseStartedAt = now;
    session.run.estimate = readPhaseEstimates();
  }
  session.run.message = message;
  if (attempt) session.run.attempt = attempt;
  session.run.lastEventAt = now;
  broadcastRuns();
}
function finishRun(session, status, error) {
  if (!runIsRunning(session)) return;
  const now = Date.now();
  if (status === "ready") {
    recordPhaseDuration(session.run.phase, now - session.run.phaseStartedAt);
  }
  session.run.status = status;
  session.run.error = error;
  session.run.awaitingUser = false;
  session.run.lastEventAt = now;
  broadcastRuns();
}
function clearRun(session) {
  if (!session.run) return;
  session.run = null;
  broadcastRuns();
}
let stallWatchdog = null;
let lastSweepAt = 0;
function ensureStallWatchdog() {
  if (stallWatchdog) return;
  lastSweepAt = 0;
  stallWatchdog = setInterval(sweepStalledRuns, WATCHDOG_INTERVAL_MS);
  stallWatchdog.unref?.();
}
function stopStallWatchdogIfIdle() {
  if (!stallWatchdog) return;
  const watching = [...sessions.values()].some(
    (session) => session.run?.status === "running"
  );
  if (watching) return;
  clearInterval(stallWatchdog);
  stallWatchdog = null;
}
function failStalledRun(session, message) {
  session.generation?.abort();
  session.generation = null;
  session.plan?.abort();
  session.plan = null;
  finishRun(session, "error", message);
  if (session.sender && !session.sender.isDestroyed()) {
    sendEvent(session, session.sender, { type: "error", message });
  }
}
function sweepStalledRuns() {
  const now = Date.now();
  const frozen = lastSweepAt ? frozenGapMs(now - lastSweepAt) : 0;
  lastSweepAt = now;
  if (frozen > 0) {
    console.warn(
      `[IntegrationStudio] ${Math.round(frozen / 1e3)}s passed with no watchdog tick (sleep or a stalled main thread) — not counting it against running builds`
    );
    for (const session of sessions.values()) {
      if (session.run?.status === "running") session.run.lastEventAt += frozen;
    }
  }
  for (const session of sessions.values()) {
    const run = session.run;
    if (!run || run.status !== "running") continue;
    const verdict = checkRunStall(run, now);
    if (!verdict.stalled) continue;
    console.warn(
      `[IntegrationStudio] Run ${run.runId} ("${run.name}") went silent in ${run.phase} for ${Math.round((now - run.lastEventAt) / 1e3)}s — stopping it`
    );
    failStalledRun(session, verdict.message);
  }
  stopStallWatchdogIfIdle();
}
function getIntegrationStudioRuns() {
  return { runs: allRuns() };
}
function getIntegrationStudioSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { run: null };
  return {
    run: session.run,
    artifact: session.draft?.artifact,
    iconDataUrl: activeIconDataUrl(session),
    serverId: session.draft?.serverId,
    planRound: session.planRound?.round,
    chatMessages: session.chat,
    terminalLogs: session.terminal
  };
}
async function removeDraftArtifacts(draft) {
  try {
    await main.getMcpClientManager().removeServer(draft.serverId);
  } catch (err) {
    console.warn("[IntegrationStudio] Draft server removal failed:", err);
  }
  try {
    fs.rmSync(draft.serverDir, { recursive: true, force: true });
  } catch (err) {
    console.warn("[IntegrationStudio] Draft folder removal failed:", err);
  }
}
async function installDraft(session, sender, artifact, originalPrompt) {
  sendEvent(session, sender, {
    type: "phase",
    phase: "installing",
    message: "Installing the draft on your computer…",
    attempt: 0
  });
  advanceRun(session, "installing", "Installing the draft on your computer…");
  const previous = session.draft;
  session.draft = null;
  if (previous) await removeDraftArtifacts(previous);
  const { config, serverDir } = await main.getMcpClientManager().generateAndSaveServer(
    {
      name: artifact.name,
      description: artifact.description,
      code: artifact.code,
      dependencies: artifact.dependencies,
      manifest: artifact.manifest
    },
    {
      draft: true,
      // Setup values the builder already entered launch with the draft, so a
      // test drive of a key-requiring integration works on the first try.
      env: draftEnv(session),
      // Baked in before the process starts, so the very first card it
      // renders is already branded. A refine replaces this whole folder,
      // which is why the mark is session state and not just a file.
      widgetMark: session.mark
    }
  );
  const draft = {
    serverId: config.id,
    serverDir,
    artifact,
    originalPrompt
  };
  session.draft = draft;
  watchDraftServerLogs(session, sender, config.id);
  await refreshDraftBranding(session, draft);
  writeStudioMeta(draft);
  const status = await main.getMcpClientManager().listServers().then((servers) => servers.find((s) => s.id === config.id));
  sendEvent(session, sender, {
    type: "draft-installed",
    serverId: config.id,
    serverDir,
    state: status?.state === "connected" ? "connected" : "error",
    toolCount: status?.toolCount ?? 0,
    error: status?.state === "connected" ? void 0 : status?.error,
    iconDataUrl: activeIconDataUrl(session)
  });
  if (session.run) {
    session.run.hasDraft = true;
    session.run.name = artifact.manifest.name || session.run.name;
  }
  if (status?.state !== "connected") {
    finishRun(
      session,
      "error",
      status?.error ?? "The draft server failed to start"
    );
    return;
  }
  if (!session.icon) {
    advanceRun(session, "illustrating", "Drawing an icon…");
    const drawn = await generateIntegrationStudioIcon({
      sessionId: session.id
    });
    if (drawn.success && drawn.iconDataUrl) {
      sendEvent(session, sender, {
        type: "icon",
        iconDataUrl: drawn.iconDataUrl
      });
    }
  }
  await reviewDraftDesign(session, sender, session.draft?.artifact ?? artifact);
  if (session.visualReview.pendingFeedback) {
    return;
  }
  finishRun(session, "ready");
}
async function reviewDraftDesign(session, sender, artifact) {
  const {
    runVisualReview,
    shouldReviewRound,
    shouldApplyReviewFeedback,
    MAX_AUTO_REVIEW_ROUNDS
  } = await Promise.resolve().then(() => require("./integrationStudioVisualReview-Dp1t8Uwy.js"));
  if (!shouldReviewRound({
    roundsSoFar: session.visualReview.rounds,
    isCreateRun: session.run?.mode === "create"
  })) {
    return;
  }
  session.visualReview.rounds += 1;
  const message = session.visualReview.rounds > 1 ? "Checking the improved cards…" : "Reviewing the design…";
  sendEvent(session, sender, {
    type: "phase",
    phase: "reviewing",
    message,
    attempt: 0
  });
  advanceRun(session, "reviewing", message);
  const round = session.visualReview.rounds;
  const outcome = await runVisualReview(artifact, {
    previewToolResult: (toolName) => previewIntegrationStudioToolResult({ sessionId: session.id, toolName }),
    archive: ({ shots, findings, feedback, note }) => {
      const dir = archiveReviewRound({
        runKey: session.run?.runId ?? artifact.manifest.name,
        runName: artifact.manifest.name || session.run?.name || "integration",
        round,
        shots,
        findings,
        feedback,
        note
      });
      if (dir) {
        console.log(
          `[IntegrationStudio] Archived ${shots.length} card screenshot(s) from review round ${round} → ${dir}`
        );
      }
    },
    critique: async (payload) => {
      const baseUrl = "https://api.voiceos.com";
      const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
      const response = await main.authenticatedFetch(
        `${baseUrl}/integration-studio/critique`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            name: payload.artifact.manifest.name,
            summary: payload.artifact.manifest.summary,
            // The artifact's `code` can be tens of KB and tells the critic
            // nothing it can't see; only the identity travels.
            tools: payload.artifact.manifest.tools.map((tool) => ({
              name: tool.name,
              title: tool.title
            })),
            cards: payload.cards,
            // The real product, so the review can also ask whether these cards
            // look like they belong to it.
            ...session.brandReference ? { brand: session.brandReference } : {}
          }),
          signal: AbortSignal.timeout(CRITIQUE_TIMEOUT_MS)
        }
      );
      if (!response.ok) return null;
      return await response.json();
    }
  });
  if (outcome.feedback) {
    if (shouldApplyReviewFeedback({ roundsSoFar: session.visualReview.rounds })) {
      console.log(
        `[IntegrationStudio] Design review ${session.visualReview.rounds}/${MAX_AUTO_REVIEW_ROUNDS}: ${outcome.findings.length} finding(s) across ${outcome.reviewed} card(s) — polishing CSS`
      );
      session.visualReview.pendingFeedback = outcome.feedback;
      advanceRun(session, "reviewing", "Improving the cards…");
    } else {
      console.log(
        `[IntegrationStudio] Design review ${session.visualReview.rounds}/${MAX_AUTO_REVIEW_ROUNDS}: ${outcome.findings.length} finding(s) remain, round budget spent — shipping as is`
      );
    }
  } else {
    console.log(
      `[IntegrationStudio] Design review ${session.visualReview.rounds}/${MAX_AUTO_REVIEW_ROUNDS}: ${outcome.reviewed} card(s) passed${outcome.skippedReason ? ` (${outcome.skippedReason})` : ""}`
    );
  }
}
async function applyVisualCssPolish(session, sender, firstFeedback, signal) {
  let feedback = firstFeedback;
  while (feedback && !signal.aborted && session.draft && sessionAlive(session)) {
    const draft = session.draft;
    const baseUrl = "https://api.voiceos.com";
    const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
    advanceRun(session, "reviewing", "Polishing the card styles…");
    let artifact = null;
    try {
      const response = await main.authenticatedFetch(
        `${baseUrl}/integration-studio/polish-css`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ artifact: draft.artifact, feedback }),
          signal
        }
      );
      if (response.ok) {
        const parsed = await response.json();
        artifact = parsed.success && parsed.artifact ? parsed.artifact : null;
      }
    } catch (err) {
      if (!signal.aborted) {
        console.warn(
          "[IntegrationStudio] CSS-only visual polish failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
    if (!artifact) {
      console.log(
        "[IntegrationStudio] No safe CSS-only polish was available — keeping the reviewed draft"
      );
      finishRun(session, "ready");
      return;
    }
    const polished = adoptServerArtifact(session, artifact);
    sendEvent(session, sender, { type: "result", artifact: polished });
    await installDraft(session, sender, polished, draft.originalPrompt);
    feedback = session.visualReview.pendingFeedback;
    session.visualReview.pendingFeedback = null;
  }
  if (!signal.aborted && sessionAlive(session)) finishRun(session, "ready");
}
function interruptedPlan(session, prompt, controller) {
  if (!controller.signal.aborted) {
    session.planRound = {
      prompt,
      round: { questions: [], selections: [], interrupted: true }
    };
    setAwaitingUser(session, true);
  }
  return { success: true, questions: [], interrupted: true };
}
function saveIntegrationStudioPlanSelections(payload) {
  const session = sessions.get(payload.sessionId);
  if (!session?.planRound) return { success: false };
  session.planRound.round.selections = payload.selections.map((selection) => ({
    picked: Array.isArray(selection?.picked) ? selection.picked.filter((index) => Number.isInteger(index)).slice(0, 8) : [],
    other: typeof selection?.other === "string" ? selection.other.slice(0, 500) : ""
  }));
  return { success: true };
}
const MAX_CHAT_TURNS = 20;
function appendChatLine(session, line) {
  const last = session.chat[session.chat.length - 1];
  if (last?.kind && last.kind === line.kind && last.text === line.text) return;
  session.chat = [
    ...session.chat,
    { id: `chat_${node_crypto.randomUUID().slice(0, 8)}`, ...line }
  ];
}
function chatIntegrationContext(session) {
  const manifest = session.draft?.artifact.manifest;
  const properties = (schema) => {
    const bag = schema?.properties;
    return bag && typeof bag === "object" ? Object.keys(bag) : [];
  };
  return {
    name: manifest?.name ?? session.run?.name ?? "",
    summary: manifest?.summary ?? session.run?.summary,
    notes: session.draft?.artifact.notes,
    preferences: (manifest?.preferences ?? []).map((preference) => ({
      name: preference.name,
      title: preference.title,
      description: preference.description,
      required: preference.required
    })),
    tools: (manifest?.tools ?? []).map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputs: properties(tool.inputSchema),
      asksFirst: Boolean(tool.confirmation)
    })),
    hosts: main.manifestNetworkHosts(manifest) ?? []
  };
}
async function sendIntegrationStudioChat(payload) {
  const session = sessions.get(payload.sessionId);
  if (!session) return { success: false, error: "This session has ended" };
  const text = payload.text?.trim().slice(0, MAX_STUDIO_CHAT_MESSAGE_CHARS);
  const images = sanitizeBriefImages(payload.images);
  if (!text && images.length === 0) {
    return { success: false, error: "Ask a question first" };
  }
  session.chatCall?.abort();
  const controller = new AbortController();
  session.chatCall = controller;
  const question = {
    id: `chat_${node_crypto.randomUUID().slice(0, 8)}`,
    role: "user",
    text,
    ...images.length > 0 ? { images } : {}
  };
  session.chat = [...session.chat, question];
  const baseUrl = "https://api.voiceos.com";
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
  try {
    const response = await main.authenticatedFetch(
      `${baseUrl}/integration-studio/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          integration: chatIntegrationContext(session),
          // History carries only the COUNT of what rode each turn: the
          // pictures themselves would be megabytes per turn, and only the
          // newest message's are what this call has to look at.
          messages: session.chat.slice(-MAX_CHAT_TURNS).map((message) => ({
            role: message.role,
            text: message.text,
            imageCount: message.images?.length ?? 0
          })),
          images
        }),
        signal: controller.signal
      }
    );
    const body = await response.json().catch(() => ({}));
    if (controller.signal.aborted || !sessionAlive(session)) {
      return { success: false, error: "" };
    }
    let intent = body.intent === "build" ? "build" : "answer";
    let reply = body.reply?.trim() ?? "";
    if (intent === "answer" && isRefusedStudioChangeReply(reply)) {
      intent = "build";
      reply = "";
    }
    if (!response.ok || !body.success || intent === "answer" && !reply) {
      return {
        success: false,
        messages: session.chat,
        error: body.error || "Couldn't answer that — try again"
      };
    }
    if (reply) {
      appendChatLine(session, {
        role: "assistant",
        text: reply
      });
    }
    return { success: true, messages: session.chat, intent };
  } catch (err) {
    if (controller.signal.aborted) return { success: false, error: "" };
    return {
      success: false,
      messages: session.chat,
      error: err instanceof Error ? err.message : "Couldn't answer that"
    };
  } finally {
    if (session.chatCall === controller) session.chatCall = null;
  }
}
async function planIntegrationStudio(sender, payload) {
  const session = sessions.get(payload.sessionId);
  if (!session) return { success: false, error: "This session has ended" };
  session.sender = sender;
  const prompt = payload.prompt?.trim();
  const images = sanitizeBriefImages(payload.images);
  if (!prompt && images.length === 0) {
    return { success: false, error: "Prompt is required" };
  }
  rememberBriefImages(session, prompt ?? "", images);
  const held = session.planRound?.prompt === prompt && !session.planRound.round.interrupted ? session.planRound.round : null;
  session.plan?.abort();
  const controller = new AbortController();
  session.plan = held ? null : controller;
  const resumingPlan = session.run?.mode === "create" && session.run.status === "running" && session.run.phase === "planning" && session.run.prompt === prompt;
  if (!resumingPlan) {
    resetConfirmationChoices(session);
    if (!held) resetSessionBranding(session);
    session.editIntegrationId = null;
    beginRun(session, "create", prompt);
    advanceRun(session, "planning", "Working out what to build…");
  }
  if (held) {
    setAwaitingUser(session, true);
    return {
      success: true,
      name: session.run?.name,
      summary: session.run?.summary,
      questions: held.questions,
      selections: held.selections
    };
  }
  setAwaitingUser(session, false);
  const baseUrl = "https://api.voiceos.com";
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
  try {
    const response = await main.authenticatedFetch(
      `${baseUrl}/integration-studio/plan`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          prompt,
          // The plan round proposes the integration's approach (e.g. "drive
          // the Mac app via AppleScript"), so it has to know the OS it is
          // planning for.
          platform: process.platform,
          ...images.length > 0 ? { images } : {}
        }),
        signal: controller.signal
      }
    );
    if (!response.ok || !response.body) {
      return interruptedPlan(session, prompt, controller);
    }
    let parsed = {};
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawPlanLine = false;
    const handleLine = (line) => {
      if (!controller.signal.aborted) touchRun(session);
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "activity") {
        if (controller.signal.aborted) return;
        sendEvent(session, sender, {
          type: "plan-activity",
          kind: event.kind,
          text: event.text
        });
        return;
      }
      if (event.type === "plan") {
        parsed = event.plan;
        sawPlanLine = true;
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, newlineIdx));
        buffer = buffer.slice(newlineIdx + 1);
      }
    }
    handleLine(buffer);
    if (!sawPlanLine && !controller.signal.aborted) {
      return interruptedPlan(session, prompt, controller);
    }
    session.planResearch = { prompt, research: parsed.research?.trim() || "" };
    const name = parsed.name ? main.clampIntegrationName(parsed.name) : void 0;
    const summary = parsed.summary?.trim();
    if (name) nameRun(session, name, summary);
    if (name && !session.icon) void drawRunIcon(session, name, summary);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    if (questions.length > 0 && !controller.signal.aborted) {
      session.planRound = {
        prompt,
        round: { questions, selections: [] }
      };
      setAwaitingUser(session, true);
    }
    return { success: true, name, summary, questions, selections: [] };
  } catch {
    if (controller.signal.aborted) return { success: true, questions: [] };
    return interruptedPlan(session, prompt, controller);
  } finally {
    if (session.plan === controller) session.plan = null;
  }
}
async function drawRunIcon(session, name, summary) {
  const runId = session.run?.runId;
  const drawn = await drawIntegrationIcon({
    name,
    summary,
    hosts: main.manifestNetworkHosts(session.draft?.artifact.manifest)
  });
  if (!sessionAlive(session) || !session.run || session.run.runId !== runId) {
    return;
  }
  if (drawn.domain && session.brandReference?.domain !== drawn.domain) {
    beginBrandCapture(session, drawn.domain, drawn.brandColor);
  }
  if (!drawn.ok) return;
  setActiveIcon(session, "icon.png", drawn.png);
  if (session.draft) {
    await refreshDraftBranding(session, session.draft, { relaunch: true });
  }
  setRunIcon(session, activeIconDataUrl(session));
}
function cancelIntegrationStudioPlan(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.plan?.abort();
  session.plan = null;
}
async function startIntegrationStudioGeneration(sender, payload) {
  const session = sessions.get(payload.sessionId);
  if (!session) return { success: false, error: "This session has ended" };
  session.sender = sender;
  await cleanupStaleDrafts();
  session.generation?.abort();
  const controller = new AbortController();
  session.generation = controller;
  const isRefine = Boolean(payload.feedback?.trim() && session.draft);
  const prompt = isRefine ? session.draft.originalPrompt : payload.prompt.trim();
  const briefImages = isRefine ? sanitizeBriefImages(payload.images) : (() => {
    const incoming = sanitizeBriefImages(payload.images);
    rememberBriefImages(session, prompt, incoming);
    return briefImagesForPrompt(session, prompt);
  })();
  if (!prompt && briefImages.length === 0) {
    return { success: false, error: "Prompt is required" };
  }
  if (!isRefine && prompt && session.chat.length === 0) {
    appendChatLine(session, { role: "user", text: prompt });
  }
  if (payload.chatNote?.text?.trim()) {
    appendChatLine(session, {
      role: "assistant",
      kind: "terminal",
      text: payload.chatNote.text.trim().slice(0, 4e3)
    });
  }
  const continuesPlannedRun = !isRefine && session.run?.mode === "create" && session.run.status === "running" && session.run.prompt === prompt;
  const continuesPlannedBrief = !isRefine && (session.planRound?.prompt === prompt || session.planResearch?.prompt === prompt);
  if (continuesPlannedRun) {
    setAwaitingUser(session, false);
    advanceRun(
      session,
      "generating",
      "Designing and writing your integration…"
    );
  } else {
    if (!isRefine) {
      resetConfirmationChoices(session);
      if (!continuesPlannedBrief) resetSessionBranding(session);
      session.editIntegrationId = null;
    }
    beginRun(
      session,
      isRefine ? "edit" : "create",
      prompt,
      isRefine ? session.draft?.artifact.manifest.name : void 0
    );
  }
  if (!isRefine) session.planRound = null;
  if (!isRefine) resetVisualReview(session);
  const baseUrl = "https://api.voiceos.com";
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
  const brand = await brandReferenceForBuild(session);
  let terminal = null;
  const recordRoundOutcome = () => {
    if (controller.signal.aborted) return;
    if (session.run?.status === "error") {
      appendChatLine(session, {
        role: "assistant",
        kind: "buildError",
        text: session.run.error ?? ""
      });
    } else {
      appendChatLine(session, {
        role: "assistant",
        kind: "buildDone",
        text: ""
      });
    }
  };
  const endAsCancelled = () => {
    if (session.generation === controller) {
      appendChatLine(session, {
        role: "assistant",
        kind: "buildStopped",
        text: ""
      });
    }
    sendEvent(session, sender, { type: "cancelled" });
    clearRun(session);
    return { success: false, cancelled: true };
  };
  try {
    const response = await main.authenticatedFetch(
      `${baseUrl}/integration-studio/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          prompt,
          // The generated server runs on THIS machine, so the builder must
          // target its OS (osascript vs PowerShell, etc.). Sent on refines
          // too — a refine can add an OS-specific tool.
          platform: process.platform,
          // What the real product looks like. Sent on refines too: a
          // "make it match the site better" round is exactly when the
          // designer most needs the site in front of it.
          ...brand ? { brand } : {},
          // What the user showed us for THIS round — the brief's pictures on
          // a create, the ones attached to the change request on a refine.
          ...briefImages.length > 0 ? { images: briefImages } : {},
          ...isRefine ? {
            priorArtifact: session.draft.artifact,
            feedback: payload.feedback.trim()
          } : (
            // Decisions from the plan round shape the first build only; a
            // refine already has the built artifact as context. The plan's
            // researched API facts ride along with them.
            {
              planAnswers: payload.planAnswers ?? [],
              planResearch: researchForPrompt(session, prompt)
            }
          )
        }),
        signal: controller.signal
      }
    );
    if (!response.ok || !response.body) {
      const err = await response.json().catch(() => ({}));
      const message = err.error || `Server error (${response.status})`;
      sendEvent(session, sender, { type: "error", message });
      finishRun(session, "error", message);
      recordRoundOutcome();
      return { success: false, error: message };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const handleLine = async (line) => {
      if (controller.signal.aborted) return;
      touchRun(session);
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "result") {
        terminal = "result";
        const artifact = adoptServerArtifact(session, event.artifact);
        sendEvent(session, sender, { ...event, artifact });
        try {
          await installDraft(session, sender, artifact, prompt);
        } catch (err) {
          const message = `Draft install failed: ${err instanceof Error ? err.message : "unknown error"}`;
          sendEvent(session, sender, { type: "error", message });
          finishRun(session, "error", message);
        }
        return;
      }
      if (event.type === "error") {
        terminal = "error";
        finishRun(session, "error", event.message);
      } else if (event.type === "phase") {
        advanceRun(session, event.phase, event.message, event.attempt);
      } else if (event.type === "draft" && event.name && session.run) {
        session.run.name = main.clampIntegrationName(event.name);
        session.run.lastEventAt = Date.now();
        broadcastRuns();
      }
      sendEvent(session, sender, event);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        await handleLine(line);
      }
    }
    await handleLine(buffer);
    if (!terminal) {
      if (controller.signal.aborted) return endAsCancelled();
      const message = "The generation stream ended unexpectedly. Please try again.";
      sendEvent(session, sender, { type: "error", message });
      finishRun(session, "error", message);
      recordRoundOutcome();
      return { success: false, error: message };
    }
    if (terminal === "result" && session.visualReview.pendingFeedback) {
      const feedback = session.visualReview.pendingFeedback;
      session.visualReview.pendingFeedback = null;
      if (!controller.signal.aborted) {
        await applyVisualCssPolish(
          session,
          sender,
          feedback,
          controller.signal
        );
        recordRoundOutcome();
        return { success: true };
      }
    }
    recordRoundOutcome();
    return terminal === "result" ? { success: true } : { success: false, error: "Generation failed" };
  } catch (err) {
    if (controller.signal.aborted) {
      if (!terminal) return endAsCancelled();
      if (session.run?.status === "running") {
        if (session.generation === controller) {
          appendChatLine(session, {
            role: "assistant",
            kind: "buildStopped",
            text: ""
          });
        }
        clearRun(session);
      }
      return { success: false, cancelled: true };
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    if (!terminal) {
      sendEvent(session, sender, { type: "error", message });
      finishRun(session, "error", message);
      recordRoundOutcome();
    }
    return { success: false, error: message };
  } finally {
    if (session.generation === controller) session.generation = null;
  }
}
function cancelIntegrationStudioGeneration(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.generation?.abort();
  session.generation = null;
  cancelIntegrationStudioPlan(sessionId);
}
function getIntegrationStudioDraft(sessionId) {
  return sessions.get(sessionId)?.draft ?? null;
}
async function restartIntegrationStudioDraftServer(sender, payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!session || !draft) {
    return { success: false, error: "No draft server to restart" };
  }
  session.sender = sender;
  sendEvent(session, sender, {
    type: "log",
    message: "Restarting the app's server…",
    tone: "info"
  });
  try {
    const status = await main.getMcpClientManager().refreshServer(draft.serverId);
    const connected = status?.state === "connected";
    sendEvent(session, sender, {
      type: "draft-installed",
      serverId: draft.serverId,
      serverDir: draft.serverDir,
      state: connected ? "connected" : "error",
      toolCount: status?.toolCount ?? 0,
      error: connected ? void 0 : status?.error ?? "The server didn't come back up",
      iconDataUrl: activeIconDataUrl(session)
    });
    return { success: true, state: connected ? "connected" : "error" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't restart the server";
    sendEvent(session, sender, { type: "log", message, tone: "error" });
    return { success: false, error: message };
  }
}
const MAX_FIX_LINE_CHARS = 300;
const MAX_FIX_EXCERPT_CHARS = 4e3;
async function getIntegrationStudioServerLogs(payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!session || !draft) return { success: false, error: "No draft server" };
  const snapshot = await main.getMcpClientManager().getServerRuntimeSnapshot(
    draft.serverId
  );
  if (!snapshot) {
    return { success: false, error: "The server isn't registered" };
  }
  const clock = (timestamp) => {
    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };
  const lines = snapshot.logs.slice(-25).map(
    (entry) => `[${clock(entry.timestamp)}] ${entry.text.slice(0, MAX_FIX_LINE_CHARS)}`
  );
  const header = [
    `state: ${snapshot.state}`,
    ...snapshot.error ? [`error: ${snapshot.error.slice(0, MAX_FIX_LINE_CHARS)}`] : []
  ];
  return {
    success: true,
    excerpt: [...header, ...lines].join("\n").slice(0, MAX_FIX_EXCERPT_CHARS)
  };
}
function setIntegrationStudioToolConfirmation(payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!session || !draft)
    return { success: false, error: "No draft to update" };
  const tool = draft.artifact.manifest.tools.find(
    (candidate) => candidate.name === payload.toolName
  );
  if (!tool) {
    return { success: false, error: `Unknown action "${payload.toolName}"` };
  }
  if (tool.disabled) {
    return { success: false, error: "This action is disabled by the app." };
  }
  if (tool.confirmation)
    session.authoredConfirmations.set(tool.name, tool.confirmation);
  session.confirmationChoices.set(payload.toolName, payload.required);
  const manifest = main.applyWidgetMarkToView(
    setToolConfirmation(
      draft.artifact.manifest,
      payload.toolName,
      payload.required,
      session.authoredConfirmations.get(payload.toolName)
    ),
    session.mark
  );
  draft.artifact = { ...draft.artifact, manifest };
  writeDraftManifestPatch(draft, { tools: manifest.tools });
  return { success: true, manifest };
}
function renameIntegrationStudioDraft(payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!session || !draft)
    return { success: false, error: "No draft to rename" };
  const name = main.clampIntegrationName(payload.name);
  if (!name) return { success: false, error: "Name can't be empty" };
  if (name === draft.artifact.manifest.name) {
    return { success: true, manifest: draft.artifact.manifest };
  }
  const manifest = { ...draft.artifact.manifest, name };
  draft.artifact = { ...draft.artifact, manifest };
  writeDraftManifestPatch(draft, { name });
  nameRun(session, name);
  return { success: true, manifest };
}
async function setIntegrationStudioConfigValues(sender, payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!session || !draft) {
    return { success: false, error: "No draft to configure" };
  }
  for (const [key, value] of Object.entries(payload.values)) {
    if (value) session.configValues.set(key, value);
    else session.configValues.delete(key);
  }
  try {
    await main.getMcpClientManager().updateServer(draft.serverId, {
      env: draftEnv(session) ?? {}
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
  const values = Object.fromEntries(session.configValues);
  if (main.isSetupComplete(draft.artifact.manifest, values)) {
    void runDraftSelfTest(session, sender, draft);
  }
  return { success: true, configuredFields: [...session.configValues.keys()] };
}
async function runDraftSelfTest(session, sender, draft) {
  const tools = draft.artifact.manifest.tools.filter((tool) => !tool.disabled);
  if (tools.length === 0 || session.generation) return;
  const signature = `${draft.serverId}:${JSON.stringify([...session.configValues].sort())}`;
  if (session.lastSelfTestSignature === signature) return;
  session.lastSelfTestSignature = signature;
  const log2 = (message, tone) => {
    if (sessionAlive(session) && session.draft === draft)
      sendEvent(session, sender, { type: "log", message, tone });
  };
  const fixtures = {};
  for (const entry of draft.artifact.preview?.toolPreviews ?? []) {
    if (entry.sampleArgs) fixtures[entry.tool] = entry.sampleArgs;
  }
  log2(
    `Everything's filled in — trying ${tools.length === 1 ? "the action" : `all ${tools.length} actions`}…`,
    "info"
  );
  try {
    const { checkStudioTools, summarizeChecks } = await Promise.resolve().then(() => require("./integrationStudioSelfTest-Bz7EhWyi.js"));
    const checks = await checkStudioTools({
      tools,
      fixtures,
      execute: (toolName, args) => main.getMcpClientManager().executeTool(draft.serverId, toolName, args),
      onCheck: (check) => {
        log2(check.message, check.tone);
        if (check.glance && sessionAlive(session) && session.draft === draft) {
          rememberLiveFixture(draft, check.tool, check.glance);
        }
      }
    });
    const summary = summarizeChecks(checks);
    log2(summary.message, summary.tone);
    console.log(
      `[IntegrationStudio] Self-test for "${draft.artifact.manifest.name}": ${summary.message}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log2(`Couldn't finish checking the actions: ${message}`, "warn");
  }
}
function rememberLiveFixture(draft, toolName, glance) {
  const preview = draft.artifact.preview ?? {
    utterances: [],
    toolPreviews: []
  };
  const existing = preview.toolPreviews.find(
    (entry) => entry.tool === toolName
  );
  const toolPreviews = existing ? preview.toolPreviews.map(
    (entry) => entry.tool === toolName ? { ...entry, sampleGlance: glance } : entry
  ) : [
    ...preview.toolPreviews,
    { tool: toolName, sampleArgs: {}, sampleGlance: glance }
  ];
  draft.artifact = {
    ...draft.artifact,
    preview: { ...preview, toolPreviews }
  };
  writeStudioMeta(draft);
}
async function previewIntegrationStudioToolResult(payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!draft) return { success: false, error: "no-draft" };
  const tool = draft.artifact.manifest.tools.find(
    (candidate) => candidate.name === payload.toolName
  );
  if (!tool) {
    return { success: false, error: `Unknown action "${payload.toolName}"` };
  }
  if (tool.disabled || tool.visibility === "agent") {
    return { success: false, error: "action-unavailable" };
  }
  if (tool.confirmation) {
    return { success: false, error: "acting-tool" };
  }
  const fixture = draft.artifact.preview?.toolPreviews?.find(
    (entry) => entry.tool === tool.name
  );
  try {
    const result = await main.getMcpClientManager().executeTool(
      draft.serverId,
      tool.name,
      fixture?.sampleArgs ?? {}
    );
    const { extractGlanceFromToolResult } = await Promise.resolve().then(() => require("./integrationStudioTestRunner-C0pMeJO7.js"));
    const glance = extractGlanceFromToolResult(result);
    if (!glance) return { success: false, error: "no-card" };
    rememberLiveFixture(draft, tool.name, glance);
    return { success: true, glance };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Preview run failed"
    };
  }
}
function getIntegrationStudioConfigState(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      success: true,
      configuredFields: [],
      values: {},
      secretLengths: {}
    };
  }
  return buildStudioConfigState(
    session.configValues,
    session.draft?.artifact.manifest
  );
}
function revealIntegrationStudioConfigSecret(payload) {
  const session = sessions.get(payload.sessionId);
  if (!session) return { success: false, error: "No session" };
  const declared = main.setupFields(session.draft?.artifact.manifest).find(
    (field) => field.name === payload.field && field.secret
  );
  if (!declared) return { success: false, error: "Unknown setup field" };
  return {
    success: true,
    value: session.configValues.get(payload.field) ?? ""
  };
}
async function resolveBrand(input) {
  const baseUrl = "https://api.voiceos.com";
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
  try {
    const response = await main.authenticatedFetch(
      `${baseUrl}/integration-studio/brand`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: input.name,
          summary: input.summary,
          hosts: input.hosts ?? []
        }),
        signal: AbortSignal.timeout(25e3)
      }
    );
    const brand = await response.json().catch(() => ({}));
    return {
      domain: brand.domain || void 0,
      brandColor: brand.brandColor || void 0
    };
  } catch (err) {
    log.warn(
      "[IntegrationStudio] Brand lookup skipped:",
      err instanceof Error ? err.message : err
    );
    return {};
  }
}
async function resolveIconSource(input) {
  const baseUrl = "https://api.voiceos.com";
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
  try {
    const response = await main.authenticatedFetch(
      `${baseUrl}/integration-studio/icon-source`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          direction: input.direction,
          name: input.name,
          summary: input.summary,
          hosts: input.hosts ?? []
        }),
        signal: AbortSignal.timeout(2e4)
      }
    );
    const source = await response.json().catch(() => ({}));
    return {
      wantsRealLogo: source.wantsRealLogo === true,
      domain: source.domain || void 0,
      brandColor: source.brandColor || void 0,
      logoDescription: source.logoDescription || void 0
    };
  } catch (err) {
    log.warn(
      "[IntegrationStudio] Icon direction lookup skipped:",
      err instanceof Error ? err.message : err
    );
    return { wantsRealLogo: false };
  }
}
async function fetchLogoIcon(domain, name, requested) {
  const { buildBrandIcon } = await Promise.resolve().then(() => require("./integrationBrandIcon-oL9tRxzY.js"));
  const branded = await buildBrandIcon(domain, { requested });
  if (!branded) return null;
  log.info(
    `[IntegrationStudio] Icon for "${name}": real logo from ${domain} (${branded.sourcePx}px ${branded.fullBleed ? "full-bleed tile" : "glyph"}, ${branded.dominantColor})`
  );
  return branded.png;
}
async function drawIntegrationIcon(input) {
  const baseUrl = "https://api.voiceos.com";
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN) || "";
  let brandColor;
  let domain;
  let logoResearch;
  const direction = input.stylePrompt?.trim();
  log.info(
    `[IntegrationStudio] Icon draw for "${input.name}"${direction ? `: "${direction.slice(0, 120)}"` : " (no direction)"}`
  );
  try {
    if (direction) {
      const source = await resolveIconSource({
        direction,
        name: input.name,
        summary: input.summary,
        hosts: input.hosts
      });
      brandColor = source.brandColor;
      if (source.wantsRealLogo) {
        domain = source.domain;
        logoResearch = source.logoDescription;
        if (source.domain) {
          const png = await fetchLogoIcon(source.domain, input.name, true);
          if (png) return { ok: true, png, domain, brandColor };
          log.info(
            `[IntegrationStudio] Icon for "${input.name}": asked for ${source.domain}'s logo, nothing usable there — drawing it instead`
          );
        }
      }
    } else {
      const brand = await resolveBrand({
        name: input.name,
        summary: input.summary,
        hosts: input.hosts
      });
      brandColor = brand.brandColor;
      domain = brand.domain;
      if (brand.domain) {
        const png = await fetchLogoIcon(brand.domain, input.name, false);
        if (png) return { ok: true, png, domain, brandColor };
        log.info(
          `[IntegrationStudio] Icon for "${input.name}": no usable logo at ${brand.domain}, generating${brandColor ? ` in ${brandColor}` : ""}`
        );
      }
    }
  } catch (err) {
    log.warn(
      "[IntegrationStudio] Brand lookup skipped:",
      err instanceof Error ? err.message : err
    );
  }
  try {
    const response = await main.authenticatedFetch(
      `${baseUrl}/integration-studio/icon`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: input.name,
          summary: input.summary,
          stylePrompt: direction || void 0,
          brandColor,
          logoResearch
        }),
        signal: AbortSignal.timeout(6e4)
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success || !body.base64) {
      return {
        ok: false,
        error: body.error || `Icon generation failed (${response.status})`,
        domain,
        brandColor
      };
    }
    const original = electron.nativeImage.createFromBuffer(
      Buffer.from(body.base64, "base64")
    );
    if (original.isEmpty()) {
      return {
        ok: false,
        error: "The generated icon was unreadable",
        domain,
        brandColor
      };
    }
    return {
      ok: true,
      png: original.resize({ width: 256, height: 256 }).toPNG(),
      domain,
      brandColor
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error && err.name === "TimeoutError" ? "Icon generation timed out." : err instanceof Error ? err.message : "Icon generation failed",
      domain,
      brandColor
    };
  }
}
async function generateIntegrationStudioIcon(payload) {
  const session = sessions.get(payload.sessionId);
  const draft = session?.draft;
  if (!session || !draft) {
    return { success: false, error: "No draft to illustrate" };
  }
  const manifest = draft.artifact.manifest;
  const drawn = await drawIntegrationIcon({
    name: manifest.name,
    summary: manifest.summary,
    stylePrompt: payload.stylePrompt,
    hosts: main.manifestNetworkHosts(manifest)
  });
  if (!drawn.ok) return { success: false, error: drawn.error };
  if (!sessionAlive(session)) {
    return { success: false, error: "This session has ended" };
  }
  setActiveIcon(session, "icon.png", drawn.png);
  setRunIcon(session, activeIconDataUrl(session));
  if (session.draft) {
    await refreshDraftBranding(session, session.draft, { relaunch: true });
  }
  return { success: true, iconDataUrl: activeIconDataUrl(session) };
}
async function generateInstalledIntegrationIcon(payload) {
  const { getIntegrationManager } = await Promise.resolve().then(() => require("../main.js")).then((n) => n.integrationManager);
  const manager = getIntegrationManager();
  const described = manager.describeForIcon(payload.integrationId);
  if (!described) {
    log.warn(
      `[IntegrationStudio] Icon edit for ${payload.integrationId}: not installed`
    );
    return { success: false, error: "Integration is not installed" };
  }
  const drawn = await drawIntegrationIcon({
    name: described.name,
    summary: described.summary,
    stylePrompt: payload.stylePrompt,
    hosts: described.hosts
  });
  if (!drawn.ok) {
    log.warn(
      `[IntegrationStudio] Icon draw failed for "${described.name}": ${drawn.error}`
    );
    return { success: false, error: drawn.error };
  }
  const applied = await manager.setIcon(
    payload.integrationId,
    `data:image/png;base64,${drawn.png.toString("base64")}`
  );
  if (!applied.ok) {
    log.warn(
      `[IntegrationStudio] Icon write failed for "${described.name}": ${applied.error}`
    );
    return { success: false, error: applied.error };
  }
  if (!applied.iconDataUrl) {
    log.warn(
      `[IntegrationStudio] Icon for "${described.name}" wrote but did not resolve`
    );
    return { success: false, error: "The new icon could not be read back." };
  }
  log.info(
    `[IntegrationStudio] Icon updated for "${described.name}" (${Math.round(drawn.png.length / 1024)} KB${payload.stylePrompt ? ", custom direction" : ""})`
  );
  return { success: true, iconDataUrl: applied.iconDataUrl };
}
async function startIntegrationStudioEditSession(sender, payload) {
  const session = sessions.get(payload.sessionId);
  if (!session) return { success: false, error: "This session has ended" };
  const integrationId = payload.integrationId;
  for (const other of sessions.values()) {
    if (other === session) continue;
    if (other.editIntegrationId === integrationId && (other.draft || other.run)) {
      if (!session.draft && !session.run) disposeSession(session);
      return { success: true, sessionId: other.id };
    }
  }
  await cleanupStaleDrafts();
  session.generation?.abort();
  resetConfirmationChoices(session);
  resetSessionBranding(session);
  const { getIntegrationManager } = await Promise.resolve().then(() => require("../main.js")).then((n) => n.integrationManager);
  const installed = (await getIntegrationManager().list()).find(
    (record) => record.manifest.id === integrationId
  );
  if (!installed?.dirPath) {
    return { success: false, error: "Integration not found" };
  }
  const installedDir = installed.dirPath;
  for (const [key, value] of Object.entries(
    getIntegrationManager().getDecryptedConfigValues(integrationId)
  )) {
    if (value) session.configValues.set(key, value);
  }
  const serverTsPath = path.join(installedDir, "server.ts");
  if (!fs.existsSync(serverTsPath)) {
    return {
      success: false,
      error: "Only integrations generated by the Studio can be edited here."
    };
  }
  session.editIntegrationId = installed.manifest.id;
  let dependencies = [];
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(installedDir, "package.json"), "utf-8")
    );
    const builtin = /* @__PURE__ */ new Set(["@modelcontextprotocol/sdk", "zod", "tsx"]);
    dependencies = Object.keys(pkg.dependencies ?? {}).filter(
      (dep) => !builtin.has(dep)
    );
  } catch {
  }
  let meta = {};
  try {
    meta = JSON.parse(
      fs.readFileSync(path.join(installedDir, "studio-meta.json"), "utf-8")
    );
  } catch {
  }
  const manifest = installed.manifest;
  const iconFile = manifest.icon?.trim();
  if (iconFile && !iconFile.includes("..") && !/^(https?:|data:)/i.test(iconFile)) {
    try {
      setActiveIcon(
        session,
        path.basename(iconFile),
        fs.readFileSync(path.join(installedDir, iconFile))
      );
    } catch {
      resetSessionBranding(session);
    }
  }
  const artifact = {
    name: manifest.id.split(".").pop() || manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: manifest.summary,
    code: fs.readFileSync(serverTsPath, "utf-8"),
    dependencies,
    manifest,
    preview: meta.preview ?? { utterances: [], toolPreviews: [] }
  };
  const originalPrompt = meta.originalPrompt?.trim() || `Improve the "${manifest.name}" integration`;
  try {
    sendEvent(session, sender, { type: "result", artifact });
    await installDraft(session, sender, artifact, originalPrompt);
    return { success: true, sessionId: session.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to open the integration";
    sendEvent(session, sender, { type: "error", message });
    return { success: false, error: message };
  }
}
async function resolveIntegrationStudioHandoff(input) {
  const draft = input.sessionId ? sessions.get(input.sessionId)?.draft : void 0;
  if (draft) {
    return {
      dir: draft.serverDir,
      name: draft.artifact.manifest.name
    };
  }
  if (!input.integrationId) return null;
  const { getIntegrationManager } = await Promise.resolve().then(() => require("../main.js")).then((n) => n.integrationManager);
  const installed = (await getIntegrationManager().list()).find(
    (record) => record.manifest.id === input.integrationId
  );
  return installed?.dirPath ? { dir: installed.dirPath, name: installed.manifest.name } : null;
}
async function saveIntegrationStudioDraft(sessionId) {
  const session = sessions.get(sessionId);
  const draft = session?.draft;
  if (!session || !draft) return { success: false, error: "No draft to save" };
  const manager = main.getMcpClientManager();
  try {
    const { getIntegrationManager } = await Promise.resolve().then(() => require("../main.js")).then((n) => n.integrationManager);
    const previousDir = (await getIntegrationManager().list()).find(
      (record) => record.manifest.id === draft.artifact.manifest.id
    )?.dirPath;
    const installed = await getIntegrationManager().install(draft.serverDir);
    if (session.configValues.size > 0) {
      await getIntegrationManager().setConfigValues(
        installed.manifest.id,
        Object.fromEntries(session.configValues)
      );
    }
    await manager.removeServer(draft.serverId);
    session.draft = null;
    disposeSession(session);
    if (previousDir && previousDir !== draft.serverDir && previousDir.startsWith(main.getGeneratedServersRoot())) {
      try {
        fs.rmSync(previousDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(
          "[IntegrationStudio] Superseded folder cleanup failed:",
          err
        );
      }
    }
    return {
      success: true,
      integrationId: installed.manifest.id,
      dirPath: draft.serverDir
    };
  } catch (err) {
    console.warn(
      "[IntegrationStudio] Marketplace install failed, keeping as custom MCP:",
      err
    );
    const promoted = await manager.promoteDraft(draft.serverId);
    if (promoted) {
      session.draft = null;
      disposeSession(session);
      return { success: true, dirPath: draft.serverDir };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save integration"
    };
  }
}
async function discardIntegrationStudioDraft(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { success: true };
  cancelIntegrationStudioGeneration(sessionId);
  const draft = session.draft;
  session.draft = null;
  disposeSession(session);
  if (draft) await removeDraftArtifacts(draft);
  return { success: true };
}
exports.cancelIntegrationStudioGeneration = cancelIntegrationStudioGeneration;
exports.cancelIntegrationStudioPlan = cancelIntegrationStudioPlan;
exports.discardIntegrationStudioDraft = discardIntegrationStudioDraft;
exports.generateInstalledIntegrationIcon = generateInstalledIntegrationIcon;
exports.generateIntegrationStudioIcon = generateIntegrationStudioIcon;
exports.getIntegrationStudioConfigState = getIntegrationStudioConfigState;
exports.getIntegrationStudioDraft = getIntegrationStudioDraft;
exports.getIntegrationStudioRuns = getIntegrationStudioRuns;
exports.getIntegrationStudioServerLogs = getIntegrationStudioServerLogs;
exports.getIntegrationStudioSession = getIntegrationStudioSession;
exports.openIntegrationStudioSession = openIntegrationStudioSession;
exports.planIntegrationStudio = planIntegrationStudio;
exports.previewIntegrationStudioToolResult = previewIntegrationStudioToolResult;
exports.renameIntegrationStudioDraft = renameIntegrationStudioDraft;
exports.resolveIntegrationStudioHandoff = resolveIntegrationStudioHandoff;
exports.restartIntegrationStudioDraftServer = restartIntegrationStudioDraftServer;
exports.revealIntegrationStudioConfigSecret = revealIntegrationStudioConfigSecret;
exports.saveIntegrationStudioDraft = saveIntegrationStudioDraft;
exports.saveIntegrationStudioPlanSelections = saveIntegrationStudioPlanSelections;
exports.sendIntegrationStudioChat = sendIntegrationStudioChat;
exports.setIntegrationStudioConfigValues = setIntegrationStudioConfigValues;
exports.setIntegrationStudioToolConfirmation = setIntegrationStudioToolConfirmation;
exports.startIntegrationStudioEditSession = startIntegrationStudioEditSession;
exports.startIntegrationStudioGeneration = startIntegrationStudioGeneration;
