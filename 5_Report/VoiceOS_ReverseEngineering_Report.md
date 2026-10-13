# 🔬 VoiceOS — Full Reverse Engineering Report

**Target:** `VoiceOS-Installer.exe` | **Company:** WakoAI Inc. | **Version:** 0.1.38
**SHA256:** `145714A0A46BABBBCF469F4E2D25974ED998C53E2D618DD17AFF359D5F1BEBCB`
**Analyzed:** 2026-10-13

---

## 1. Installer and Packaging Layer

| Property | Value |
|---|---|
| Installer Format | NSIS v3.04 (Nullsoft Install System) |
| Inner Archive | `app-64.7z` (172 MB, LZMA BCJ2 compression) |
| Code Signing | Microsoft ID Verified CS EOC CA (WakoAI Inc.) |
| Update Mechanism | electron-updater → AWS S3 (`voiceos-staging-releases`, `us-east-1`) |
| Update Config | `resources/app-update.yml` — `provider: s3` |

**Extraction path:**
```
VoiceOS-Installer.exe (NSIS)
  └── [embedded] app-64.7z  (7-Zip LZMA)
        └── VoiceOS.exe    (Electron shell, 205 MB)
        └── resources/
              ├── app.asar           <- All JS app code (191 MB)
              └── app.asar.unpacked/ <- Native binaries
```

---

## 2. Application Architecture

```
VoiceOS.exe (Electron)
  ├── Main Process  (out/main/main.js - 4.3 MB)
  │     IPC bridge via preload.js
  ├── Renderer Process (React)
  │     out/renderer/index-BckUsZgJ.js (10.5 MB)
  │     out/renderer/index.html
  │
  ├── Native Sidecar Binaries (resources/binaries/)
  │     microphone-capture.exe     <- Audio input
  │     keyboard-listener.exe      <- Global hotkeys
  │     active-window-listener.exe <- Active app detection
  │     audio-duck.exe             <- Lowers system audio
  │     screen-capture-sidecar.exe <- Screenshot capture
  │     selection-reader.exe       <- Read selected text
  │     text-injector.exe          <- Type text into active window
  │     codex-pipe-relay.exe       <- Relay to Codex/AI agents
  │
  ├── Bun Runtime (resources/bun-runtime/bun.exe)  98 MB
  │
  └── Bundled Integrations (resources/bundled-integrations/)
        manus/server.ts  (1.8 MB TypeScript - Manus AI bridge)
        manus/voiceos.integration.json  (40 KB integration manifest)
```

---

## 3. Technology Stack

### Frontend (Renderer)

| Layer | Technology |
|---|---|
| UI Framework | React (with hooks) |
| Rich Text | TipTap (@tiptap/react + extensions) |
| Markdown | react-markdown + remark-gfm + remark-math + rehype-katex |
| Math | KaTeX |
| Font | Lexend (bundled woff/woff2), Recoleta |
| Analytics | PostHog (key: `phc_w0ppTWhcPq9MGgvDoG9b4bR5TaaigHSOLTZ32WejPT8`) |
| Error tracking | Sentry (`voiceos@0.1.38`, debug ID: `c40846af-cfaa-456f-a09c-8ed964d24dec`) |
| Animations | canvas-confetti |

### Backend / Main Process

| Layer | Technology |
|---|---|
| Framework | Electron (Chromium-based) |
| Runtime | Bun (v-latest bundled, 98 MB) |
| Database | SQLite3 (via node-sqlite3 native module) |
| Store | electron-store (JSON key-value) |
| Auth | Supabase JS SDK v2 |
| IPC | Electron ipcMain/ipcRenderer |
| Logging | electron-log |
| AI Protocols | ConnectRPC (@connectrpc/connect-node) + Protobuf (@bufbuild/protobuf) |
| NLP | compromise (NLP library) |
| PDF | pdf-parse |
| MCP | @modelcontextprotocol/sdk v1.28 |
| WebSocket | ws v8 |
| Zip | fflate |

### Infrastructure

| Service | Detail |
|---|---|
| Auth + DB | Supabase (`bqxtklamhmqgkixvgqhc.supabase.co`) |
| Main API | `https://api.voiceos.com` |
| Delivery/gRPC | `https://api.voiceos.com/delivery` (ConnectRPC / Protobuf) |
| CDN | `https://*.cloudfront.net` |
| S3 Assets | `https://website-assets-video.s3.us-east-1.amazonaws.com` |
| Updates | `s3://voiceos-staging-releases/releases/` |
| Referral | `https://partners.dub.co/voiceos` |
| Docs | `https://docs.voiceos.com` |

