"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "9a4f802e-86d0-446c-ad84-3fbf01c31b6b", e._sentryDebugIdIdentifier = "sentry-dbid-9a4f802e-86d0-446c-ad84-3fbf01c31b6b");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const CLAUDE_DESKTOP_BUNDLE_ID = "com.anthropic.claudefordesktop";
const BROWSER_BUNDLE_PREFIXES = [
  "com.google.chrome",
  "com.apple.safari",
  "org.mozilla.firefox",
  "com.microsoft.edgemac",
  "com.brave.browser",
  "company.thebrowser.browser",
  // Arc
  "com.operasoftware.opera",
  "com.vivaldi.vivaldi"
];
const AGENT_NUDGE_SURFACE_MATCHERS = [
  {
    slug: "chatgpt",
    surfaceType: "ai_chat",
    bundleIds: ["com.openai.chat"],
    urlHosts: ["chatgpt.com", "chat.openai.com"]
  },
  {
    slug: "claude",
    surfaceType: "ai_chat",
    bundleIds: [CLAUDE_DESKTOP_BUNDLE_ID],
    urlHosts: ["claude.ai"]
  },
  {
    slug: "google",
    surfaceType: "web_search",
    bundleIds: [],
    urlHosts: [],
    exactUrlHosts: ["google.com", "www.google.com"]
  },
  {
    slug: "bing",
    surfaceType: "web_search",
    bundleIds: [],
    urlHosts: ["bing.com"]
  },
  {
    slug: "duckduckgo",
    surfaceType: "web_search",
    bundleIds: [],
    urlHosts: ["duckduckgo.com"]
  },
  // AI coding apps — people ask these plain questions constantly. VS Code,
  // Cursor, and Zed ids are well documented; the Codex and Windsurf ids are
  // TODO: verify via `osascript -e 'id of app "<Name>"'` on a machine that has
  // them (an unmatched id just fails closed — the nudge silently won't fire).
  {
    slug: "codex",
    surfaceType: "coding",
    bundleIds: ["com.openai.codex"],
    urlHosts: []
  },
  {
    slug: "cursor",
    surfaceType: "coding",
    bundleIds: ["com.todesktop.230313mzl4w4u92"],
    urlHosts: []
  },
  {
    slug: "vscode",
    surfaceType: "coding",
    bundleIds: ["com.microsoft.vscode"],
    urlHosts: []
  },
  {
    slug: "windsurf",
    surfaceType: "coding",
    bundleIds: ["com.exafunction.windsurf"],
    urlHosts: []
  },
  {
    slug: "zed",
    surfaceType: "coding",
    bundleIds: ["dev.zed.zed"],
    urlHosts: []
  }
];
function getHostname(url) {
  if (!url) return void 0;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return void 0;
  }
}
function hostMatches(hostname, host) {
  return hostname === host || hostname.endsWith(`.${host}`);
}
function detectAgentNudgeSurface(window2) {
  const { bundleId, url } = window2;
  if (bundleId) {
    const lowerBundleId = bundleId.toLowerCase();
    for (const matcher of AGENT_NUDGE_SURFACE_MATCHERS) {
      if (matcher.bundleIds.includes(lowerBundleId)) {
        return { slug: matcher.slug, surfaceType: matcher.surfaceType };
      }
    }
  }
  const hostname = getHostname(url);
  if (hostname) {
    for (const matcher of AGENT_NUDGE_SURFACE_MATCHERS) {
      if (matcher.urlHosts.some((host) => hostMatches(hostname, host)) || matcher.exactUrlHosts?.includes(hostname)) {
        return { slug: matcher.slug, surfaceType: matcher.surfaceType };
      }
    }
  }
  if (hostname) {
    return { slug: "browser", surfaceType: "browser" };
  }
  if (bundleId) {
    const lowerBundleId = bundleId.toLowerCase();
    if (BROWSER_BUNDLE_PREFIXES.some((prefix) => lowerBundleId.startsWith(prefix))) {
      return { slug: "browser", surfaceType: "browser" };
    }
  }
  return null;
}
exports.AGENT_NUDGE_SURFACE_MATCHERS = AGENT_NUDGE_SURFACE_MATCHERS;
exports.detectAgentNudgeSurface = detectAgentNudgeSurface;
