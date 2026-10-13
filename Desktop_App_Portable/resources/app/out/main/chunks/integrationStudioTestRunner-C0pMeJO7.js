"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "436caad5-7ae8-460b-88d8-76c00c0f1332", e._sentryDebugIdIdentifier = "sentry-dbid-436caad5-7ae8-460b-88d8-76c00c0f1332");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const node_crypto = require("node:crypto");
const main = require("../main.js");
const integrationStudioService = require("./integrationStudioService-DS6DugjF.js");
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
const RUN_DEADLINE_MS = 12e4;
const testStates = /* @__PURE__ */ new Map();
function stateFor(sessionId) {
  let state = testStates.get(sessionId);
  if (!state) {
    state = {
      run: null,
      chatSessionId: void 0,
      chatDraftServerId: void 0
    };
    testStates.set(sessionId, state);
  }
  return state;
}
function sendTestEvent(sessionId, sender, event) {
  try {
    if (!sender.isDestroyed()) {
      sender.send(main.IPC_EVENTS.INTEGRATION_STUDIO_TEST_EVENT, {
        ...event,
        sessionId
      });
    }
  } catch {
  }
}
function extractGlanceFromToolResult(result) {
  const liftBlocks = (raw) => {
    const blocks = raw?.blocks;
    if (!Array.isArray(blocks)) return void 0;
    const shaped = blocks.filter(
      (b) => !!b && typeof b === "object" && typeof b.type === "string"
    ).slice(0, 3);
    return shaped.length > 0 ? { blocks: shaped } : void 0;
  };
  try {
    const record = result;
    if (record && typeof record === "object" && "_voiceos_glance" in record) {
      return liftBlocks(record._voiceos_glance);
    }
    const content = record?.content;
    const texts = Array.isArray(content) ? content.filter(
      (c) => !!c && typeof c === "object" && c.type === "text" && typeof c.text === "string"
    ).map((c) => c.text) : typeof result === "string" ? [result] : [];
    for (const text of texts) {
      if (!text.includes("_voiceos_glance")) continue;
      const parsed = JSON.parse(text);
      const lifted = liftBlocks(parsed?._voiceos_glance);
      if (lifted) return lifted;
    }
  } catch {
  }
  return void 0;
}
function parseConfirmActionDetails(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    const action = parsed.actions?.[0];
    return {
      originalName: typeof action?.name === "string" ? action.name : "",
      args: action?.params && typeof action.params === "object" ? action.params : {}
    };
  } catch {
    return { originalName: "", args: {} };
  }
}
async function startIntegrationStudioTestRun(sender, payload) {
  const { sessionId, utterance } = payload;
  const draft = integrationStudioService.getIntegrationStudioDraft(sessionId);
  if (!draft) {
    return { success: false, error: "Generate an integration first" };
  }
  const state = stateFor(sessionId);
  if (state.chatDraftServerId !== draft.serverId) {
    state.chatSessionId = void 0;
    state.chatDraftServerId = draft.serverId;
  }
  state.run?.controller.abort();
  const manager = main.getMcpClientManager();
  const rawDeclarations = await manager.getServerToolDeclarationsRaw(
    draft.serverId
  );
  if (rawDeclarations.length === 0) {
    const status = (await manager.listServers()).find(
      (s) => s.id === draft.serverId
    );
    return {
      success: false,
      error: status?.error ? `The draft server isn't running: ${status.error}` : "The draft server has no tools yet — try reloading"
    };
  }
  const manifestTools = new Map(
    draft.artifact.manifest.tools.map((tool) => [tool.name, tool])
  );
  const declarations = rawDeclarations.map((decl) => ({
    ...decl,
    requiresConfirmation: Boolean(
      manifestTools.get(decl.originalName)?.confirmation
    )
  }));
  const runId = node_crypto.randomUUID();
  const controller = new AbortController();
  const run = {
    runId,
    controller,
    sender,
    pendingConfirmations: /* @__PURE__ */ new Map()
  };
  state.run = run;
  sendTestEvent(sessionId, sender, { type: "run-started", runId, utterance });
  void executeTestRun(
    sessionId,
    state,
    run,
    draft.serverId,
    utterance,
    declarations
  ).finally(() => {
    if (state.run === run) state.run = null;
  });
  return { success: true, runId };
}
async function executeTestRun(sessionId, state, run, draftServerId, utterance, declarations) {
  const { runId, controller, sender } = run;
  const deadline = setTimeout(() => controller.abort(), RUN_DEADLINE_MS);
  let responseText = "";
  const draft = integrationStudioService.getIntegrationStudioDraft(sessionId);
  try {
    const stream = main.grpcClient.agentStream(
      Buffer.alloc(0),
      // text-only turn
      [],
      // no cloud toolkits — the draft is the whole point
      "en",
      state.chatSessionId,
      void 0,
      // screenshot
      void 0,
      // accessibility text
      void 0,
      // selected text
      void 0,
      // additional screenshots
      [],
      // confirmation settings (declarations carry the flag)
      controller.signal,
      utterance,
      "The user is test-driving a custom integration they just built inside the VoiceOS Integration Studio. Prefer its custom_mcp tools; keep answers short.",
      void 0,
      // attached files
      declarations,
      void 0,
      // cursor screenshot
      void 0,
      // conversation history
      state.chatSessionId ? true : void 0
      // continue the Studio conversation
    );
    for await (const response of stream) {
      if (controller.signal.aborted) break;
      if (response.status === main.AgentStatusType.AGENT_STATUS_KEEPALIVE) continue;
      if (response.sessionId) state.chatSessionId = response.sessionId;
      switch (response.status) {
        case main.AgentStatusType.AGENT_STATUS_TRANSCRIBING:
        case main.AgentStatusType.AGENT_STATUS_THINKING:
        case main.AgentStatusType.AGENT_STATUS_TOOL_SEARCH:
        case main.AgentStatusType.AGENT_STATUS_TOOL_EXECUTING: {
          sendTestEvent(sessionId, sender, {
            type: "status",
            runId,
            status: "thinking",
            message: response.message || void 0
          });
          break;
        }
        case main.AgentStatusType.AGENT_STATUS_TEXT: {
          if (response.message) {
            responseText = response.message;
            sendTestEvent(sessionId, sender, {
              type: "text",
              runId,
              text: responseText
            });
          }
          break;
        }
        case main.AgentStatusType.AGENT_STATUS_CONFIRM_REQUIRED: {
          const confirmationId = response.confirmationId;
          if (!confirmationId) break;
          const { originalName, args } = parseConfirmActionDetails(
            response.actionDetails
          );
          run.pendingConfirmations.set(confirmationId, {
            toolName: response.toolName || "",
            originalName,
            args
          });
          sendTestEvent(sessionId, sender, {
            type: "confirm-required",
            runId,
            confirmationId,
            toolName: response.toolName || "",
            originalName,
            args,
            view: draft?.artifact.manifest.tools.find(
              (tool) => tool.name === originalName
            )?.confirmation
          });
          break;
        }
        case main.AgentStatusType.AGENT_STATUS_MCP_TOOL_EXECUTE: {
          const raw = response.actionDetails || (typeof response.detail === "string" && response.detail.startsWith("{") ? response.detail : void 0);
          let request = {};
          try {
            request = JSON.parse(raw || "{}");
          } catch {
            request = {};
          }
          if (!request.executionId) break;
          const toolName = request.toolName || "";
          sendTestEvent(sessionId, sender, {
            type: "tool-start",
            runId,
            toolName: response.toolName || toolName,
            originalName: toolName,
            args: request.args ?? {}
          });
          if (request.serverId !== draftServerId) {
            await main.grpcClient.agentMcpToolResult(
              request.executionId,
              JSON.stringify({
                error: "This tool is not part of the integration under test."
              }),
              true
            );
            break;
          }
          try {
            const result = await main.getMcpClientManager().executeTool(
              draftServerId,
              toolName,
              request.args ?? {}
            );
            const glance = extractGlanceFromToolResult(result);
            const isError = Boolean(
              result?.isError
            );
            sendTestEvent(sessionId, sender, {
              type: "tool-result",
              runId,
              toolName: response.toolName || toolName,
              originalName: toolName,
              ok: !isError,
              glance
            });
            await main.grpcClient.agentMcpToolResult(
              request.executionId,
              JSON.stringify(result),
              false
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Tool execution failed";
            sendTestEvent(sessionId, sender, {
              type: "tool-result",
              runId,
              toolName: response.toolName || toolName,
              originalName: toolName,
              ok: false,
              error: message
            });
            await main.grpcClient.agentMcpToolResult(
              request.executionId,
              JSON.stringify({ error: message }),
              true
            );
          }
          break;
        }
        case main.AgentStatusType.AGENT_STATUS_ERROR: {
          sendTestEvent(sessionId, sender, {
            type: "error",
            runId,
            message: response.message || "The test run failed."
          });
          return;
        }
        case main.AgentStatusType.AGENT_STATUS_COMPLETE: {
          sendTestEvent(sessionId, sender, {
            type: "complete",
            runId,
            responseText
          });
          return;
        }
        default:
          break;
      }
    }
    if (controller.signal.aborted) {
      sendTestEvent(sessionId, sender, { type: "cancelled", runId });
    } else {
      sendTestEvent(sessionId, sender, {
        type: "complete",
        runId,
        responseText
      });
    }
  } catch (err) {
    if (controller.signal.aborted) {
      sendTestEvent(sessionId, sender, { type: "cancelled", runId });
      return;
    }
    sendTestEvent(sessionId, sender, {
      type: "error",
      runId,
      message: err instanceof Error ? err.message : "The test run failed."
    });
  } finally {
    clearTimeout(deadline);
  }
}
function resolveIntegrationStudioTestConfirmation(payload) {
  const run = testStates.get(payload.sessionId)?.run;
  const pending = run?.pendingConfirmations.get(payload.confirmationId);
  if (!run || !pending) {
    return { success: false, error: "This confirmation is no longer active" };
  }
  run.pendingConfirmations.delete(payload.confirmationId);
  sendTestEvent(payload.sessionId, run.sender, {
    type: "confirm-resolved",
    runId: run.runId,
    confirmationId: payload.confirmationId,
    approved: payload.approved
  });
  void main.grpcClient.agentConfirmAction(
    payload.confirmationId,
    payload.approved,
    payload.editedArgs ? JSON.stringify(payload.editedArgs) : void 0
  ).catch((err) => {
    sendTestEvent(payload.sessionId, run.sender, {
      type: "error",
      runId: run.runId,
      message: err instanceof Error ? err.message : "Failed to send confirmation"
    });
  });
  return { success: true };
}
function cancelIntegrationStudioTestRun(sessionId) {
  const state = testStates.get(sessionId);
  if (!state) return;
  state.run?.controller.abort();
  state.run = null;
}
function releaseStudioTestSession(sessionId) {
  const state = testStates.get(sessionId);
  if (!state) return;
  state.run?.controller.abort();
  testStates.delete(sessionId);
}
exports.cancelIntegrationStudioTestRun = cancelIntegrationStudioTestRun;
exports.extractGlanceFromToolResult = extractGlanceFromToolResult;
exports.releaseStudioTestSession = releaseStudioTestSession;
exports.resolveIntegrationStudioTestConfirmation = resolveIntegrationStudioTestConfirmation;
exports.startIntegrationStudioTestRun = startIntegrationStudioTestRun;