---

## 4. Voice Agent System — Is It Fully Downloaded?

**YES — the voice agent is 100% bundled inside the installer.** No lazy downloading occurs.

### Voice Modes (VoiceOSMode enum)

| ID | Mode | Default Shortcut (Win) |
|---|---|---|
| 0 | DICTATE | Ctrl+Win (legacy) |
| 1 | EDIT | — |
| 2 | WRITE | — |
| 3 | AGENT | Ctrl-Left + Option-Left |

### Voice Agent State Machine (AgentStatusType enum)

```
0  AGENT_STATUS_TRANSCRIBING     <- Mic input -> speech-to-text
1  AGENT_STATUS_THINKING         <- LLM processing
2  AGENT_STATUS_TOOL_SEARCH      <- Finding which tool to use
3  AGENT_STATUS_TOOL_EXECUTING   <- Running a tool/integration
4  AGENT_STATUS_TOOL_RESULT      <- Got tool output
5  AGENT_STATUS_TEXT             <- Streaming text response
6  AGENT_STATUS_ERROR            <- Error state
7  AGENT_STATUS_COMPLETE         <- Done
8  AGENT_STATUS_CONFIRM_REQUIRED <- Needs user confirmation
9  AGENT_STATUS_MCP_TOOL_EXECUTE <- MCP protocol tool call
10 AGENT_STATUS_VOICE_CONFIRMATION <- Spoken confirmation requested
11 AGENT_STATUS_KEEPALIVE        <- Connection heartbeat
12 AGENT_STATUS_INTENT_MATCH     <- Matched a voice intent
```

### Audio Pipeline

```
User speaks
    |
microphone-capture.exe   (native Win32 audio capture, PCM)
    | IPC (audio chunks)
Main Process (AudioService)
    | gRPC/ConnectRPC stream
api.voiceos.com/delivery  <- Server-side STT (cloud, NOT on-device)
    | transcription-ready IPC event
Renderer (React UI)       <- Shows transcription + agent response
    |
text-injector.exe         <- Types result into active window
```

> **STT is cloud-side** — audio is streamed from native capture binary to `api.voiceos.com/delivery` via ConnectRPC. The Bun runtime powers integration scripts.

### Key IPC Channels (Electron main <-> renderer)

```
recording-state-update          <- Mic on/off
transcription-processing        <- STT in progress
transcription-raw-ready         <- Raw transcript available
transcription-error             <- STT error
voice-follow-up-user-message    <- Follow-up query
agent-status-update             <- Agent state machine event
agent-notch-turn-started        <- New agent turn
agent-transcript-marked         <- Transcript confirmed
agent-voice-confirmation        <- Agent wants verbal answer
agent-voice-speaking-state      <- TTS playing
agent-complete                  <- Agent finished
agent-error                     <- Agent error
agent-confirm-required          <- Action needs user OK
subscription-event              <- Payment callback
user-auth-update                <- Auth state changed
```

---

## 5. Payment System — Full Reverse Engineering

### Payment Architecture

```
Renderer (React) -> IPC invoke -> Main Process -> REST API -> Stripe (server-side)
```

### Auth and Payment Flow

```
1. User opens app -> Auth via Supabase (OAuth/email)
2. Supabase issues JWT -> stored in electron-store
3. Checkout triggered -> Main calls POST /stripe/create-checkout-session
4. Server returns Stripe checkout URL -> opened in system browser
5. User pays on Stripe -> server webhook fires
6. Stripe redirects to voiceos://subscription-success (deep link)
7. App intercepts deep link -> sends 'subscription-event' IPC to renderer
8. Renderer updates subscription state
```

### REST API Endpoints (Base: `https://api.voiceos.com`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/callback` | OAuth auth callback handling |
| POST | `/stripe/create-checkout-session` | Create Stripe checkout (individual) |
| POST | `/stripe/create-team-checkout-session` | Create Stripe checkout (team) |
| GET | `/stripe/payment-method` | Get current payment method |
| GET | `/stripe/payment-methods` | List all payment methods |
| POST | `/stripe/payment-methods/default` | Set default payment method |
| POST | `/stripe/payment-methods/detach` | Remove a payment method |
| POST | `/stripe/payment-method/setup-intent` | Create setup intent (add card) |
| POST | `/stripe/payment-method/default` | Update default method |
| POST | `/stripe/trial/change-plan` | Switch plan during trial |
| POST | `/stripe/subscription/change-plan` | Upgrade/downgrade plan |
| POST | `/stripe/subscription/cancel` | Cancel subscription |
| GET | `/team-subscription/status` | Get team subscription info |
| GET | `/team-subscription/link` | Get team invite link |
| GET | `/integrations/chatgpt/selectors` | ChatGPT config from server |

