"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "b6ab7d1f-efb9-4b1d-a761-85a256a848ce", e._sentryDebugIdIdentifier = "sentry-dbid-b6ab7d1f-efb9-4b1d-a761-85a256a848ce");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
require("node:crypto");
const log = require("electron-log");
const main = require("../main.js");
require("zod");
require("path");
require("electron");
require("node:child_process");
require("node:fs");
require("node:fs/promises");
require("node:path");
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
const SETUP_ID_PREFIX = "setup:";
function isSetupConfirmationId(confirmationId) {
  return confirmationId.startsWith(SETUP_ID_PREFIX);
}
const pendingPrompts = /* @__PURE__ */ new Map();
async function resolveIntegrationSetupPrompt(confirmationId, approved, updatedInputJson) {
  const pending = pendingPrompts.get(confirmationId);
  if (!pending) return isSetupConfirmationId(confirmationId);
  pendingPrompts.delete(confirmationId);
  if (!approved) {
    log.info(`[IntegrationSetup] ${pending.integrationName} setup dismissed`);
    pending.settle("declined");
    return true;
  }
  const values = parseSetupValues(updatedInputJson);
  if (Object.keys(values).length === 0) {
    pending.settle("declined");
    return true;
  }
  try {
    await main.getIntegrationManager().setConfigValues(pending.manifestId, values, {
      awaitReconnect: true
    });
    log.info(
      `[IntegrationSetup] Saved ${Object.keys(values).length} field(s) for ${pending.integrationName} and reconnected`
    );
    pending.settle("saved");
  } catch (error) {
    log.error(
      `[IntegrationSetup] Reconnect after setup failed for ${pending.integrationName}:`,
      error instanceof Error ? error.message : error
    );
    pending.settle("declined");
  }
  return true;
}
function parseSetupValues(updatedInputJson) {
  if (!updatedInputJson) return {};
  let parsed;
  try {
    parsed = JSON.parse(updatedInputJson);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out = {};
  for (const [key, value] of Object.entries(
    parsed
  )) {
    if (value === null || value === void 0) continue;
    if (typeof value === "object") continue;
    out[key] = String(value);
  }
  return out;
}
exports.isSetupConfirmationId = isSetupConfirmationId;
exports.resolveIntegrationSetupPrompt = resolveIntegrationSetupPrompt;
