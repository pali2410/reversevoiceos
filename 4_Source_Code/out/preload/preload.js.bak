"use strict";
!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "c40846af-cfaa-456f-a09c-8ed964d24dec", e._sentryDebugIdIdentifier = "sentry-dbid-c40846af-cfaa-456f-a09c-8ed964d24dec");
  } catch (e2) {
  }
})();
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const log = require("electron-log/renderer");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const log__namespace = /* @__PURE__ */ _interopNamespaceDefault(log);
const api = {
  integrationWidgetTools: {
    open: (grantId) => electron.ipcRenderer.invoke("integration-widget-tools:open", grantId),
    invoke: (sessionId, request) => electron.ipcRenderer.invoke("integration-widget-tools:invoke", sessionId, request),
    confirm: (sessionId, requestId, confirmationId, approved) => electron.ipcRenderer.invoke(
      "integration-widget-tools:confirm",
      sessionId,
      requestId,
      confirmationId,
      approved
    ),
    close: (sessionId) => electron.ipcRenderer.invoke("integration-widget-tools:close", sessionId)
  },
  /**
   * Sends a one-way message to the main process.
   * @param channel The channel name to send the message on.
   * @param data The data to send.
   */
  send: (channel, ...args) => {
    electron.ipcRenderer.send(channel, ...args);
  },
  /**
   * Subscribe to an event, and return a cleanup function.
   * @param channel The event channel to subscribe to.
   * @param callback The callback to execute when the event is triggered.
   * @returns A cleanup function to unsubscribe.
   */
  on: (channel, callback) => {
    const handler = (_event, ...args) => {
      callback(...args);
    };
    electron.ipcRenderer.on(channel, handler);
    return () => {
      electron.ipcRenderer.removeListener(channel, handler);
    };
  },
  receive: (channel, func) => {
    electron.ipcRenderer.on(channel, (_, ...args) => func(...args));
  },
  invoke: (channel, ...args) => {
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  removeAllListeners: (channel) => electron.ipcRenderer.removeAllListeners(channel),
  // Key listener methods
  startKeyListener: () => electron.ipcRenderer.invoke("start-key-listener-service"),
  stopKeyListener: () => electron.ipcRenderer.invoke("stop-key-listener"),
  registerHotkeys: () => electron.ipcRenderer.invoke("register-hotkeys"),
  startNativeRecording: () => electron.ipcRenderer.invoke("start-native-recording"),
  stopNativeRecording: () => electron.ipcRenderer.invoke("stop-native-recording"),
  getNativeAudioDevices: () => electron.ipcRenderer.invoke("get-native-audio-devices"),
  getNativeAudioDevicesWithInfo: () => electron.ipcRenderer.invoke("get-native-audio-devices-with-info"),
  getDefaultMicrophoneName: () => electron.ipcRenderer.invoke("get-default-microphone-name"),
  onVolumeUpdate: (callback) => {
    const handler = (_, volume) => callback(volume);
    electron.ipcRenderer.on("volume-update", handler);
    return () => electron.ipcRenderer.removeListener("volume-update", handler);
  },
  blockKeys: (keys, owner) => electron.ipcRenderer.invoke("block-keys", keys, owner),
  unblockKey: (key, owner) => electron.ipcRenderer.invoke("unblock-key", key, owner),
  getBlockedKeys: () => electron.ipcRenderer.invoke("get-blocked-keys"),
  onKeyEvent: (callback) => {
    const handler = (_, event) => callback(event);
    electron.ipcRenderer.on("key-event", handler);
    return () => electron.ipcRenderer.removeListener("key-event", handler);
  },
  getKeyListenerError: () => electron.ipcRenderer.invoke("get-key-listener-error"),
  onNativeBinaryError: (callback) => {
    const handler = (_, error) => callback(error);
    electron.ipcRenderer.on("native-binary-error", handler);
    return () => electron.ipcRenderer.removeListener("native-binary-error", handler);
  },
  // Auth methods
  generateNewAuthState: () => electron.ipcRenderer.invoke("generate-new-auth-state"),
  exchangeAuthCode: (data) => electron.ipcRenderer.invoke("exchange-auth-code", data),
  logout: () => electron.ipcRenderer.invoke("logout"),
  // Pill window mouse event control. `reason` is a short tag logged by the
  // main process on every capture/release transition (diagnosing stuck
  // click-blocking states — see pill-set-mouse-events in ipcEvents.ts).
  setPillMouseEvents: (ignore, options, reason) => electron.ipcRenderer.invoke("pill-set-mouse-events", ignore, options, reason),
  // Agent-notch window mouse event control (macOS only; no-op on other platforms)
  setAgentNotchMouseEvents: (ignore, options) => electron.ipcRenderer.invoke("agent-notch-set-mouse-events", ignore, options),
  setAgentHistoryNotchMouseEvents: (ignore, options) => electron.ipcRenderer.invoke("agent-history-notch-set-mouse-events", ignore, options),
  setAgentHistoryNotchFocusable: (focusable) => electron.ipcRenderer.invoke("agent-history-notch-set-focusable", focusable),
  onAgentHistoryNotchSwitcher: (callback) => {
    const handler = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("agent-history-notch-switcher", handler);
    return () => electron.ipcRenderer.removeListener("agent-history-notch-switcher", handler);
  },
  cancelAgentHistoryNotchSwitcher: () => electron.ipcRenderer.invoke("agent-history-notch-switcher-cancel"),
  getSideNotchShortcutStatus: () => electron.ipcRenderer.invoke("get-side-notch-shortcut-status"),
  onSideNotchShortcutStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    electron.ipcRenderer.on("side-notch-shortcut-status", handler);
    return () => electron.ipcRenderer.removeListener("side-notch-shortcut-status", handler);
  },
  /** Returns true when the display currently hosting the AgentNotch has a
   *  hardware notch (M-series MacBook Pro 14"/16"). Used by the idle state
   *  to choose the MacBook-thick notch vs the slim external-display strip. */
  getDisplayHasNotch: () => electron.ipcRenderer.invoke("agent-notch-display-has-notch"),
  getAgentNotchDisplayGeometry: () => electron.ipcRenderer.invoke("agent-notch-display-geometry"),
  /** Toggle whether the macOS Agent-Notch window can be focused — needed
   *  briefly when the user edits a sent message inline (the embedded
   *  <textarea> needs to receive keyboard focus). No-op off macOS. */
  setAgentNotchFocusable: (focusable, options) => electron.ipcRenderer.invoke("agent-notch-set-focusable", focusable, options),
  setAgentNotchWindowSize: (width, height) => electron.ipcRenderer.invoke("agent-notch-set-window-size", width, height),
  /** Whether the notch has an installed macOS Liquid Glass stack
   *  (NSGlassEffectView, macOS 26+). Renderer material state and the
   *  acknowledged transition decide when that stack becomes visible. */
  isAgentNotchLiquidGlassAvailable: () => electron.ipcRenderer.invoke("agent-notch-liquid-glass-available"),
  /** Whether this machine can render Liquid Glass at all (macOS 26+ with the
   *  window-corners addon). Gates the Appearance tab's material picker. The
   *  per-notch availability probe is false while Solid Black owns the root. */
  isLiquidGlassSupported: () => electron.ipcRenderer.invoke("appearance-liquid-glass-supported"),
  /** Fired after the Appearance tab changes the top notch material: the notch
   *  briefly shows its surface so the user sees the new material live. */
  onAgentNotchMaterialPreview: (callback) => {
    const handler = (_event, material) => callback(String(material));
    electron.ipcRenderer.on("agent-notch-material-preview", handler);
    return () => {
      electron.ipcRenderer.removeListener("agent-notch-material-preview", handler);
    };
  },
  /** Apply one acknowledged native glass target before renderer presentation. */
  activateAgentNotchGlass: (geometry) => electron.ipcRenderer.invoke("agent-notch-activate-glass", geometry),
  /** Prepare a timed native contour without moving it. */
  prepareAgentNotchGlass: (transitionToken, geometry) => electron.ipcRenderer.invoke("agent-notch-prepare-glass", transitionToken, geometry),
  /** Arm the prepared native target and report its actual start time. */
  armPreparedAgentNotchGlass: (transitionToken) => electron.ipcRenderer.sendSync("agent-notch-arm-prepared-glass", transitionToken),
  /** Whether the side history notch is backed by real macOS Liquid Glass. */
  isAgentHistoryNotchLiquidGlassAvailable: () => electron.ipcRenderer.invoke("agent-history-notch-liquid-glass-available"),
  /** Side-notch twin of onAgentNotchMaterialPreview. */
  onAgentHistoryNotchMaterialPreview: (callback) => {
    const handler = (_event, material) => callback(String(material));
    electron.ipcRenderer.on("agent-history-notch-material-preview", handler);
    return () => {
      electron.ipcRenderer.removeListener(
        "agent-history-notch-material-preview",
        handler
      );
    };
  },
  /** Send a target side-notch silhouette. AppKit animates the single material
   *  contour natively, so expand/collapse needs one fire-and-forget IPC rather
   *  than renderer-driven per-frame geometry updates. */
  setAgentHistoryNotchGlassGeometry: (geometry) => electron.ipcRenderer.send("agent-history-notch-set-glass-geometry", geometry),
  /** Activation handshake for the side notch's glass — same contract as
   *  `activateAgentNotchGlass`: applies the geometry and resolves with whether
   *  the native glass is really live, so the web body only drops its opaque
   *  backing once something is visibly behind it. */
  activateAgentHistoryNotchGlass: (geometry) => electron.ipcRenderer.invoke("agent-history-notch-activate-glass", geometry),
  /** Real OS cursor position relative to the agent-notch window's content
   *  origin (i.e. renderer client coordinates), or null when the notch window
   *  isn't available. Lets the renderer reconcile notch hover state even after
   *  the cursor leaves the transparent window's bounds, where forwarded
   *  mousemove events stop arriving. */
  getAgentNotchCursorPoint: () => electron.ipcRenderer.invoke("agent-notch-get-cursor-point"),
  /** Real OS cursor position relative to the side (history) notch window's
   *  content origin, or null when that window isn't available. On Windows the
   *  sidebar polls this even at rest: mousemove forwarding rides a process-wide
   *  hook the OS can silently drop after a main-thread stall (VOS-832), and
   *  without this poll the trigger strip could never become clickable again. */
  getAgentHistoryNotchCursorPoint: () => electron.ipcRenderer.invoke("agent-history-notch-get-cursor-point"),
  /** Real OS cursor position relative to the pill window's content origin, or
   *  null when the pill window isn't available. On Windows the pill polls this
   *  at rest (VOS-842): with mouse-forwarding removed, the click-through pill
   *  gets no mousemove, so this is its only hover-entry signal. */
  getPillCursorPoint: () => electron.ipcRenderer.invoke("pill-get-cursor-point"),
  // Onboarding spotlight overlay controls (no-ops off macOS/Windows).
  spotlight: {
    /** Dim the screen and focus the live agent notch for the first task. */
    start: () => electron.ipcRenderer.invoke("spotlight:start"),
    /** Focus the side history notch, then move to the top notch after row click. */
    startHistoryFollowUp: () => electron.ipcRenderer.invoke("spotlight:start-history-follow-up"),
    /** Preload the history side-notch spotlight so the next click shows it instantly. */
    prepareHistoryFollowUp: () => electron.ipcRenderer.invoke("spotlight:prepare-history-follow-up"),
    /** Preload the result-hover spotlight so response-ready can show instantly. */
    prepareResultHover: () => electron.ipcRenderer.invoke("spotlight:prepare-result-hover"),
    /** Focus the live agent notch after an onboarding Agent response is ready. */
    startResultHover: () => electron.ipcRenderer.invoke("spotlight:start-result-hover"),
    /** Tear down the spotlight overlay + release forced surfaces. */
    stop: () => electron.ipcRenderer.invoke("spotlight:stop"),
    /** Move the spotlight from the top notch to the history side-notch. */
    advanceToHistory: () => electron.ipcRenderer.invoke("spotlight:advance-to-history"),
    /** User finished: tear down + advance the onboarding step. */
    requestFinish: () => electron.ipcRenderer.invoke("spotlight:request-finish"),
    /** Last-resort dismiss: tear down without advancing the onboarding step. */
    requestDismiss: () => electron.ipcRenderer.invoke("spotlight:request-dismiss")
  },
  // Onboarding macOS permission drag-to-grant panel (no-ops elsewhere).
  permissions: {
    /** Open the requested pane and float the drag helper attached to it. */
    showDragPanel: (permission) => electron.ipcRenderer.invoke("permissions:show-drag-panel", permission),
    /** Tear the drag helper down (user dismissed / step left). */
    hideDragPanel: () => electron.ipcRenderer.invoke("permissions:hide-drag-panel"),
    /** Reopen the permission pane and reveal VoiceOS.app in Finder. */
    showAppInFinder: (permission) => electron.ipcRenderer.invoke("permissions:show-app-in-finder", permission),
    /** Start a native drag of the .app bundle from the helper panel.
     *  Fire-and-forget send — the invoke form SIGTRAPs (see files.startDrag). */
    startAppDrag: (icon) => electron.ipcRenderer.send("permissions:start-app-drag", { icon }),
    /** Main → onboarding window: the drag helper went away and why. */
    onDragPanelClosed: (callback) => {
      const listener = (_event, payload) => callback(payload);
      electron.ipcRenderer.on("permission-drag-panel-closed", listener);
      return () => {
        electron.ipcRenderer.removeListener("permission-drag-panel-closed", listener);
      };
    }
  },
  // Pill window focusable control (for keyboard input in chat follow-up)
  setPillFocusable: (focusable) => electron.ipcRenderer.invoke("pill-set-focusable", focusable),
  // Pill drag — allows users to reposition the pill window
  pillStartDrag: (mouseX, mouseY) => electron.ipcRenderer.invoke("pill-start-drag", mouseX, mouseY),
  pillDragMove: () => electron.ipcRenderer.invoke("pill-drag-move"),
  pillStopDrag: () => electron.ipcRenderer.invoke("pill-stop-drag"),
  pillUnpin: () => electron.ipcRenderer.invoke("pill-unpin"),
  pillSetAgentFloatingMode: (enabled) => electron.ipcRenderer.invoke("pill-set-agent-floating-mode", enabled),
  pillRestorePosition: () => electron.ipcRenderer.invoke("pill-restore-position"),
  // All other IPC calls that the UI makes
  // These now just pass through, as the main process handles the window context
  "init-window": () => electron.ipcRenderer.invoke("init-window"),
  "is-window-minimizable": () => electron.ipcRenderer.invoke("is-window-minimizable"),
  "is-window-maximizable": () => electron.ipcRenderer.invoke("is-window-maximizable"),
  "window-minimize": () => electron.ipcRenderer.invoke("window-minimize"),
  "window-maximize": () => electron.ipcRenderer.invoke("window-maximize"),
  "window-close": () => electron.ipcRenderer.invoke("window-close"),
  "window-maximize-toggle": () => electron.ipcRenderer.invoke("window-maximize-toggle"),
  "web-undo": () => electron.ipcRenderer.invoke("web-undo"),
  "web-redo": () => electron.ipcRenderer.invoke("web-redo"),
  "web-cut": () => electron.ipcRenderer.invoke("web-cut"),
  "web-copy": () => electron.ipcRenderer.invoke("web-copy"),
  "web-paste": () => electron.ipcRenderer.invoke("web-paste"),
  "web-delete": () => electron.ipcRenderer.invoke("web-delete"),
  "web-select-all": () => electron.ipcRenderer.invoke("web-select-all"),
  "web-reload": () => electron.ipcRenderer.invoke("web-reload"),
  "web-force-reload": () => electron.ipcRenderer.invoke("web-force-reload"),
  "web-toggle-devtools": () => electron.ipcRenderer.invoke("web-toggle-devtools"),
  "web-actual-size": () => electron.ipcRenderer.invoke("web-actual-size"),
  "web-zoom-in": () => electron.ipcRenderer.invoke("web-zoom-in"),
  "web-zoom-out": () => electron.ipcRenderer.invoke("web-zoom-out"),
  "web-toggle-fullscreen": () => electron.ipcRenderer.invoke("web-toggle-fullscreen"),
  "web-open-url": (url) => electron.ipcRenderer.invoke("web-open-url", url),
  openExternal: (url) => electron.ipcRenderer.invoke("web-open-url", url),
  "check-accessibility-permission": (prompt) => electron.ipcRenderer.invoke("check-accessibility-permission", prompt),
  // Passive accessibility check that NEVER triggers permission dialogs
  "get-accessibility-permission-status": () => electron.ipcRenderer.invoke("get-accessibility-permission-status"),
  // Opens System Settings directly to the Accessibility panel
  openAccessibilitySettings: () => electron.ipcRenderer.invoke("open-accessibility-settings"),
  "check-microphone-permission": (prompt) => electron.ipcRenderer.invoke("check-microphone-permission", prompt),
  "get-microphone-permission-status": () => electron.ipcRenderer.invoke("get-microphone-permission-status"),
  "check-screen-recording-permission": (prompt) => electron.ipcRenderer.invoke("check-screen-recording-permission", prompt),
  openScreenRecordingSettings: () => electron.ipcRenderer.invoke("open-screen-recording-settings"),
  showMainWindow: () => electron.ipcRenderer.invoke("show-main-window"),
  showMainWindowSettings: () => electron.ipcRenderer.invoke("show-main-window-settings"),
  // Trigger full screen capture to prompt macOS Sequoia "bypass picker" consent dialog
  triggerScreenCaptureConsent: () => electron.ipcRenderer.invoke("trigger-screen-capture-consent"),
  // Restart the app (used after granting permissions that require restart)
  restartApp: () => electron.ipcRenderer.invoke("restart-app"),
  "start-native-recording": () => electron.ipcRenderer.send("start-native-recording"),
  "stop-native-recording": () => electron.ipcRenderer.send("stop-native-recording"),
  // Pill-triggered recording methods
  pill: {
    startDictation: (options) => electron.ipcRenderer.invoke("start-dictation-from-pill", options),
    startAgentMode: () => electron.ipcRenderer.invoke("start-agent-from-pill"),
    stopRecording: () => electron.ipcRenderer.invoke("stop-recording-from-pill"),
    cancelRecording: () => electron.ipcRenderer.invoke("cancel-recording-from-pill"),
    undoKeyword: (keywordId) => electron.ipcRenderer.invoke("dictionary:delete", keywordId),
    // Voice follow-up from pill (click-based)
    startVoiceFollowUp: () => electron.ipcRenderer.invoke("start-voice-follow-up-from-pill"),
    stopVoiceFollowUp: () => electron.ipcRenderer.invoke("stop-voice-follow-up-from-pill"),
    // Chat follow-up methods
    sendFollowUp: (text) => electron.ipcRenderer.invoke("chat-follow-up", text),
    endChatSession: () => electron.ipcRenderer.send("end-chat-session"),
    cancelTranscription: () => electron.ipcRenderer.send("cancel-transcription"),
    // Check if focused element is editable and paste output text
    checkFocusedEditable: () => electron.ipcRenderer.invoke("check-focused-editable"),
    pasteOutputText: (text) => electron.ipcRenderer.invoke("paste-output-text", text)
  },
  // Hands-free recording methods (keyboard-triggered, space bar activated)
  handsFree: {
    stopRecording: () => electron.ipcRenderer.invoke("stop-handsfree-recording"),
    cancelRecording: () => electron.ipcRenderer.invoke("cancel-handsfree-recording")
  },
  dev: {
    revertLastMigration: () => electron.ipcRenderer.invoke("dev:revert-last-migration"),
    wipeDatabase: () => electron.ipcRenderer.invoke("dev:wipe-database"),
    checkSchema: () => electron.ipcRenderer.invoke("debug:check-schema"),
    armSimulatedFailure: () => electron.ipcRenderer.invoke("dev:arm-simulated-failure"),
    isSimulatedFailureArmed: () => electron.ipcRenderer.invoke("dev:is-simulated-failure-armed")
  },
  notes: {
    getAll: () => electron.ipcRenderer.invoke("notes:get-all"),
    add: (note) => electron.ipcRenderer.invoke("notes:add", note),
    updateContent: (id, content) => electron.ipcRenderer.invoke("notes:update-content", { id, content }),
    delete: (id) => electron.ipcRenderer.invoke("notes:delete", id)
  },
  dictionary: {
    getAll: () => electron.ipcRenderer.invoke("dictionary:get-all"),
    add: (item) => electron.ipcRenderer.invoke("dictionary:add", item),
    update: (id, text, description, _appIdentifiers) => electron.ipcRenderer.invoke("dictionary:update", {
      id,
      text,
      description,
      app_identifiers: null
    }),
    delete: (id) => electron.ipcRenderer.invoke("dictionary:delete", id),
    analyzeImport: (payload) => electron.ipcRenderer.invoke("dictionary:analyze-import", payload),
    previewCompetitorImport: (payload) => electron.ipcRenderer.invoke("dictionary:preview-competitor-import", payload)
  },
  knowledge: {
    getAll: () => electron.ipcRenderer.invoke("knowledge:get-all"),
    add: (title, content) => electron.ipcRenderer.invoke("knowledge:add", { title, content }),
    update: (id, title, content) => electron.ipcRenderer.invoke("knowledge:update", { id, title, content }),
    delete: (id) => electron.ipcRenderer.invoke("knowledge:delete", id),
    /**
     * Sync knowledge items to the gRPC client cache in the main process.
     * Called when knowledge is loaded/updated in the frontend to keep the cache in sync.
     */
    syncToGrpc: (items) => electron.ipcRenderer.invoke("knowledge:sync-to-grpc", items)
  },
  agentKnowledge: {
    get: () => electron.ipcRenderer.invoke("agent-knowledge:get"),
    save: (profile) => electron.ipcRenderer.invoke("agent-knowledge:save", profile),
    extract: (urls) => electron.ipcRenderer.invoke("agent-knowledge:extract", { urls }),
    processInteraction: (payload) => electron.ipcRenderer.invoke("agent-knowledge:process-interaction", payload),
    deleteMemory: (memoryId) => electron.ipcRenderer.invoke("agent-knowledge:delete-memory", { memoryId }),
    addMemory: (fact) => electron.ipcRenderer.invoke("agent-knowledge:add-memory", { fact }),
    setMemoryCore: (memoryId, core) => electron.ipcRenderer.invoke("agent-knowledge:set-memory-core", {
      memoryId,
      core
    }),
    savePreferences: (preferencesMd) => electron.ipcRenderer.invoke("agent-knowledge:save-preferences", preferencesMd),
    undoPreferences: () => electron.ipcRenderer.invoke("agent-knowledge:undo-preferences")
  },
  customInstructions: {
    getAll: () => electron.ipcRenderer.invoke("custom-instructions:get-all"),
    add: (appIdentifier, instruction) => electron.ipcRenderer.invoke("custom-instructions:add", {
      appIdentifier,
      instruction
    }),
    update: (id, appIdentifier, instruction) => electron.ipcRenderer.invoke("custom-instructions:update", {
      id,
      appIdentifier,
      instruction
    }),
    delete: (id) => electron.ipcRenderer.invoke("custom-instructions:delete", id),
    /**
     * Sync custom instructions to the gRPC client cache in the main process.
     * Called when custom instructions are loaded/updated in the frontend to keep the cache in sync.
     */
    syncToGrpc: () => electron.ipcRenderer.invoke("custom-instructions:sync-to-grpc"),
    /**
     * Get list of apps the user has used (for dropdown in custom instructions UI)
     */
    getUsedApps: () => electron.ipcRenderer.invoke("custom-instructions:get-used-apps"),
    getInstalledApps: () => electron.ipcRenderer.invoke("custom-instructions:get-installed-apps")
  },
  voiceSessions: {
    getInsights: () => electron.ipcRenderer.invoke("voice-sessions:get-insights"),
    getAll: () => electron.ipcRenderer.invoke("voice-sessions:get-all"),
    delete: (id) => electron.ipcRenderer.invoke("voice-sessions:delete", id),
    retranscribe: (id) => electron.ipcRenderer.invoke("voice-sessions:retranscribe", id),
    hasAudio: (id) => electron.ipcRenderer.invoke("voice-sessions:has-audio", id)
  },
  agentHistory: {
    getRecent: (limit) => electron.ipcRenderer.invoke("agent-history:get-recent", limit),
    getLiveActivity: (sessionId) => electron.ipcRenderer.invoke("agent-history:get-live-activity", sessionId)
  },
  appIcons: {
    getAll: () => electron.ipcRenderer.invoke("app-icons:get-all"),
    getByName: (appName) => electron.ipcRenderer.invoke("app-icons:get-by-name", appName)
  },
  loginItem: {
    setSettings: (enabled) => electron.ipcRenderer.invoke("set-login-item-settings", enabled),
    getSettings: () => electron.ipcRenderer.invoke("get-login-item-settings")
  },
  dock: {
    setVisibility: (visible) => electron.ipcRenderer.invoke("set-dock-visibility", visible),
    getVisibility: () => electron.ipcRenderer.invoke("get-dock-visibility")
  },
  // Send settings updates to pill window
  notifySettingsUpdate: (settings) => electron.ipcRenderer.send("settings-update", settings),
  // Send onboarding updates to pill window
  notifyOnboardingUpdate: (onboarding) => electron.ipcRenderer.send("onboarding-update", onboarding),
  /** Persist onboarding to main store before returning (for hotkey gating). */
  persistOnboardingStoreSync: (onboarding) => electron.ipcRenderer.sendSync("onboarding-persist-sync", onboarding),
  // First-launch cinematic cover window → main: watched to the end or skipped.
  introOverlayHandoff: (outcome, animate) => electron.ipcRenderer.send("intro-overlay-handoff", outcome, animate),
  introOverlayAwaitingGetStarted: (awaiting) => electron.ipcRenderer.send("intro-overlay-awaiting-get-started", awaiting),
  introOverlayAwaitingName: (awaiting) => electron.ipcRenderer.send("intro-overlay-awaiting-name", awaiting),
  introOverlayAwaitingLanguage: (awaiting) => electron.ipcRenderer.send("intro-overlay-awaiting-language", awaiting),
  introOverlayShowNotchWelcome: () => electron.ipcRenderer.send("intro-overlay-show-notch-welcome"),
  introOverlaySubmitName: (name) => electron.ipcRenderer.invoke("intro-overlay-submit-name", name),
  introOverlaySubmitLanguage: (language) => electron.ipcRenderer.invoke("intro-overlay-submit-language", language),
  onIntroOverlayNameReplyComplete: (callback) => {
    const handler = (_event, playedToCompletion) => callback(playedToCompletion);
    electron.ipcRenderer.on("intro-overlay-name-reply-complete", handler);
    return () => electron.ipcRenderer.removeListener("intro-overlay-name-reply-complete", handler);
  },
  onIntroOverlayLanguageReplyComplete: (callback) => {
    const handler = (_event, playedToCompletion) => callback(playedToCompletion);
    electron.ipcRenderer.on("intro-overlay-language-reply-complete", handler);
    return () => electron.ipcRenderer.removeListener(
      "intro-overlay-language-reply-complete",
      handler
    );
  },
  onIntroOverlayExchangeUpdate: (callback) => {
    const handler = (_event, update) => callback(update);
    electron.ipcRenderer.on("intro-overlay-exchange-update", handler);
    return () => electron.ipcRenderer.removeListener("intro-overlay-exchange-update", handler);
  },
  introOverlayFinished: (outcome) => electron.ipcRenderer.send("intro-overlay-finished", outcome),
  // Send user auth updates to pill window
  notifyUserAuthUpdate: (authUser) => electron.ipcRenderer.send("user-auth-update", authUser),
  // Analytics device ID methods
  "analytics:get-device-id": () => electron.ipcRenderer.invoke("analytics:get-device-id"),
  detectInstalledCompetitorApps: () => electron.ipcRenderer.invoke("analytics:detect-installed-competitor-apps"),
  // Onboarding state for current user
  getOnboardingState: () => electron.ipcRenderer.invoke("get-onboarding-state"),
  notifyLoginSuccess: (profile, idToken, accessToken) => {
    return electron.ipcRenderer.invoke("notify-login-success", {
      profile,
      idToken,
      accessToken
    });
  },
  // Delete user data from both local and server databases
  deleteUserData: () => {
    return electron.ipcRenderer.invoke("delete-user-data");
  },
  // Reset settings to valid defaults (e.g. after account delete) so key listener keeps working
  resetSettingsToDefaults: () => {
    return electron.ipcRenderer.invoke("reset-settings-to-defaults");
  },
  // Check if the local server is healthy and accessible
  checkServerHealth: () => {
    return electron.ipcRenderer.invoke("check-server-health");
  },
  updater: {
    onUpdateAvailable: (callback) => {
      const handler = () => callback();
      electron.ipcRenderer.on("update-available", handler);
      return () => electron.ipcRenderer.removeListener("update-available", handler);
    },
    onUpdateDownloading: (callback) => {
      const handler = () => callback();
      electron.ipcRenderer.on("update-downloading", handler);
      return () => electron.ipcRenderer.removeListener("update-downloading", handler);
    },
    onDownloadProgress: (callback) => {
      const handler = (_, percent) => callback(percent);
      electron.ipcRenderer.on("update-download-progress", handler);
      return () => electron.ipcRenderer.removeListener("update-download-progress", handler);
    },
    onUpdateDownloaded: (callback) => {
      const handler = () => callback();
      electron.ipcRenderer.on("update-downloaded", handler);
      return () => electron.ipcRenderer.removeListener("update-downloaded", handler);
    },
    onUpdateNotAvailable: (callback) => {
      const handler = () => callback();
      electron.ipcRenderer.on("update-not-available", handler);
      return () => electron.ipcRenderer.removeListener("update-not-available", handler);
    },
    onUpdateError: (callback) => {
      const handler = (_, error) => callback(error);
      electron.ipcRenderer.on("update-error", handler);
      return () => electron.ipcRenderer.removeListener("update-error", handler);
    },
    onUpdateSkipped: (callback) => {
      const handler = (_, reason) => callback(reason);
      electron.ipcRenderer.on("update-skipped", handler);
      return () => electron.ipcRenderer.removeListener("update-skipped", handler);
    },
    checkForUpdates: () => electron.ipcRenderer.invoke("request-check-updates"),
    downloadUpdate: () => electron.ipcRenderer.invoke("request-download-update"),
    installUpdate: () => electron.ipcRenderer.send("install-update"),
    getUpdateStatus: () => electron.ipcRenderer.invoke("get-update-status")
  },
  // Platform info
  getPlatform: () => electron.ipcRenderer.invoke("get-platform"),
  // System theme detection
  getSystemTheme: () => electron.ipcRenderer.invoke("get-system-theme"),
  onSystemThemeChanged: (callback) => {
    const handler = (_, theme) => callback(theme);
    electron.ipcRenderer.on("system-theme-changed", handler);
    return () => electron.ipcRenderer.removeListener("system-theme-changed", handler);
  },
  // Selected Text Reader
  selectedText: {
    get: (options) => electron.ipcRenderer.invoke("get-selected-text", options),
    getString: (maxLength) => electron.ipcRenderer.invoke("get-selected-text-string", maxLength),
    hasSelected: () => electron.ipcRenderer.invoke("has-selected-text")
  },
  // OpenAI token fetching (cached in main process)
  openai: {
    getToken: () => electron.ipcRenderer.invoke("openai:get-token")
  },
  // Subscription and usage tracking
  subscription: {
    getStatus: () => electron.ipcRenderer.invoke("subscription:get-status"),
    getUsageStats: () => electron.ipcRenderer.invoke("subscription:get-usage-stats"),
    createCheckoutSession: (billingInterval = "yearly", promo, promotionCode) => electron.ipcRenderer.invoke(
      "subscription:create-checkout-session",
      billingInterval,
      promo,
      promotionCode
    ),
    // With intent "cancel" the portal opens directly on the cancellation
    // page, carrying Stripe's retention-discount banner when still eligible.
    createPortalSession: (intent) => electron.ipcRenderer.invoke("subscription:create-portal-session", intent),
    sendCancellationReason: (reason, expectation, meta) => electron.ipcRenderer.invoke(
      "subscription:send-cancellation-reason",
      reason,
      expectation,
      meta
    ),
    // Activate referral free month if user has a referral code in their metadata
    activateReferral: () => electron.ipcRenderer.invoke("subscription:activate-referral"),
    // Activate free trial for new users
    activateTrial: () => electron.ipcRenderer.invoke("subscription:activate-trial"),
    // Cancel-flow retention offers
    getCancelFlowOptions: (countryCode) => electron.ipcRenderer.invoke("subscription:get-cancel-flow-options", countryCode),
    pauseSubscription: (reason) => electron.ipcRenderer.invoke("subscription:pause", reason),
    acceptRetentionOffer: () => electron.ipcRenderer.invoke("subscription:accept-retention-offer"),
    // VOS-791 in-app trial management. Never route these through the Stripe
    // portal while trialing: its trial_update_behavior ends the trial and
    // charges immediately.
    /** C5: show a native notification that a payment failed. */
    notifyPaymentFailed: () => electron.ipcRenderer.invoke("subscription:notify-payment-failed"),
    /** C16: brand, last four and expiry of the card on file. */
    getPaymentMethod: () => electron.ipcRenderer.invoke("subscription:get-payment-method"),
    /** A7: restore a subscription that is scheduled to cancel. */
    undoCancel: () => electron.ipcRenderer.invoke("subscription:undo-cancel"),
    changeTrialPlan: (targetInterval) => electron.ipcRenderer.invoke("subscription:change-trial-plan", targetInterval),
    // The paid equivalent. Separate from the trial route because a trialing
    // subscription switches for free while a paid one is billed the
    // difference, and `applied` can be false while the charge settles.
    changePaidPlan: (targetInterval) => electron.ipcRenderer.invoke("subscription:change-paid-plan", targetInterval),
    // Saved payment methods: switch, add, remove. The whole of what the
    // Stripe portal was ever used for.
    listPaymentMethods: () => electron.ipcRenderer.invoke("subscription:list-payment-methods"),
    setDefaultPaymentMethod: (paymentMethodId) => electron.ipcRenderer.invoke(
      "subscription:set-default-payment-method",
      paymentMethodId
    ),
    detachPaymentMethod: (paymentMethodId) => electron.ipcRenderer.invoke("subscription:detach-payment-method", paymentMethodId),
    // Replace the card on file, in app. Two steps: open a SetupIntent the
    // card form confirms against, then promote what it produced.
    startCardUpdate: () => electron.ipcRenderer.invoke("subscription:start-card-update"),
    finishCardUpdate: (setupIntentId) => electron.ipcRenderer.invoke("subscription:finish-card-update", setupIntentId),
    // Cancels at period end: they keep Pro until the time they paid for runs
    // out, and can undo until then.
    cancelPaidSubscription: () => electron.ipcRenderer.invoke("subscription:cancel-paid"),
    cancelTrial: () => electron.ipcRenderer.invoke("subscription:cancel-trial"),
    // VOS-1068: winback offer for churned users (80% off on the saved card)
    getWinbackOffer: () => electron.ipcRenderer.invoke("subscription:get-winback-offer"),
    // Charges the saved card immediately; callers confirm with the user
    // first. On a failed charge, checkoutUrl carries the Stripe fallback.
    acceptWinbackOffer: () => electron.ipcRenderer.invoke("subscription:accept-winback-offer"),
    // Whether this account can still get the 7-day free trial
    getTrialEligibility: () => electron.ipcRenderer.invoke("subscription:get-trial-eligibility"),
    // Report that the onboarding subscribe step was shown (arms the 24h
    // winback email if the user doesn't subscribe)
    paywallViewed: () => electron.ipcRenderer.invoke("subscription:paywall-viewed"),
    // In-app paywall (embedded checkout): payment happens in a modal inside
    // the dashboard instead of an external Stripe Checkout tab.
    embeddedPaywall: {
      // Only for abandoning wallet authorization before confirming payment.
      closeWallet: () => electron.ipcRenderer.invoke("subscription:embedded-paywall-close-wallet"),
      // Pricing/trial/discount preview plus the Payment Element iframe URL.
      // available:false → fall back to hosted Checkout.
      start: (args) => electron.ipcRenderer.invoke("subscription:embedded-paywall-start", args),
      // A URL for finishing this payment in the customer's own browser, which
      // is the only place a signed-in Google Pay exists.
      /** The paywall frame's address, so it can be warmed before it is needed. */
      prewarmElement: () => electron.ipcRenderer.invoke("subscription:prewarm-paywall-element"),
      browserWallet: (args) => electron.ipcRenderer.invoke(
        "subscription:embedded-paywall-browser-wallet",
        args
      ),
      // Create the intent to confirm (called when the user presses pay).
      confirm: (args) => electron.ipcRenderer.invoke("subscription:embedded-paywall-confirm", args),
      // Finalize after the Payment Element confirmed the intent.
      complete: (args) => electron.ipcRenderer.invoke("subscription:embedded-paywall-complete", args)
    },
    // Team subscription methods
    createTeamCheckoutSession: (seatCount = 3, billingInterval = "yearly", promotionCode) => electron.ipcRenderer.invoke(
      "subscription:create-team-checkout-session",
      seatCount,
      billingInterval,
      promotionCode
    ),
    getTeamStatus: () => electron.ipcRenderer.invoke("subscription:get-team-status"),
    // Link team subscription to a newly created team
    linkTeamSubscription: (teamId) => electron.ipcRenderer.invoke("subscription:link-team-subscription", teamId),
    // Get localized prices based on country code
    getPrices: (countryCode) => electron.ipcRenderer.invoke("subscription:get-prices", countryCode),
    // Student discount (50% off): academic-email verification. getStatus drives
    // the paywall entry point; requestCode emails a one-time code; verifyCode
    // confirms it and, if verified, unlocks the "student_50" checkout promo.
    student: {
      getStatus: () => electron.ipcRenderer.invoke("student:get-status"),
      requestCode: (email, language) => electron.ipcRenderer.invoke("student:request-code", email, language),
      verifyCode: (code) => electron.ipcRenderer.invoke("student:verify-code", code)
    }
  },
  // Dictation feedback
  feedback: {
    submit: (feedback) => electron.ipcRenderer.invoke("feedback:submit", feedback),
    requestIntegration: (payload) => electron.ipcRenderer.invoke("feedback:request-integration", payload),
    submitProductSurvey: (payload) => electron.ipcRenderer.invoke("feedback:submit-product-survey", payload),
    getProductSurveyStatus: () => electron.ipcRenderer.invoke("feedback:get-product-survey-status"),
    dismissProductSurveyForMonth: () => electron.ipcRenderer.invoke("feedback:dismiss-product-survey")
  },
  // Override app context for Playground and onboarding
  playground: {
    setAppContext: (appName, windowTitle, contextText) => electron.ipcRenderer.invoke(
      "set-override-app-context",
      appName,
      windowTitle,
      contextText
    ),
    clearAppContext: () => electron.ipcRenderer.invoke("clear-override-app-context")
  },
  // Onboarding microphone helpers
  onboarding: {
    /**
     * Force switch to the built-in MacBook microphone if AirPods are detected.
     * This improves dictation quality during onboarding.
     * Returns an object with success status and whether a switch was made.
     */
    forceBuiltinMicrophone: () => electron.ipcRenderer.invoke("force-builtin-microphone-for-onboarding"),
    /**
     * Restore the original microphone setting after onboarding is complete or cancelled.
     */
    restoreOriginalMicrophone: () => electron.ipcRenderer.invoke("restore-original-microphone-after-onboarding")
  },
  // User profile management
  userProfile: {
    get: () => electron.ipcRenderer.invoke("user-profile:get"),
    update: (data) => electron.ipcRenderer.invoke("user-profile:update", data)
  },
  // Get app version
  getAppVersion: () => electron.ipcRenderer.invoke("get-app-version"),
  getSystemInfo: () => electron.ipcRenderer.invoke("get-system-info"),
  getDiagnosticLogs: () => electron.ipcRenderer.invoke("get-diagnostic-logs"),
  notifyRemoteDiagnosticLogsShared: () => electron.ipcRenderer.invoke("notify-remote-diagnostic-logs-shared"),
  // Writing context management
  writingContexts: {
    getInstalledAppNames: () => electron.ipcRenderer.invoke("writing-contexts:get-installed-app-names")
  },
  writingStyles: {
    get: (ownerUserId) => electron.ipcRenderer.invoke("writing-styles:get", { ownerUserId }),
    save: (state, ownerUserId) => electron.ipcRenderer.invoke("writing-styles:save", { state, ownerUserId })
  },
  chatGpt: {
    status: () => electron.ipcRenderer.invoke("chatgpt:status"),
    connect: () => electron.ipcRenderer.invoke("chatgpt:connect"),
    disconnect: () => electron.ipcRenderer.invoke("chatgpt:disconnect"),
    // Set / clear the active thread so the next ChatGPT ask continues it.
    setActiveThread: (conversationUrl) => electron.ipcRenderer.invoke("chatgpt:set-active-thread", conversationUrl)
  },
  chatGptHistory: {
    getRecent: () => electron.ipcRenderer.invoke("chatgpt-history:get-recent")
  },
  obsidian: {
    status: () => electron.ipcRenderer.invoke("obsidian:status"),
    connect: () => electron.ipcRenderer.invoke("obsidian:connect"),
    disconnect: () => electron.ipcRenderer.invoke("obsidian:disconnect")
  },
  applemail: {
    accountAddresses: () => electron.ipcRenderer.invoke("applemail:account-addresses"),
    status: () => electron.ipcRenderer.invoke("applemail:status"),
    connect: () => electron.ipcRenderer.invoke("applemail:connect"),
    disconnect: () => electron.ipcRenderer.invoke("applemail:disconnect"),
    messagePreview: (id) => electron.ipcRenderer.invoke("applemail:message-preview", { id })
  },
  imessage: {
    status: () => electron.ipcRenderer.invoke("imessage:status"),
    connect: () => electron.ipcRenderer.invoke("imessage:connect"),
    disconnect: () => electron.ipcRenderer.invoke("imessage:disconnect"),
    threadPreview: (target, limit) => electron.ipcRenderer.invoke("imessage:thread-preview", { target, limit }),
    linkPreview: (url) => electron.ipcRenderer.invoke("imessage:link-preview", { url })
  },
  files: {
    status: () => electron.ipcRenderer.invoke("files:status"),
    connect: () => electron.ipcRenderer.invoke("files:connect"),
    disconnect: () => electron.ipcRenderer.invoke("files:disconnect"),
    filePreview: (path) => electron.ipcRenderer.invoke("files:file-preview", { path }),
    // Fire-and-forget: called from a tile's dragstart so the main process can
    // start a native OS file drag (icon = the first preview data URL). A
    // multi-selection drags all its files together.
    startDrag: (payload) => electron.ipcRenderer.send("files:start-drag", payload),
    // Direct user actions on gallery items (double-click / right-click) — act
    // immediately like Finder, no agent round-trip.
    openPath: (path) => electron.ipcRenderer.send("files:open-path", { path }),
    contextMenu: (path) => electron.ipcRenderer.send("files:context-menu", { path }),
    // Double-clicking a folder row browses into it: re-lists the folder and
    // returns a fresh gallery payload for the notch to swap in locally.
    browseFolder: (path) => electron.ipcRenderer.invoke("files:browse-folder", { path })
  },
  reminders: {
    status: () => electron.ipcRenderer.invoke("reminders:status"),
    connect: () => electron.ipcRenderer.invoke("reminders:connect"),
    disconnect: () => electron.ipcRenderer.invoke("reminders:disconnect"),
    reminderPreview: (target) => electron.ipcRenderer.invoke("reminders:reminder-preview", { target }),
    lists: () => electron.ipcRenderer.invoke("reminders:lists")
  },
  maps: {
    status: () => electron.ipcRenderer.invoke("maps:status"),
    connect: () => electron.ipcRenderer.invoke("maps:connect"),
    disconnect: () => electron.ipcRenderer.invoke("maps:disconnect")
  },
  codingAgents: {
    chat: {
      updateThread: (id, action) => electron.ipcRenderer.invoke("codingAgent:chat-update-thread", id, action),
      list: (input) => electron.ipcRenderer.invoke("codingAgent:chat-list", input),
      select: (input) => electron.ipcRenderer.invoke("codingAgent:chat-select", input),
      snapshot: (id) => electron.ipcRenderer.invoke("codingAgent:chat-snapshot", id),
      readOlder: (id) => electron.ipcRenderer.invoke("codingAgent:chat-older", id),
      send: (input) => electron.ipcRenderer.invoke("codingAgent:chat-send", input),
      setTurnSettings: (id, settings) => electron.ipcRenderer.invoke("codingAgent:chat-turn-settings", id, settings),
      cancel: (id, turnId) => electron.ipcRenderer.invoke("codingAgent:chat-cancel", id, turnId),
      answer: (id, promptId, answer) => electron.ipcRenderer.invoke("codingAgent:chat-answer", id, promptId, answer),
      release: (id) => electron.ipcRenderer.invoke("codingAgent:chat-release", id),
      onUpdate: (listener) => {
        const handler = (_event, snapshot) => listener(snapshot);
        electron.ipcRenderer.on("codingAgent:chat-update", handler);
        return () => electron.ipcRenderer.removeListener("codingAgent:chat-update", handler);
      }
    },
    status: (agent) => electron.ipcRenderer.invoke("codingAgent:status", agent),
    connect: (agent) => electron.ipcRenderer.invoke("codingAgent:connect", agent),
    disconnect: (agent) => electron.ipcRenderer.invoke("codingAgent:disconnect", agent),
    getModelSettings: (agent) => electron.ipcRenderer.invoke("codingAgent:get-model-settings", agent),
    setModel: (agent, model) => electron.ipcRenderer.invoke("codingAgent:set-model", agent, model),
    setEffort: (agent, effort) => electron.ipcRenderer.invoke("codingAgent:set-effort", agent, effort),
    // Durable coding rows for the side notch: orchestration parents AND
    // standalone Claude Code / Codex sessions, one combined feed.
    taskHistory: () => electron.ipcRenderer.invoke("codingAgent:task-history"),
    taskSnapshot: (taskId) => electron.ipcRenderer.invoke("codingAgent:task-snapshot", taskId),
    continueWithSonnet: (taskId) => electron.ipcRenderer.invoke("codingAgent:continue-with-sonnet", taskId),
    openSession: (taskId, target = "desktop") => electron.ipcRenderer.invoke("codingAgent:open-session", taskId, target),
    getBypassPermissions: () => electron.ipcRenderer.invoke("codingAgent:get-bypass-permissions"),
    setBypassPermissions: (enabled) => electron.ipcRenderer.invoke("codingAgent:set-bypass-permissions", enabled),
    acknowledgeOrchestration: (orchestrationId) => electron.ipcRenderer.invoke(
      "codingAgent:acknowledge-orchestration",
      orchestrationId
    ),
    acknowledgeTask: (taskId) => electron.ipcRenderer.invoke("codingAgent:acknowledge-task", taskId),
    // Answers the blocked session's popup from the notch card's buttons.
    // `answered: false` means that ask is no longer pending (already handled
    // by voice, cancelled by the agent, or the card came from history).
    answerPrompt: (taskId, promptId, answer) => electron.ipcRenderer.invoke("codingAgent:answer-prompt", taskId, promptId, answer),
    // Stops a queued or running coding session from the live card's explicit
    // Stop button.
    cancelTask: (taskId) => electron.ipcRenderer.invoke("codingAgent:cancel-task", taskId),
    // Drops one waiting instruction from the composer's queue tray.
    // `removed: false` means it already started (or was drained).
    removeQueuedFollowUp: (taskId, followUpId) => electron.ipcRenderer.invoke(
      "codingAgent:remove-queued-follow-up",
      taskId,
      followUpId
    ),
    // Rewrites one waiting instruction from the composer's queue tray.
    editQueuedFollowUp: (taskId, followUpId, text) => electron.ipcRenderer.invoke(
      "codingAgent:edit-queued-follow-up",
      taskId,
      followUpId,
      text
    ),
    cancelOrchestration: (orchestrationId) => electron.ipcRenderer.invoke("codingAgent:cancel-orchestration", orchestrationId)
  },
  workflows: {
    history: () => electron.ipcRenderer.invoke("workflow:history"),
    acknowledge: (workflowId) => electron.ipcRenderer.invoke("workflow:acknowledge", workflowId),
    select: (workflowId) => electron.ipcRenderer.invoke("workflow:select", workflowId),
    resolveCodeApproval: (workflowId, stepName, approved) => electron.ipcRenderer.invoke(
      "workflow:resolve-code-approval",
      workflowId,
      stepName,
      approved
    ),
    cancel: (workflowId) => electron.ipcRenderer.invoke("workflow:cancel", workflowId)
  },
  appleCalendar: {
    status: () => electron.ipcRenderer.invoke("applecalendar:status"),
    connect: () => electron.ipcRenderer.invoke("applecalendar:connect"),
    disconnect: () => electron.ipcRenderer.invoke("applecalendar:disconnect"),
    calendars: () => electron.ipcRenderer.invoke("applecalendar:calendars"),
    eventPreview: (eventId, calendar) => electron.ipcRenderer.invoke("applecalendar:event-preview", { eventId, calendar })
  },
  appleNotes: {
    status: () => electron.ipcRenderer.invoke("notes:status"),
    connect: () => electron.ipcRenderer.invoke("notes:connect"),
    disconnect: () => electron.ipcRenderer.invoke("notes:disconnect"),
    folders: () => electron.ipcRenderer.invoke("notes:folders"),
    notePreview: (target) => electron.ipcRenderer.invoke("notes:note-preview", target)
  },
  music: {
    playback: (provider) => electron.ipcRenderer.invoke("music:playback", provider),
    control: (request) => electron.ipcRenderer.invoke("music:control", request)
  },
  appleMusic: {
    status: () => electron.ipcRenderer.invoke("apple-music:status"),
    connect: () => electron.ipcRenderer.invoke("apple-music:connect"),
    disconnect: () => electron.ipcRenderer.invoke("apple-music:disconnect")
  },
  spotify: {
    status: () => electron.ipcRenderer.invoke("spotify:status"),
    connect: () => electron.ipcRenderer.invoke("spotify:connect"),
    disconnect: () => electron.ipcRenderer.invoke("spotify:disconnect")
  },
  customMcp: {
    list: () => electron.ipcRenderer.invoke("custom-mcp:list"),
    add: (server) => electron.ipcRenderer.invoke("custom-mcp:add", server),
    update: (payload) => electron.ipcRenderer.invoke("custom-mcp:update", payload),
    remove: (id) => electron.ipcRenderer.invoke("custom-mcp:remove", id),
    toggle: (id, enabled) => electron.ipcRenderer.invoke("custom-mcp:toggle", { id, enabled }),
    refresh: (id) => electron.ipcRenderer.invoke("custom-mcp:refresh", id),
    getTools: (id) => electron.ipcRenderer.invoke("custom-mcp:get-tools", id),
    getLogs: (id) => electron.ipcRenderer.invoke("custom-mcp:logs", id),
    pickScript: () => electron.ipcRenderer.invoke("custom-mcp:pick-script"),
    pickIcon: () => electron.ipcRenderer.invoke("custom-mcp:pick-icon"),
    generate: (prompt) => electron.ipcRenderer.invoke("custom-mcp:generate", { prompt })
  },
  // Integration Studio (AI builder modal). Progress arrives on the
  // IPC_EVENTS.INTEGRATION_STUDIO_EVENT / INTEGRATION_STUDIO_TEST_EVENT
  // channels via window.api.on — every event stamped with the sessionId that
  // produced it, because several sessions can build at once. The modal opens
  // a session first and passes its id on every call after.
  integrationStudio: {
    /** Mint a fresh Studio session; its id rides on every later call. */
    openSession: () => electron.ipcRenderer.invoke("integration-studio:open-session"),
    /**
     * Pre-build plan round: multiple-choice decisions derived from the brief
     * (which service, API key on hand, scope). Empty questions = build
     * directly; `interrupted` marks the failures that must NOT, because a
     * build with no answers is not what the user asked for.
     *
     * Idempotent per brief: asking again for a brief already planned returns
     * the same questions (and the answers so far) from main without a second
     * round, which is what makes closing and reopening the Studio free.
     */
    plan: (payload) => electron.ipcRenderer.invoke("integration-studio:plan", payload),
    /**
     * Mirror the half-answered questionnaire into main as it's filled in, so
     * closing the Studio mid-question loses nothing.
     */
    savePlanSelections: (payload) => electron.ipcRenderer.invoke("integration-studio:plan-selections", payload),
    /**
     * The Studio's Chat tab: one routed turn about the draft. A question
     * comes back answered; a change request comes back `intent: "build"`,
     * and the RENDERER then starts an ordinary build round with the user's
     * words — this call itself never builds, installs or runs anything.
     * Returns the session's full thread (main holds it, so closing the
     * Studio doesn't lose the conversation).
     */
    chat: (payload) => electron.ipcRenderer.invoke("integration-studio:chat", payload),
    generate: (payload) => electron.ipcRenderer.invoke("integration-studio:generate", payload),
    cancel: (payload) => electron.ipcRenderer.invoke("integration-studio:cancel", payload),
    /**
     * Kill and respawn the session's draft server (the logs pane's Restart).
     * Results arrive as events: a log line, then a fresh draft-installed.
     */
    restartServer: (payload) => electron.ipcRenderer.invoke("integration-studio:restart-server", payload),
    /**
     * The draft server's terminal, for Auto-fix: live state + the tail of
     * its captured output (the child's real stderr), formatted for display.
     */
    serverLogs: (payload) => electron.ipcRenderer.invoke("integration-studio:server-logs", payload),
    saveDraft: (payload) => electron.ipcRenderer.invoke("integration-studio:save-draft", payload),
    discardDraft: (payload) => electron.ipcRenderer.invoke("integration-studio:discard-draft", payload),
    /** Every build in flight (or finished awaiting review), for the rows. */
    getRuns: () => electron.ipcRenderer.invoke("integration-studio:get-runs"),
    /**
     * One session's state: its run, plus what a reopening window needs to
     * rebuild its product page. Null run = nothing going on there.
     */
    getSession: (payload) => electron.ipcRenderer.invoke("integration-studio:get-session", payload),
    /**
     * Reopen an installed Studio-generated integration as an editable draft.
     * Returns the AUTHORITATIVE sessionId — if that integration is already
     * being edited in a live session, the caller adopts that one instead.
     */
    startFromInstalled: (payload) => electron.ipcRenderer.invoke("integration-studio:start-from-installed", payload),
    /**
     * Generate (or re-generate with art direction) the session draft's icon
     * via the server's Gemini image endpoint.
     */
    generateIcon: (payload) => electron.ipcRenderer.invoke("integration-studio:generate-icon", payload),
    /** Open the integration folder in an editor / reveal it in Finder. */
    openHandoff: (payload) => electron.ipcRenderer.invoke("integration-studio:open-handoff", payload),
    /** The terminal command that continues this integration in a CLI agent. */
    handoffCommand: (payload) => electron.ipcRenderer.invoke("integration-studio:handoff-command", payload),
    /** Per-action "ask before running" toggle on the session's draft. */
    setToolConfirmation: (payload) => electron.ipcRenderer.invoke("integration-studio:set-tool-confirmation", payload),
    /** Rename the session's draft from the Studio header (display name only). */
    rename: (payload) => electron.ipcRenderer.invoke("integration-studio:rename", payload),
    /**
     * Run a READ-ONLY action against the session's live draft and return its
     * real result card, so the Studio preview shows what ships instead of a
     * hand-written fixture. Acting tools (those with a confirmation) are
     * refused.
     */
    previewTool: (payload) => electron.ipcRenderer.invoke("integration-studio:preview-tool", payload),
    /**
     * Save the draft's setup-field values (API keys, ids) and relaunch it with
     * them. Values go one way only — the response carries the NAMES of fields
     * that now hold a value, never the values themselves.
     */
    setConfigValues: (sessionId, values) => electron.ipcRenderer.invoke("integration-studio:set-config-values", {
      sessionId,
      values
    }),
    getConfigState: (payload) => electron.ipcRenderer.invoke("integration-studio:get-config-state", payload),
    /**
     * Read one saved secret back in plaintext — the show/hide toggle in the
     * setup form, and the only path a stored key takes to the renderer.
     */
    revealConfigSecret: (payload) => electron.ipcRenderer.invoke("integration-studio:reveal-config-secret", payload),
    testSend: (sessionId, utterance) => electron.ipcRenderer.invoke("integration-studio:test-send", {
      sessionId,
      utterance
    }),
    testConfirm: (payload) => electron.ipcRenderer.invoke("integration-studio:test-confirm", payload),
    testCancel: (payload) => electron.ipcRenderer.invoke("integration-studio:test-cancel", payload)
  },
  integrationMarketplace: {
    list: () => electron.ipcRenderer.invoke("marketplace:list"),
    previewInstall: (dirPath) => electron.ipcRenderer.invoke("marketplace:preview-install", { dirPath }),
    connectBundled: (catalogId) => electron.ipcRenderer.invoke("marketplace:connect-bundled", { catalogId }),
    install: (dirPath) => electron.ipcRenderer.invoke("marketplace:install", { dirPath }),
    uninstall: (manifestId) => electron.ipcRenderer.invoke("marketplace:uninstall", { manifestId }),
    setEnabled: (manifestId, enabled) => electron.ipcRenderer.invoke("marketplace:set-enabled", { manifestId, enabled }),
    /** Per-integration hook kill switch (the Setup section's "Transcript access"). */
    setHooksEnabled: (manifestId, enabled) => electron.ipcRenderer.invoke("marketplace:set-hooks-enabled", {
      manifestId,
      enabled
    }),
    setConfigValues: (manifestId, values) => electron.ipcRenderer.invoke("marketplace:set-config-values", {
      manifestId,
      values
    }),
    /** Plaintext of one saved secret, for the setup form's show/hide toggle. */
    revealConfigSecret: (payload) => electron.ipcRenderer.invoke("marketplace:reveal-config-secret", payload),
    refresh: (manifestId) => electron.ipcRenderer.invoke("marketplace:refresh", { manifestId }),
    pickFolder: () => electron.ipcRenderer.invoke("marketplace:pick-folder"),
    create: (payload) => electron.ipcRenderer.invoke(
      "marketplace:create",
      typeof payload === "string" ? { name: payload } : payload
    ),
    openFolder: (manifestId) => electron.ipcRenderer.invoke("marketplace:open-folder", { manifestId }),
    /** Pick an image off disk; resolves with null when the dialog is cancelled. */
    pickIcon: () => electron.ipcRenderer.invoke("integrations:pick-icon"),
    /** Point the integration at a new icon; null clears it. */
    setIcon: (manifestId, iconDataUrl) => electron.ipcRenderer.invoke("marketplace:set-icon", { manifestId, iconDataUrl }),
    /**
     * Re-illustrate an installed integration via the Studio's image endpoint.
     * Only offered for integrations built here.
     */
    generateIcon: (payload) => electron.ipcRenderer.invoke("marketplace:generate-icon", payload)
  },
  /** Share links: publish an installed integration; resolve a pending
   * link-install parked by the voiceos://integration/install deep link. */
  /** Deep-link plumbing. Every window polls this once a second: the native
   * addon buffers voiceos:// URLs (main-side timers stall while the app
   * idles), and this IPC round-trip is what reliably drains them. */
  protocol: {
    drainPendingUrls: () => electron.ipcRenderer.invoke("protocol:drain-pending-urls")
  },
  integrationShare: {
    publish: (manifestId, reviewId) => electron.ipcRenderer.invoke("integration-share:publish", { manifestId, reviewId }),
    /** Step 1: what the package contains. Nothing is uploaded. */
    preview: (manifestId) => electron.ipcRenderer.invoke("integration-share:preview", { manifestId }),
    /** Step 2: upload the package for review (rebuilt in main first). */
    submitReview: (manifestId) => electron.ipcRenderer.invoke("integration-share:submit-review", { manifestId }),
    reviewStatus: (reviewId) => electron.ipcRenderer.invoke("integration-share:review-status", { reviewId }),
    /** Has this account published this integration? (Hydrates legacy shares.) */
    publishState: (manifestId) => electron.ipcRenderer.invoke("integration-share:publish-state", { manifestId }),
    getPending: () => electron.ipcRenderer.invoke("integration-share:pending"),
    clearError: () => electron.ipcRenderer.invoke("integration-share:clear-error"),
    /** Consent sheet cancelled — delete the downloaded folder. */
    discard: () => electron.ipcRenderer.invoke("integration-share:discard"),
    /** Install succeeded — keep the folder, forget the pending state. */
    clear: () => electron.ipcRenderer.invoke("integration-share:clear")
  },
  nativeActions: {
    list: () => electron.ipcRenderer.invoke("native-actions:list"),
    toggle: (id, enabled, options) => electron.ipcRenderer.invoke("native-actions:toggle", {
      id,
      enabled,
      ...options
    })
  },
  // Clipboard access (works even when document is not focused)
  copyToClipboard: (text) => {
    electron.clipboard.writeText(text);
  }
};
Object.assign(console, log__namespace.functions);
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", {
      ...preload.electronAPI,
      store: {
        get(key) {
          return electron.ipcRenderer.sendSync("electron-store-get", key);
        },
        set(property, val) {
          electron.ipcRenderer.send("electron-store-set", property, val);
        }
      }
    });
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = {
    ...preload.electronAPI,
    store: {
      get(key) {
        return electron.ipcRenderer.sendSync("electron-store-get", key);
      },
      set(property, val) {
        electron.ipcRenderer.send("electron-store-set", property, val);
      }
    }
  };
  window.api = api;
}
