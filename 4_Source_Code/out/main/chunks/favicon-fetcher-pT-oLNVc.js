"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "c5d6e161-4282-42fe-bea2-129ef9fa4858", e._sentryDebugIdIdentifier = "sentry-dbid-c5d6e161-4282-42fe-bea2-129ef9fa4858");
  } catch (e2) {
  }
})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const log = require("electron-log");
const faviconCache = require("./favicon-cache-BuHsqQGz.js");
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
async function fetchFavicon(url) {
  try {
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const cached = faviconCache.faviconCache.get(url);
    if (cached !== void 0) {
      return cached;
    }
    try {
      const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
      const response = await main.proxyFetch(googleFaviconUrl, {
        method: "GET",
        signal: AbortSignal.timeout(3e3)
        // 3 second timeout
      });
      if (response.ok) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${blob.type};base64,${base64}`;
        faviconCache.faviconCache.set(url, dataUrl);
        log.info(
          `[FaviconFetcher] Successfully fetched favicon via Google service for: ${parsedUrl.hostname}`
        );
        return dataUrl;
      }
    } catch (error) {
      log.debug(
        `[FaviconFetcher] Google favicon service failed, trying direct URLs`
      );
    }
    const faviconUrls = [
      `${baseUrl}/favicon.ico`,
      `${baseUrl}/favicon.png`,
      `${baseUrl}/apple-touch-icon.png`,
      `${baseUrl}/apple-touch-icon-precomposed.png`
    ];
    for (const faviconUrl of faviconUrls) {
      try {
        const response = await main.proxyFetch(faviconUrl, {
          method: "GET",
          headers: { Accept: "image/*" },
          signal: AbortSignal.timeout(2e3)
          // 2 second timeout
        });
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          const dataUrl = `data:${blob.type};base64,${base64}`;
          faviconCache.faviconCache.set(url, dataUrl);
          log.info(
            `[FaviconFetcher] Successfully fetched favicon from: ${faviconUrl}`
          );
          return dataUrl;
        }
      } catch (error) {
        continue;
      }
    }
    faviconCache.faviconCache.set(url, null);
    log.debug(`[FaviconFetcher] No favicon found for: ${baseUrl}`);
    return null;
  } catch (error) {
    log.warn("[FaviconFetcher] Error fetching favicon:", error);
    return null;
  }
}
exports.fetchFavicon = fetchFavicon;
