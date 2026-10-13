"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "5c533da3-7574-409f-bcf2-0b0537f8a9b0", e._sentryDebugIdIdentifier = "sentry-dbid-5c533da3-7574-409f-bcf2-0b0537f8a9b0");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const main = require("../main.js");
require("path");
require("electron");
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
const dependencies = {
  read: (ids) => main.readClaudeDesktopSessions({ onlySessionIds: ids }),
  list: main.listClaudeSessionTasks,
  get: main.getCodingAgentTask,
  update: main.updateCodingAgentTask
};
async function syncClaudeDesktopSessions(userId, isCurrent, isOwned, deps = dependencies) {
  const existing = (await deps.list(userId)).filter(
    (record) => record.sessionRef && !record.resultMeta?.claudeDesktop?.imported && !record.orchestrationId && !record.workflowRunId && (record.resultMeta?.sessionHandedOffAtMs || record.resultMeta?.claudeDesktop)
  );
  if (!isCurrent() || existing.length === 0) return;
  const recordsBySession = new Map(
    existing.map((record) => [record.sessionRef, record])
  );
  const sessions = await deps.read(new Set(recordsBySession.keys()));
  for (const session of sessions) {
    if (!isCurrent()) return;
    const previous = recordsBySession.get(session.sessionId);
    if (!previous) continue;
    const taskId = previous.id;
    await main.withCodingAgentTaskSessionLock(taskId, async () => {
      if (!isCurrent() || isOwned(taskId)) return;
      const record = await deps.get(taskId, userId);
      if (!isCurrent() || isOwned(taskId) || !record || record.userId !== userId || record.sessionRef !== session.sessionId || record.resultMeta?.claudeDesktop?.imported || record.status === "queued" || record.status === "running")
        return;
      const old = record.resultMeta?.claudeDesktop;
      const namePrefix = record.sessionName ? `${record.sessionName}: ` : "";
      const title = namePrefix && session.title.startsWith(namePrefix) ? session.title.slice(namePrefix.length) : session.title;
      const parsed = main.parseCodingAgentResult(session.response);
      const response = parsed.text || parsed.digest?.did || session.response.trim();
      const newerContent = Boolean(
        session.exchangeId && session.completedAtMs && session.completedAtMs > (record.finishedAtMs ?? 0) && (old?.exchangeId !== session.exchangeId || record.prompt !== session.prompt || record.resultText !== response)
      );
      const exchangeId = session.exchangeId ?? old?.exchangeId;
      if (!newerContent && old?.modifiedAtMs === session.modifiedAtMs && old.open === session.open && old.archived === session.archived && record.title === title && record.directory === session.directory && old.exchangeId === exchangeId)
        return;
      const resultMeta = {
        ...record.resultMeta,
        // A digest from the previous VoiceOS turn no longer describes Desktop's reply.
        ...newerContent ? {
          digest: void 0,
          changes: void 0,
          images: void 0,
          inputImages: void 0
        } : {},
        claudeDesktop: {
          modifiedAtMs: session.modifiedAtMs,
          open: session.open,
          archived: session.archived,
          imported: false,
          ...exchangeId ? { exchangeId } : {}
        }
      };
      await deps.update({
        ...record,
        title,
        prompt: newerContent ? session.prompt : record.prompt,
        directory: session.directory,
        resultText: newerContent ? response : record.resultText,
        resultMeta,
        status: newerContent ? "completed" : record.status,
        errorMessage: newerContent ? null : record.errorMessage,
        pendingPrompt: newerContent ? null : record.pendingPrompt,
        stats: newerContent ? null : record.stats,
        finishedAtMs: newerContent ? session.completedAtMs : record.finishedAtMs
      });
    });
  }
}
exports.syncClaudeDesktopSessions = syncClaudeDesktopSessions;
