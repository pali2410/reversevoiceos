"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "6551c495-7969-44df-a4c9-c18a113766b2", e._sentryDebugIdIdentifier = "sentry-dbid-6551c495-7969-44df-a4c9-c18a113766b2");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const GLANCE_SNIPPET = `// --- VoiceOS glance helper (inlined; see the VoiceOS integration SDK) -------
// A tool attaches its notch card by spreading glanceResult([...]) into its
// JSON result. VoiceOS lifts it out (the model never sees UI JSON), validates
// every block, and renders natively. Keep cards a 2-second read: max 3 blocks.
type GlanceBlock = Record<string, unknown> & { type: string };
function glanceResult(blocks: GlanceBlock[]) {
  if (blocks.length === 0 || blocks.length > 3) {
    throw new Error("glanceResult: pass 1-3 blocks");
  }
  return { _voiceos_glance: { blocks } };
}`;
function zodShapeFor(tool) {
  const props = tool.inputSchema.properties ?? {};
  const required = new Set(
    Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
  );
  const entries = Object.entries(props).map(([key, prop]) => {
    const base2 = prop.type === "number" ? "z.number()" : prop.type === "boolean" ? "z.boolean()" : "z.string()";
    const described = prop.description ? `${base2}.describe(${JSON.stringify(prop.description)})` : base2;
    return `    ${key}: ${required.has(key) ? described : `${described}.optional()`},`;
  });
  return entries.length > 0 ? `{
${entries.join("\n")}
  }` : "{}";
}
function handlerBodyFor(tool) {
  const argNames = Object.keys(
    tool.inputSchema.properties ?? {}
  );
  const argsPattern = argNames.length > 0 ? `{ ${argNames.join(", ")} }` : "_args";
  return `  async (${argsPattern}) => {
    // TODO: replace this stub with your real logic (API call, computation…).${tool.execution?.mode === "background" ? "\n    // Await the work here, then return its final data + glance card below.\n    // VoiceOS creates the task handle; do not return a started/job-id response." : ""}
    // Read user-entered preferences as env vars: process.env.MY_FIELD.
    const data = {
      ok: true,${argNames.map((n) => `
      ${n},`).join("")}
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ...data, // what the model reads and narrates
            ...glanceResult([
              // what the user sees in the notch — edit freely (see AGENTS.md)
              { type: "header", title: ${JSON.stringify(tool.title ?? tool.name)}, icon: "sparkle" },
              {
                type: "keyValue",
                pairs: [["Status", "Stub — implement me"]],
              },
            ]),
          }),
        },
      ],
    };
  }`;
}
function emitServerTs(manifest) {
  const tools = manifest.tools.map(
    (tool) => `server.registerTool(
  ${JSON.stringify(tool.name)},
  {
    title: ${JSON.stringify(tool.title ?? tool.name)},
    description: ${JSON.stringify(tool.description)},
    inputSchema: ${zodShapeFor(tool)},
  },
${handlerBodyFor(tool)},
);`
  ).join("\n\n");
  return `/**
 * ${manifest.name} — a VoiceOS integration server (standard MCP over stdio).
 *
 * VoiceOS launches this with the command in voiceos.integration.json and
 * discovers the tools over MCP. Keep the tool names in sync with the
 * manifest, and run \`bun verify.ts\` after every change. See AGENTS.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

${GLANCE_SNIPPET}

const server = new McpServer({
  name: ${JSON.stringify(manifest.id.split(".").pop() || manifest.name)},
  version: ${JSON.stringify(manifest.version)},
});

${tools}

await server.connect(new StdioServerTransport());
`;
}
function emitVerifyTs(_manifest) {
  return `/**
 * Smoke-test this integration: \`bun verify.ts\`.
 * Speaks real MCP over stdio to server.ts the way VoiceOS does. It rereads
 * voiceos.integration.json every run, checks tool parity, invokes safe preview
 * fixtures, and validates creator-owned glance cards. Exits non-zero on any
 * failure — run it after every change (AI agents: this is your feedback loop).
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const GLANCE_RESULT_KEY = "_voiceos_glance";
const manifest = JSON.parse(readFileSync(new URL("./voiceos.integration.json", import.meta.url), "utf8"));
const preview = JSON.parse(readFileSync(new URL("./voiceos.integration.preview.json", import.meta.url), "utf8"));
const expectedTools = (manifest.tools as Array<{ name: string; description?: string }>).map((t) => t.name).sort();

const child = spawn("bun", ["server.ts"], { cwd: import.meta.dir, env: process.env });
let buffer = "";
let stderr = "";
const pending = new Map<number, (msg: any) => void>();
let nextId = 1;
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (typeof msg.id === "number") pending.get(msg.id)?.(msg);
    } catch {
      console.error("[verify] non-JSON on stdout:", line.slice(0, 120));
    }
  }
});
child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

function request(method: string, params?: unknown): Promise<any> {
  const id = nextId++;
  const promise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(\`timeout waiting for \${method}\\n\${stderr}\`)),
      10_000,
    );
    pending.set(id, (msg) => {
      clearTimeout(timer);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    });
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\\n");
  return promise;
}

const checks: Array<{ name: string; ok: boolean; note?: string }> = [];
function check(name: string, ok: boolean, note?: string) {
  checks.push({ name, ok, ...(note ? { note } : {}) });
  console.error(\`\${ok ? "✓" : "✗"} \${name}\${note ? \` — \${note}\` : ""}\`);
}

function extractTextContent(result: any): string {
  const content = Array.isArray(result?.content) ? result.content : [];
  return content
    .filter((item: any) => item?.type === "text" && typeof item.text === "string")
    .map((item: any) => item.text)
    .join("\\n");
}

function extractGlance(result: any): { blocks?: unknown[] } | null {
  const text = extractTextContent(result);
  if (!text.includes(GLANCE_RESULT_KEY)) return null;
  try {
    const parsed = JSON.parse(text);
    const glance = parsed?.[GLANCE_RESULT_KEY];
    return glance && Array.isArray(glance.blocks) ? glance : null;
  } catch {
    return null;
  }
}

try {
  check("manifest schema version is v1", manifest.schemaVersion === 1);
  check("preview fixture schema version is v1", preview.schemaVersion === 1);

  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "voiceos-verify", version: "1.0.0" },
  });
  check("initialize handshake", !!init.serverInfo?.name);
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\\n",
  );

  const listed = await request("tools/list");
  const names = (listed.tools as Array<{ name: string }>).map((t) => t.name).sort();
  check(
    "tools match voiceos.integration.json",
    JSON.stringify(names) === JSON.stringify(expectedTools),
    names.join(", ") || "none",
  );

  for (const tool of listed.tools as Array<{ name: string; description?: string }>) {
    check(
      \`\${tool.name} has a model-facing description\`,
      (tool.description?.trim().length ?? 0) >= 20,
    );
  }

  for (const toolName of expectedTools) {
    const fixture = preview.tools?.[toolName];
    if (!fixture) {
      check(\`\${toolName} has a preview fixture\`, false);
      continue;
    }
    const result = await request("tools/call", {
      name: toolName,
      arguments: fixture.args ?? {},
    });
    check(\`\${toolName} preview call returns text\`, extractTextContent(result).trim().length > 0);
    const glance = extractGlance(result);
    check(
      \`\${toolName} preview call returns 1-3 glance blocks\`,
      !!glance && Array.isArray(glance.blocks) && glance.blocks.length >= 1 && glance.blocks.length <= 3,
    );
  }
} catch (err) {
  check("verify run", false, err instanceof Error ? err.message : String(err));
} finally {
  child.kill();
}

const failed = checks.filter((c) => !c.ok);
const verdict = JSON.stringify({ ok: failed.length === 0, checks });
console.log(verdict);
if (process.env.VERIFY_OUT) await Bun.write(process.env.VERIFY_OUT, verdict);
process.exit(failed.length === 0 ? 0 : 1);
`;
}
function emitPreviewFixture(manifest) {
  const tools = Object.fromEntries(
    manifest.tools.map((tool) => {
      const props = tool.inputSchema.properties ?? {};
      const args = Object.fromEntries(
        Object.entries(props).map(([key, prop]) => [
          key,
          prop.type === "number" ? 1 : prop.type === "boolean" ? true : key === "format" ? "csv" : key === "to" ? "Kai" : key === "body" ? "The first version is working." : prop.description || "Sample value"
        ])
      );
      return [
        tool.name,
        {
          args,
          expectedGlanceBlocks: 2
        }
      ];
    })
  );
  return JSON.stringify(
    {
      schemaVersion: 1,
      description: "Development-only sample inputs used by bun verify.ts and the VoiceOS Integration Studio preview.",
      tools
    },
    null,
    2
  ) + "\n";
}
function emitAgentsMd(manifest) {
  return `# Building this VoiceOS integration (guide for AI coding agents)

You are editing **${manifest.name}**, a VoiceOS integration: a folder that
teaches the VoiceOS voice agent new tools, with native UI in the Mac notch.
This file is the whole contract — no VoiceOS internals needed.

## What a user experiences

The user talks to VoiceOS. The agent picks one of the tools declared here,
VoiceOS runs this folder's MCP server (\`server.ts\`), and the result appears
two ways: the model narrates the data, and the notch shows the tool's
**glance card** (blocks the tool attached via \`glanceResult\`). Tools that act
on the user's behalf first show a **confirmation card** declared in the
manifest, which the user can edit and approve.

## Files

- \`voiceos.integration.json\` — identity, runtime, permissions, tools
  (name/description/inputSchema/confirmation). Every manifest tool must be
  registered in server.ts with the same name, and vice versa.
- \`server.ts\` — standard MCP stdio server. Implement your logic in the tool
  handlers (marked TODO).
- \`verify.ts\` — run \`bun verify.ts\` after every change; all checks must ✓.

## Rules that make integrations feel native

1. **Tool descriptions are routing rules for the model**: what it does + when
   to use it ("Use when the user asks …").
2. **Results carry data AND a glance card**: JSON the model reasons about,
   plus \`glanceResult([...])\` for the user. Never put information only in
   the card.
3. **Glance cards are a 2-second read** — max 3 blocks. Vocabulary:
   \`header\` {icon?, appIcon?, title, trailing?}, \`list\` {header?, rows:
   [{icon?, title, subtitle?, trailing?, badge?: {text, tone?}}]} (≤6 rows),
   \`stats\` {items: [{label, value, delta?, tone?}]} (≤3), \`keyValue\`
   {pairs: [[label, value]]} (≤5), \`bars\` {labels, values, unit?} /
   \`line\` {points, tone?, baseline?} / \`splitBar\` {segments} (max ONE
   chart), \`progress\` {value, max?, label?, style?: "bar"|"ring"},
   \`badges\` {items} (≤3), \`clock\` {tz}, \`countdown\` {until|seconds},
   \`divider\`, \`row\` {children} (2-3 side by side). tone is
   "neutral"|"good"|"bad". Titles ≤60 chars; pre-trim strings. Icons:
   calendar clock timer bed car mail message music sun moon cloud rain star
   folder file globe pin phone person heart bolt check x mic note list
   battery chart dollar home wifi coffee plane sparkle.
   Off-schema blocks are silently dropped — verify catches shape mistakes.
4. **Anything that acts needs a manifest \`confirmation\` card.** Inputs bind
   to args with \`{{argName}}\`; edited values are what execute. Interactive
   vocabulary: card, stack, text, markdown, keyValue, metadata, list/listItem,
   image, badge, divider, progress, textField, passwordField, select, toggle,
   chips (inputs take \`bind\`), actions (roles confirm/cancel/copy/openUrl).
   Read-only tools must NOT declare one.
5. **Be honest**: throw on failure; never fabricate data or claim success.
6. **Least privilege**: list only domains you call in permissions.
7. **Long work (>20s) declares** \`"execution": {"mode": "background"}\` +
   the \`background\` permission — VoiceOS tracks it in the side panel and
   shows your glance card on completion when the top notch is idle. Await the
   work in the handler, then return final data + \`glanceResult([...])\` (or
   \`widgetResult(html, { data })\` from the SDK). VoiceOS creates the task
   handle itself. Return the card in the final MCP result, not a Markdown UI
   fence. Reopening the completed task preserves the same card.
8. **Secrets come from the user**: declare \`preferences\` /
   \`auth:{"kind":"apiKey"}\` fields; VoiceOS injects them as env vars named
   after each field (\`process.env.MY_FIELD\`). Never hardcode keys.

## Action availability and visibility

Manifest tool fields are optional. Set \`disabled: true\` to show a read-only
action with no permission control or preview; VoiceOS also blocks agent,
widget, and direct execution. Add \`disabledReason\` (1–200 trimmed characters)
to explain why. Set \`visibility: "agent"\` to hide a tool from the user-facing
action list while leaving it available to the agent under normal confirmation
rules. Set \`hidePermissionToggle: true\` to hide only the "Ask permission" /
"Don't ask" button while keeping the action visible, usable, and previewable.
This only affects settings UI; existing confirmation rules and saved user
overrides still apply. Hidden is not disabled. Defaults preserve existing
behavior. Reload after manifest edits. Older hosts may ignore these fields: enforce sensitive
backend restrictions in your handler too.

## UI payload budgets

Widget results and hook views allow 300,000 characters in their serialized
\`{ blocks: [...] }\` envelope, including JSON escaping and data. Individual
widget HTML is also capped at 300,000 characters, measured by string.length,
not UTF-8 bytes. Non-widget result envelopes remain at 32,000 characters and
widget data at 16,384. Leave room for wrapper markup and serialization overhead.

## Result-widget actions

Set \`uiCallable: true\` on each manifest tool that result widgets may invoke.
Buttons can request your own tool's original name and JSON arguments:
\`parent.postMessage({ type: "voiceos:invokeTool", name: "send_message", args: { message: "Hello" }, requestId: "send-1" }, "*")\`.
Listen for \`voiceos:toolResult\` only from \`event.source === parent\`.
The updated widget kit offers \`window.voiceos.invokeTool(name, args)\`, a Promise
that waits through confirmation and resolves with the terminal response.
Check \`voiceos:init.capabilities.invokeTool\` (or the kit's
\`window.voiceos.canInvokeTools\`) before enabling buttons on older hosts.

Handlers can implement JavaScript, run Python, or call your service using their
existing app access. The bridge cannot call another integration. Existing user
confirmation settings and pre/post hooks apply. VoiceOS shows required approval
OUTSIDE the iframe, preserving the composer, with a read-only review of the
final arguments; cancel to edit and resubmit. Confirmation widgets cannot invoke
tools. Keep confirmation views on tools that act. Never build a host eval/exec
endpoint or accept widget-supplied approval.

Disable buttons while pending. Show success only for \`completed\`; handle
\`cancelled\`, \`failed\`, and \`unknown\` honestly. Unknown may already have acted:
never retry automatically. Use one requestId per intentional action (the helper
generates it); repeated IDs deduplicate. Limits: one pending action and 1,000 IDs
per card, 32,768 characters JSON args, 131,072 characters returned result, 60 seconds for approval and
60 seconds for execution. Larger results set \`resultOmitted\`; execution timeouts
report \`unknown\`. Reopen expired cards. Never author hostToolId/runtime grants.

## Trigger reminders from your app

Declare \`{ "kind": "notify" }\` in manifest permissions. From a tool, hook,
timer, or background callback on your connected MCP server, call:

\`\`\`ts
await server.server.request(
  { method: "voiceos/reminders/trigger", params: { message: "Your export is ready!", speak: false } },
  z.object({ notificationId: z.string() }),
);
\`\`\`

The full SDK offers \`triggerReminder(server, { message, speak })\` for the
same request. Messages are 1–2,000 trimmed characters; \`speak\` defaults to
true. VoiceOS supplies the installed app's name and icon, persists the card,
and shows it in the reminder stack when the user is free. The receipt means
queued, not seen. Handle rejection honestly. No active agent turn is needed;
the app must be saved, enabled, connected, and hold \`notify\`, and the user
must be signed in. This cannot wake a stopped server or an offline client.

To add buttons, pass \`actions: [{ id: "show_details", label: "Show details" }]\`
and optional \`data: { reportId: "report-42" }\` with the trigger request.
Register the SDK's \`defineReminderActions(server, { show_details: async (event) => { /* app logic */ } })\`
once before connecting. Handlers receive \`notificationId\`, \`actionId\`, and
persisted \`data\`, and run in the integration process, never in the reminder
renderer. Keep stable handler IDs registered on every startup.

To open a custom card in the notch when the button is clicked, return
\`{ view: { blocks: [{ type: "widget", html, height: 240, label: "Details" }] }, responseText: "Details ready" }\`
from the SDK handler. Native glance blocks work too. Existing widget/glance
limits and permissions apply; the host opens the card without an agent turn.
Tool buttons in the card use the app's declared \`uiCallable\` tools as usual.
Return nothing for actions without a card. Older hosts ignore the view.

Without the SDK, register a \`server.server.setRequestHandler\` for method
\`voiceos/reminders/action\`, with params \`{ notificationId, actionId, data? }\`.
Validate the action against a fixed handler map; never eval incoming code.
Return \`{ ok: true }\` only after completing the effect; throw on failure.
To open a card, return \`{ ok: true, view: { blocks: [...] }, responseText? }\`.
Deduplicate by notificationId + actionId, including failed/uncertain attempts,
using durable backend idempotency for writes. A 30-second timeout does not prove
the operation failed. Never retry side effects automatically.

Use at most 3 buttons; IDs are 1–64 ASCII letters/digits/_/-, labels 1–32
trimmed characters, and data is a JSON object up to 8,192 serialized characters
and 12 levels deep. Store record IDs, not secrets. The host rechecks account,
notify permission and connection on click, shows pending/error state, and
dismisses on success. The click authorizes the labeled action without a
separate tool confirmation: label the consequence clearly. Older hosts still
show the message but may omit buttons.

## Dev loop

\`\`\`bash
bun add @modelcontextprotocol/sdk zod   # once
bun verify.ts                            # after every change
\`\`\`

Then in VoiceOS: Settings → Agent Mode → Integrations → **Install from
folder** → pick this folder. After edits, hit the integration's **Reload**.
Tools appear to the agent on the next turn — just talk to it.

## Definition of done

- \`bun verify.ts\` exits 0, every check ✓.
- Each tool description says when the model should call it.
- Acting tools have confirmation cards; read tools don't.
- Glance cards read in 2 seconds.
`;
}
function emitPackageJson(manifest) {
  return JSON.stringify(
    {
      name: manifest.id.split(".").pop() || "voiceos-integration",
      private: true,
      type: "module",
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.28.0",
        zod: "^3.25.0"
      }
    },
    null,
    2
  ) + "\n";
}
function emitReadme(manifest) {
  return `# ${manifest.name}

${manifest.summary}

A [VoiceOS](https://www.voiceos.com) integration. Talk to VoiceOS and it can
call the tools in this folder; results show as native cards in the notch.

## Develop

\`\`\`bash
bun add @modelcontextprotocol/sdk zod
bun verify.ts
\`\`\`

Install into VoiceOS: Settings → Agent Mode → Integrations → Install from
folder. Editing with an AI agent (Claude Code, Cursor)? Point it at this
folder — AGENTS.md teaches it the whole contract.

## Share

Send this folder (or its git repo). Anyone can install it the same way.
`;
}
function base(opts, fallbackSummary, extra, tools) {
  const summary = opts.description?.trim() || fallbackSummary;
  return {
    schemaVersion: 1,
    id: opts.id,
    version: "1.0.0",
    name: opts.name,
    summary: summary.slice(0, 140),
    publisher: {
      id: opts.publisherId ?? "pub_you",
      name: opts.publisherName ?? "You"
    },
    // Local by default: the scaffold ships a working server.ts that VoiceOS
    // runs in place — installable the moment it's generated. Pass --url to
    // target your own hosted remote MCP server instead.
    runtime: opts.url ? { kind: "remote-mcp", url: opts.url } : { kind: "local-mcp", command: "bun", args: ["server.ts"] },
    ...extra,
    tools
  };
}
function confirmAndSend(opts) {
  return base(opts, "Send something, with a confirmation card.", {}, [
    {
      name: "send_message",
      title: "Send message",
      description: "Send a message. Use when the user wants to send something to someone.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient" },
          body: { type: "string", description: "Message body" }
        },
        required: ["to", "body"]
      },
      confirmation: {
        schemaVersion: 1,
        root: {
          type: "card",
          title: "Send message",
          children: [
            { type: "textField", bind: "{{to}}", label: "To" },
            {
              type: "textField",
              bind: "{{body}}",
              label: "Message",
              multiline: true
            }
          ],
          footer: [
            {
              type: "actions",
              items: [
                { label: "Cancel", role: "cancel" },
                { label: "Send", role: "confirm", color: "accent" }
              ]
            }
          ]
        }
      }
    }
  ]);
}
function fetchAndShowList(opts) {
  return base(opts, "Search something and show the matches.", {}, [
    {
      name: "search_items",
      title: "Search",
      description: "Search items and show the matches to the user.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"]
      }
      // The result card is authored at RUNTIME by the tool handler: spread
      // `glanceResult([...])` into the result JSON (see the SDK's glance.ts).
    }
  ]);
}
function backgroundTask(opts) {
  return base(
    opts,
    "Kick off a long task; notify when it's done.",
    { permissions: [{ kind: "background" }] },
    [
      {
        name: "start_export",
        title: "Start export",
        description: "Start a long export. Runs in the background and notifies when complete.",
        inputSchema: {
          type: "object",
          properties: {
            format: { type: "string", description: "csv or json" }
          }
        },
        execution: { mode: "background", estimatedDurationMs: 3e4 },
        confirmation: {
          schemaVersion: 1,
          root: {
            type: "card",
            title: "Start export",
            children: [
              {
                type: "select",
                bind: "{{format}}",
                label: "Format",
                options: [
                  { label: "CSV", value: "csv" },
                  { label: "JSON", value: "json" }
                ]
              }
            ],
            footer: [
              {
                type: "actions",
                items: [
                  { label: "Cancel", role: "cancel" },
                  { label: "Start", role: "confirm", color: "accent" }
                ]
              }
            ]
          }
        }
        // Await the work, then return `glanceResult([...])`. VoiceOS tracks the
        // task in the side notch and presents its card when the top notch is idle.
      }
    ]
  );
}
function buildTemplateManifest(opts) {
  switch (opts.template) {
    case "fetch-and-show-list":
      return fetchAndShowList(opts);
    case "background-task":
      return backgroundTask(opts);
    case "confirm-and-send":
    default:
      return confirmAndSend(opts);
  }
}
function scaffoldFiles(opts) {
  const manifest = buildTemplateManifest(opts);
  const files = [
    {
      path: "voiceos.integration.json",
      content: JSON.stringify(manifest, null, 2) + "\n"
    },
    {
      path: "voiceos.integration.preview.json",
      content: emitPreviewFixture(manifest)
    },
    { path: "verify.ts", content: emitVerifyTs() },
    { path: "AGENTS.md", content: emitAgentsMd(manifest) },
    { path: "README.md", content: emitReadme(manifest) }
  ];
  if (manifest.runtime.kind === "local-mcp") {
    files.splice(1, 0, { path: "server.ts", content: emitServerTs(manifest) });
    files.push({ path: "package.json", content: emitPackageJson(manifest) });
  }
  return files;
}
exports.buildTemplateManifest = buildTemplateManifest;
exports.scaffoldFiles = scaffoldFiles;
