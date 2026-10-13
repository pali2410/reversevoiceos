!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "voiceos@0.1.38" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "0e4b8346-0c26-4913-ae11-f83fd4acfa00", e._sentryDebugIdIdentifier = "sentry-dbid-0e4b8346-0c26-4913-ae11-f83fd4acfa00");
  } catch (e2) {
  }
})();
function getInstallerLocale(languages) {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (base === "en" || base === "ja") return base;
  }
  return "en";
}
const installerCopy = {
  en: {
    title: "Install VoiceOS",
    heading: "To install, <em>drag</em> VoiceOS<br />to Applications",
    applications: "Applications",
    move: "Move VoiceOS to Applications",
    destination: "Applications: move VoiceOS here"
  },
  ja: {
    title: "VoiceOSをインストール",
    heading: "VoiceOSを「アプリケーション」へ<br /><em>ドラッグ</em>してインストール",
    applications: "アプリケーション",
    move: "VoiceOSをアプリケーションに移動",
    destination: "アプリケーション：VoiceOSをここに移動"
  }
};
const appItem = document.querySelector(".app-item");
const folderItem = document.querySelector(".folder-item");
const requestedLocale = new URLSearchParams(window.location.search).get("lang");
const locale = getInstallerLocale(
  requestedLocale ? [requestedLocale] : navigator.languages
);
const copy = installerCopy[locale];
document.documentElement.lang = locale;
document.title = copy.title;
const heading = document.querySelector("#instruction");
if (heading) heading.innerHTML = copy.heading;
const folderLabel = folderItem?.querySelector(".item-label");
if (folderLabel) folderLabel.textContent = copy.applications;
appItem?.setAttribute("aria-label", copy.move);
folderItem?.setAttribute("aria-label", copy.destination);
const dragType = "application/x-voiceos-install";
let draggingVoiceOS = false;
function install() {
  window.location.href = "voiceos-install://move";
}
function resetDrag() {
  draggingVoiceOS = false;
  folderItem?.classList.remove("drop-ready");
}
appItem?.addEventListener("dragstart", (event) => {
  if (!event.dataTransfer) return;
  draggingVoiceOS = true;
  event.dataTransfer.setData(dragType, "VoiceOS");
  event.dataTransfer.effectAllowed = "move";
});
appItem?.addEventListener("dragend", resetDrag);
folderItem?.addEventListener("dragover", (event) => {
  if (!draggingVoiceOS || !event.dataTransfer?.types.includes(dragType)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  folderItem.classList.add("drop-ready");
});
folderItem?.addEventListener("dragleave", (event) => {
  if (event.relatedTarget instanceof Node && folderItem.contains(event.relatedTarget))
    return;
  folderItem.classList.remove("drop-ready");
});
folderItem?.addEventListener("drop", (event) => {
  event.preventDefault();
  const isApp = draggingVoiceOS && event.dataTransfer?.getData(dragType) === "VoiceOS";
  resetDrag();
  if (isApp) install();
});
for (const item of [appItem, folderItem]) {
  item?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    install();
  });
}