### Checkout Session Request Body

```json
{
  "billingInterval": "yearly | monthly",
  "defaultLanguage": "en",
  "checkoutAttemptId": "<uuid>",
  "dubClickId": "<tracking_id>",
  "attribution": {},
  "promo": "<promo_code>",
  "promotionCode": "<stripe_promo_code>"
}
```

Auth header: `Authorization: Bearer <supabase_jwt_access_token>`

### Deep Link Callbacks (protocol: `voiceos://`)

| URL | Trigger |
|---|---|
| `voiceos://subscription-success` | Individual plan purchased |
| `voiceos://subscription-updated` | Plan changed |
| `voiceos://subscription-canceled` | Plan canceled |
| `voiceos://team-subscription-success` | Team plan purchased |
| `voiceos://auth/callback?...` | OAuth login complete |

### Subscription Plans and Plan Types

```javascript
// Plan type string patterns (server-side)
"free"          -> Free tier
"pro_monthly"   -> Pro, monthly billing
"pro_yearly"    -> Pro, annual billing
"pro_trial"     -> Pro trial
"pro_referral"  -> Referral-based Pro
"team_monthly"  -> Team plan, monthly
"team_yearly"   -> Team plan, annual

// Access level logic:
getSubscriptionAccessType(planType) {
  if (isTeamPlan)     -> "team"
  if (isTrialPlan)    -> "trial"
  if (isReferralPlan) -> "referral"
  if (includes "pro") -> "pro"
  default             -> "free"
}
```

### Subscription Analytics Events (PostHog)

```
subscription_checkout_started
subscription_checkout_opened
subscription_checkout_failed
subscription_checkout_browser_handoff
```

---

## 6. Auth System (Supabase)

| Property | Value |
|---|---|
| Supabase URL | `https://bqxtklamhmqgkixvgqhc.supabase.co` |
| Project Ref | `bqxtklamhmqgkixvgqhc` |
| Anon Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbGFtaG1xZ2tpeHZncWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMjY5NTgsImV4cCI6MjA3NTgwMjk1OH0.8Q7ONaJydNvcN58nx-MjN6YNwM2en-8cK76nrtn5MBg` |
| Storage Key | `supabase.sb-bqxtklamhmqgkixvgqhc-auth-token` |
| Store | electron-store (encrypted local JSON) |

**Auth Flow:**
1. `generateNewAuthState()` IPC call generates PKCE code verifier
2. Opens `https://wako.ai` OAuth URL in system browser
3. Browser redirects to `voiceos://auth/callback?code=...&access_token=...`
4. App intercepts deep link, exchanges code via `exchangeAuthCode()`
5. Stores `access_token` and `refresh_token` in electron-store
6. Token refresh: auto-refresh with `pendingRefresh` guard (prevents race conditions)

---

## 7. AI Integrations

| Integration | Type | Notes |
|---|---|---|
| Claude Code (Anthropic) | Native desktop app | Spawns `claude --desktop --resume` via PowerShell; models: Opus, Sonnet, Haiku, Fable |
| OpenAI Codex | AppX package | `OpenAI.Codex` Windows Store app, located via `Get-AppxPackage` |
| Manus AI | Bundled server | `server.ts` (1.8 MB) runs on Bun runtime; credit-based system |
| ChatGPT | Web automation | Selectors config from `api.voiceos.com/integrations/chatgpt/selectors` |
| MCP (Model Context Protocol) | Protocol layer | `@modelcontextprotocol/sdk v1.28` — connects to external MCP servers |

---

## 8. Local Storage Schema

```
electron-store keys (STORE_KEYS):
  ACCESS_TOKEN              <- Supabase JWT access token
  SETTINGS                  <- User settings (defaultLanguage, etc.)
  CHATGPT_SELECTOR_CONFIG   <- ChatGPT DOM selectors (server-synced)
  PENDING_DUB_CLICK_ID      <- Marketing attribution
  PENDING_ATTRIBUTION       <- UTM attribution data
  PENDING_REFERRAL_CODE     <- Referral code
  supabase.sb-*-auth-token  <- Full Supabase session JSON

SQLite3 (node_sqlite3.node) local database:
  - Agent history / conversation log
  - Task history
  - Dictionary / custom words
```

---

## 9. Clone — Exact Tech Stack to Replicate

### Project Structure

