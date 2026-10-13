"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "ac26f100-7e7c-43ea-849d-3c2f24371475", e._sentryDebugIdIdentifier = "sentry-dbid-ac26f100-7e7c-43ea-849d-3c2f24371475");
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
const TOOL_DEADLINE_MS = 3e4;
const DETAIL_LIMIT = 180;
const TONE_BY_STATUS = {
  ok: "ok",
  "no-card": "warn",
  failed: "error",
  skipped: "info"
};
function checked(tool, status, message, glance) {
  return {
    tool,
    status,
    message,
    tone: TONE_BY_STATUS[status],
    ...glance ? { glance } : {}
  };
}
function schemaValue(property) {
  if (!property || typeof property !== "object") return void 0;
  const record = property;
  if ("default" in record) return record.default;
  if ("const" in record) return record.const;
  for (const key of ["enum", "examples"]) {
    const candidates = record[key];
    if (Array.isArray(candidates) && candidates.length > 0) {
      return candidates[0];
    }
  }
  return void 0;
}
function selfTestArgs(tool, fixture) {
  const schema = tool.inputSchema ?? {};
  const properties = schema.properties ?? {};
  const required = Array.isArray(schema.required) ? schema.required.filter((name) => typeof name === "string") : [];
  const args = { ...fixture };
  const missing = [];
  for (const name of required) {
    if (args[name] !== void 0) continue;
    const proposed = schemaValue(properties[name]);
    if (proposed === void 0) missing.push(name);
    else args[name] = proposed;
  }
  return missing.length > 0 ? { missing } : { args };
}
function shorten(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > DETAIL_LIMIT ? `${flat.slice(0, DETAIL_LIMIT - 1)}…` : flat;
}
function isErrorResult(result) {
  return Boolean(
    result && typeof result === "object" && result.isError
  );
}
function verdict(tool, label, result) {
  const { glance, cleaned } = main.extractGlanceFromMcpResult(result);
  if (isErrorResult(result)) {
    const detail = shorten(main.mcpResultToText(cleaned));
    return checked(
      tool,
      "failed",
      detail ? `${label} failed: ${detail}` : `${label} came back as an error.`
    );
  }
  if (!glance) {
    return checked(
      tool,
      "no-card",
      `${label} ran, but returned nothing the notch can show.`
    );
  }
  return checked(
    tool,
    "ok",
    `${label} returned a card the notch can render.`,
    glance
  );
}
async function withDeadline(work) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer after ${TOOL_DEADLINE_MS / 1e3}s`)),
      TOOL_DEADLINE_MS
    );
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
async function checkStudioTools(input) {
  const checks = [];
  for (const tool of input.tools) {
    const label = tool.title?.trim() || tool.name;
    let check;
    if (tool.confirmation) {
      check = checked(
        tool.name,
        "skipped",
        `${label} asks first, so it wasn't run.`
      );
    } else {
      const call = selfTestArgs(tool, input.fixtures?.[tool.name]);
      if ("missing" in call) {
        check = checked(
          tool.name,
          "skipped",
          `${label} needs ${call.missing.join(", ")} — no sample to test it with.`
        );
      } else {
        try {
          const result = await withDeadline(
            input.execute(tool.name, call.args)
          );
          check = verdict(tool.name, label, result);
        } catch (err) {
          const detail = shorten(
            err instanceof Error ? err.message : String(err)
          );
          check = checked(tool.name, "failed", `${label} failed: ${detail}`);
        }
      }
    }
    checks.push(check);
    input.onCheck?.(check);
  }
  return checks;
}
function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
function summarizeChecks(checks) {
  const failed = checks.filter((check) => check.status === "failed").length;
  const cardless = checks.filter((check) => check.status === "no-card").length;
  const ran = checks.filter((check) => check.status !== "skipped").length;
  if (failed > 0) {
    return {
      message: failed === ran ? `${plural(ran, "action")} failed — see above.` : `${failed} of ${plural(ran, "action")} failed — see above.`,
      tone: "error"
    };
  }
  if (cardless > 0) {
    return {
      message: `${plural(cardless, "action")} ran but showed no card.`,
      tone: "warn"
    };
  }
  if (ran === 0) {
    return {
      message: "Nothing to check — no action runs on its own.",
      tone: "info"
    };
  }
  return {
    message: `${plural(ran, "action")} checked out with your settings.`,
    tone: "ok"
  };
}
exports.checkStudioTools = checkStudioTools;
exports.selfTestArgs = selfTestArgs;
exports.summarizeChecks = summarizeChecks;
