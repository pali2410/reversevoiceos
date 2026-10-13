"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "2ae712cc-20a9-40c4-a4df-6e0cd26a220c", e._sentryDebugIdIdentifier = "sentry-dbid-2ae712cc-20a9-40c4-a4df-6e0cd26a220c");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
class FaviconCache {
  cache = /* @__PURE__ */ new Map();
  set(url, favicon) {
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      this.cache.set(baseUrl, favicon);
    } catch (error) {
    }
  }
  get(url) {
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      return this.cache.get(baseUrl);
    } catch (error) {
      return void 0;
    }
  }
  clear() {
    this.cache.clear();
  }
}
const faviconCache = new FaviconCache();
exports.faviconCache = faviconCache;