```
voiceos-clone/
├── electron.vite.config.ts
├── package.json
├── src/
│   ├── main/
│   │   ├── main.ts               <- App entry, window creation, deep links
│   │   ├── audioService.ts       <- Spawn microphone-capture binary + IPC
│   │   ├── agentService.ts       <- gRPC stream to STT backend
│   │   ├── authService.ts        <- Supabase auth, token refresh
│   │   ├── paymentService.ts     <- Stripe IPC handlers
│   │   ├── ipcEvents.ts          <- All IPC channel constants
│   │   ├── store.ts              <- electron-store wrapper
│   │   ├── nativeBinaries.ts     <- Spawn keyboard-listener, text-injector, etc.
│   │   └── protobuf/             <- .proto files for delivery service
│   ├── preload/
│   │   └── preload.ts            <- contextBridge IPC API
│   └── renderer/
│       ├── App.tsx
│       ├── components/
│       │   ├── Notch/            <- Floating pill UI
│       │   ├── AgentPanel/       <- Agent conversation UI
│       │   ├── SubscriptionModal/ <- Payment checkout UI
│       │   ├── Settings/
│       │   └── Onboarding/
│       ├── hooks/
│       │   ├── useVoiceAgent.ts  <- Agent state machine
│       │   ├── useSubscription.ts
│       │   └── useAuth.ts
│       └── store/
├── resources/
│   ├── binaries/                 <- Native sidecar .exe files
│   └── bun-runtime/              <- bun.exe
└── electron-builder.yml          <- NSIS packaging config
```

### Key Dependencies

```json
{
  "electron": "latest",
  "electron-builder": "latest",
  "@supabase/supabase-js": "^2.75.0",
  "@modelcontextprotocol/sdk": "^1.28.0",
  "@bufbuild/protobuf": "^2.6.0",
  "@connectrpc/connect-node": "^2.0.2",
  "sqlite3": "^5.1.7",
  "electron-store": "^8.1.0",
  "electron-updater": "^6.6.2",
  "electron-log": "^5.4.1",
  "ws": "^8.18.0",
  "zod": "^3.25.0",
  "react": "^19.0.0",
  "@tiptap/react": "^3.20.5",
  "posthog-node": "^5.52.1",
  "compromise": "^14.14.4"
}
```

### What You Need to Build on Your Own Server

```
Backend server (Node.js/Bun/Go) must implement:
  POST /auth/callback            <- OAuth token exchange
  POST /stripe/create-checkout-session
  POST /stripe/create-team-checkout-session
  GET  /stripe/payment-method
  GET  /stripe/payment-methods
  POST /stripe/payment-methods/default
  POST /stripe/payment-methods/detach
  POST /stripe/payment-method/setup-intent
  POST /stripe/trial/change-plan
  POST /stripe/subscription/change-plan
  POST /stripe/subscription/cancel
  GET  /team-subscription/status
  GET  /team-subscription/link

  gRPC/ConnectRPC service at /delivery:
    StreamVoice(audio chunks) -> AgentStatusUpdate stream
    (Implement with Whisper/Deepgram for STT + LLM of choice)
```

---

## 10. Key Findings Summary

> [!IMPORTANT]
> **Voice agent is 100% BUNDLED.** All binaries, Bun runtime, and Manus server (1.8 MB TypeScript) are inside the installer. Nothing is lazily downloaded.

> [!WARNING]
> **Cloud transcription.** Speech-to-text runs SERVER-SIDE at `api.voiceos.com/delivery` via ConnectRPC streaming. For a clone you need your own STT backend (Whisper, Deepgram, AssemblyAI, etc.).

> [!NOTE]
> **Payment is fully server-proxied Stripe.** The client never calls Stripe directly — all payment calls go through `api.voiceos.com/stripe/*`. You need a backend that wraps the Stripe Node SDK.

> [!NOTE]
> **Supabase anon key is embedded** — this is standard Supabase practice (it's public by design). RLS on Supabase enforces data access. Row-level security protects user data.

---

## 11. Extracted Files Location

| File | Path |
|---|---|
| ASAR source root | `C:\Users\pali\Downloads\VoiceOS_Source\` |
| Main process JS | `C:\Users\pali\Downloads\VoiceOS_Source\out\main\main.js` |
| Renderer JS | `C:\Users\pali\Downloads\VoiceOS_Source\out\renderer\assets\index-BckUsZgJ.js` |
| IPC bridge | `C:\Users\pali\Downloads\VoiceOS_Source\out\preload\preload.js` |
| App archive | `C:\Users\pali\Downloads\VoiceOS_Extracted\app-64.7z` |
