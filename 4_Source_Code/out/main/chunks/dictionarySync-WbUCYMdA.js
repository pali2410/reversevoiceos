"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "9314ceb8-4f9b-4379-aed4-d2636c08526c", e._sentryDebugIdIdentifier = "sentry-dbid-9314ceb8-4f9b-4379-aed4-d2636c08526c");
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
const LOG_PREFIX = "[DictionarySync]";
const SYNC_MIN_INTERVAL_MS = 5e3;
let inFlightSync = null;
let lastSyncCompletedAt = 0;
async function pullAndMergeDictionary() {
  if (inFlightSync) {
    return inFlightSync;
  }
  if (Date.now() - lastSyncCompletedAt < SYNC_MIN_INTERVAL_MS) {
    return;
  }
  inFlightSync = doPullAndMergeDictionary().finally(() => {
    lastSyncCompletedAt = Date.now();
    inFlightSync = null;
  });
  return inFlightSync;
}
async function doPullAndMergeDictionary() {
  const userId = main.getCurrentUserId();
  if (!userId) {
    log.info(`${LOG_PREFIX} No user logged in, skipping sync`);
    return;
  }
  const { net } = await import("electron");
  if (!net.isOnline()) {
    log.info(`${LOG_PREFIX} Offline, skipping sync`);
    return;
  }
  try {
    log.info(`${LOG_PREFIX} Starting dictionary sync...`);
    const [allRemoteItems, localItems] = await Promise.all([
      main.grpcClient.listDictionaryItems(),
      main.DictionaryTable.findAllForSync(userId)
    ]);
    const remoteItems = allRemoteItems.filter(
      (item) => !item.userId.startsWith("team:")
    );
    log.info(
      `${LOG_PREFIX} Found ${remoteItems.length} remote personal, ${localItems.length} local items`
    );
    const localById = new Map(localItems.map((item) => [item.id, item]));
    const localByText = new Map(
      localItems.filter((item) => item.deleted_at === null).map((item) => [normalizeText(item.text), item])
    );
    let pulled = 0;
    let merged = 0;
    let pushed = 0;
    for (const remote of remoteItems) {
      const remoteTimestamp = getRemoteTimestamp(remote);
      try {
        const localById_ = localById.get(remote.id);
        if (localById_) {
          const localTimestamp = Date.parse(localById_.updated_at);
          if (localTimestamp > remoteTimestamp) {
            await pushLocalItem(localById_);
            await main.DictionaryTable.clearSyncFailed(localById_.id);
            pushed++;
            continue;
          }
          if (remoteTimestamp > localTimestamp) {
            if (remote.deletedAt) {
              const deletedLocal = remoteToLocal(remote, userId);
              await main.DictionaryTable.upsert(deletedLocal);
              localById.set(deletedLocal.id, deletedLocal);
              localByText.delete(normalizeText(deletedLocal.text));
            } else {
              const updatedLocal = remoteToLocal(remote, userId);
              await main.DictionaryTable.upsert(updatedLocal);
              localById.set(updatedLocal.id, updatedLocal);
              localByText.set(normalizeText(updatedLocal.text), updatedLocal);
            }
            pulled++;
          }
          continue;
        }
        if (remote.deletedAt) {
          continue;
        }
        const localByText_ = localByText.get(normalizeText(remote.text));
        if (localByText_) {
          const mergedItem = mergeItems(localByText_, remote, userId);
          await main.DictionaryTable.softDelete(localByText_.id);
          await main.DictionaryTable.upsert(mergedItem);
          await pushLocalItem(mergedItem);
          await main.DictionaryTable.clearSyncFailed(mergedItem.id);
          localById.delete(localByText_.id);
          localById.set(mergedItem.id, mergedItem);
          localByText.set(normalizeText(mergedItem.text), mergedItem);
          merged++;
          pushed++;
          continue;
        }
        const newLocalItem = remoteToLocal(remote, userId);
        await main.DictionaryTable.upsert(newLocalItem);
        localById.set(newLocalItem.id, newLocalItem);
        localByText.set(normalizeText(newLocalItem.text), newLocalItem);
        pulled++;
      } catch (error) {
        log.warn(
          `${LOG_PREFIX} Failed reconciling remote item "${remote.text}" (${remote.id}):`,
          error
        );
      }
    }
    const remoteIds = new Set(remoteItems.map((r) => r.id));
    const remoteTexts = new Set(
      remoteItems.filter((r) => !r.deletedAt).map((r) => normalizeText(r.text))
    );
    for (const local of localItems) {
      if (remoteIds.has(local.id)) continue;
      if (local.deleted_at) continue;
      if (remoteTexts.has(normalizeText(local.text))) continue;
      try {
        await pushLocalItem(local);
        await main.DictionaryTable.clearSyncFailed(local.id);
        pushed++;
      } catch (e) {
        await main.DictionaryTable.markSyncFailed(local.id);
        log.warn(`${LOG_PREFIX} Failed to push local item "${local.text}":`, e);
      }
    }
    log.info(
      `${LOG_PREFIX} Sync complete: ${pulled} pulled, ${merged} merged, ${pushed} pushed`
    );
  } catch (error) {
    log.error(`${LOG_PREFIX} Sync failed:`, error);
  }
}
function normalizeText(text) {
  return text.trim().toLowerCase();
}
function getRemoteTimestamp(remote) {
  return Date.parse(remote.deletedAt || remote.updatedAt);
}
async function pushLocalItem(local) {
  if (local.deleted_at) {
    await main.grpcClient.deleteDictionaryItem(local.id);
    return;
  }
  await main.grpcClient.createDictionaryItem(local);
}
function remoteToLocal(remote, userId) {
  return {
    id: remote.id,
    user_id: userId,
    text: remote.text,
    description: remote.description || null,
    auto_added: remote.autoAdded ?? false,
    app_identifiers: null,
    created_at: remote.createdAt,
    updated_at: remote.updatedAt,
    deleted_at: remote.deletedAt || null,
    sync_failed_at: null
  };
}
function mergeItems(local, remote, userId) {
  const localUpdatedAt = Date.parse(local.updated_at);
  const remoteUpdatedAt = Date.parse(remote.updatedAt);
  return {
    id: remote.id,
    user_id: userId,
    text: remote.text,
    description: localUpdatedAt >= remoteUpdatedAt ? local.description || remote.description || null : remote.description || local.description || null,
    auto_added: local.auto_added || remote.autoAdded,
    app_identifiers: null,
    created_at: remote.createdAt,
    updated_at: localUpdatedAt >= remoteUpdatedAt ? local.updated_at : remote.updatedAt,
    deleted_at: null,
    sync_failed_at: null
  };
}
exports.pullAndMergeDictionary = pullAndMergeDictionary;
