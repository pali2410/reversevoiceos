"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "cd50cd1b-05ba-41cf-87a7-2f1480bd6191", e._sentryDebugIdIdentifier = "sentry-dbid-cd50cd1b-05ba-41cf-87a7-2f1480bd6191");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const log = require("electron-log");
const main = require("../main.js");
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
require("node:crypto");
require("zod");
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
const getServerBaseUrl = () => "https://api.voiceos.com".replace(
  /\/+$/,
  ""
);
async function sendTwitterDmFromComposer(request) {
  const text = typeof request.text === "string" ? request.text.trim() : "";
  const recipientId = typeof request.recipientId === "string" ? request.recipientId.trim() : "";
  if (!text) return { success: false, error: "Enter a message first." };
  if (!/^\d+$/.test(recipientId)) {
    return {
      success: false,
      error: "VoiceOS couldn't identify the recipient in this X conversation. Refresh the thread and try again.",
      errorKind: "invalid"
    };
  }
  const accessToken = main.store.get(main.STORE_KEYS.ACCESS_TOKEN);
  if (!accessToken) {
    return {
      success: false,
      error: "Sign in to VoiceOS before sending an X message.",
      errorKind: "auth"
    };
  }
  try {
    const response = await main.authenticatedFetch(
      `${getServerBaseUrl()}/integrations/twitter/dm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          text,
          recipientId,
          ...request.conversationId ? { conversationId: request.conversationId } : {}
        })
      }
    );
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      return {
        success: false,
        error: result?.error || (response.status === 401 || response.status === 403 ? "Sign in to VoiceOS and reconnect X, then try again." : "X couldn't send that message. Try again."),
        errorKind: result?.errorKind || "unknown"
      };
    }
    return result;
  } catch (error) {
    log.warn("[TwitterDirectMessage] request failed", {
      recipientId,
      textLength: text.length,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      success: false,
      error: "VoiceOS couldn't reach X. Check your connection and try again.",
      errorKind: "transient"
    };
  }
}
exports.sendTwitterDmFromComposer = sendTwitterDmFromComposer;
