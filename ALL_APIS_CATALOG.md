# 🌐 VoiceOS — Complete API Catalog & Endpoints Reference

> **Target:** VoiceOS v0.1.38 (WakoAI Inc.)  
> **Source Directory:** `C:\Users\pali\Downloads\VoiceOS_ReverseEngineered\`  
> **Generated:** Complete reverse-engineered catalog of all Cloud APIs, Local IPC APIs, Database Protocols, and Hardware Hooks.

---

## 📑 Table of Contents
1. [Cloud REST & Delivery APIs (api.voiceos.com)](#1-cloud-rest--delivery-apis)
2. [Stripe Payment & Subscription APIs](#2-stripe-payment--subscription-apis)
3. [Supabase Auth & Database APIs](#3-supabase-auth--database-apis)
4. [Deep Link Protocol APIs (voiceos://)](#4-deep-link-protocol-apis)
5. [Local Hardware & Native Binary APIs](#5-local-hardware--native-binary-apis)
6. [Electron IPC Invocation APIs (380+ Methods)](#6-electron-ipc-invocation-apis)
7. [Electron IPC Push / Event Channels](#7-electron-ipc-push--event-channels)
8. [Local SQLite3 Database Schema & Storage APIs](#8-local-sqlite3-database-schema)

---

## 1. Cloud REST & Delivery APIs

Base URL: `https://api.voiceos.com`

| Endpoint | Method | Protocol | Description |
| :--- | :---: | :---: | :--- |
| `/delivery` | POST / Stream | **ConnectRPC / Protobuf** | **Main Speech-to-Text & AI Agent streaming server.** Audio chunks (PCM) stream up; transcripts & agent actions stream down. |
| `/integrations/chatgpt/selectors` | GET | REST / JSON | Fetches real-time DOM selectors for web ChatGPT integration. |
| `/telemetry` | POST | REST / JSON | Telemetry & error monitoring log collector. |
| `/auth/callback` | POST | REST / JSON | OAuth verification and session exchange bridge. |

---

## 2. Stripe Payment & Subscription APIs

All payments are server-proxied through `api.voiceos.com/stripe/*` (no client-side Stripe secret key).

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `POST` | `/stripe/create-checkout-session` | Initiates individual Stripe Checkout session (Monthly / Annual) |
| `POST` | `/stripe/create-team-checkout-session` | Initiates multi-seat Team plan Stripe Checkout |
| `GET` | `/stripe/payment-method` | Retrieves customer's current default card / payment method |
| `GET` | `/stripe/payment-methods` | Lists all saved credit cards / payment methods |
| `POST` | `/stripe/payment-methods/default` | Sets a specific saved card as default |
| `POST` | `/stripe/payment-methods/detach` | Removes / deletes a saved card |
| `POST` | `/stripe/payment-method/setup-intent` | Creates a Stripe SetupIntent to add a new card without immediate charge |
| `POST` | `/stripe/trial/change-plan` | Switches plan tier while still inside trial period |
| `POST` | `/stripe/subscription/change-plan` | Upgrades or downgrades existing active subscription |
| `POST` | `/stripe/subscription/cancel` | Cancels subscription (at period end) |
| `GET` | `/team-subscription/status` | Checks team license count, active members, and owner status |
| `GET` | `/team-subscription/link` | Generates team join invite link |

---

## 3. Supabase Auth & Database APIs

Project Ref: `bqxtklamhmqgkixvgqhc`  
Base URL: `https://bqxtklamhmqgkixvgqhc.supabase.co`  
Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbGFtaG1xZ2tpeHZncWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMjY5NTgsImV4cCI6MjA3NTgwMjk1OH0.8Q7ONaJydNvcN58nx-MjN6YNwM2en-8cK76nrtn5MBg`

### Authentication Endpoints (GoTrue)
* `POST /auth/v1/signup` — Create account with email & password
* `POST /auth/v1/token?grant_type=password` — Login with email/password
* `POST /auth/v1/token?grant_type=refresh_token` — Exchange refresh token for new access JWT
* `GET /auth/v1/authorize?provider=google` — Google OAuth flow initiation
* `POST /auth/v1/logout` — Invalidate user session
* `GET /auth/v1/user` — Fetch user identity profile

### Database Tables (PostgREST)
* `GET / POST / PATCH /rest/v1/user_profiles` — Profile name, avatar, preferred settings
* `GET / POST /rest/v1/voice_sessions` — Remote sync of voice transcription metadata
* `GET / POST /rest/v1/agent_knowledge` — Synced user memory, notes, custom vocabulary
* `GET /rest/v1/integrations` — Available user integrations catalog
* `wss://bqxtklamhmqgkixvgqhc.supabase.co/realtime/v1/websocket` — Realtime change notifications

---

## 4. Deep Link Protocol APIs (`voiceos://`)

Handled in `out/main/main.js` via Windows protocol registration:

| Protocol URL | Handled Action |
| :--- | :--- |
| `voiceos://auth/callback?code=...` | Intercepts OAuth code return and finishes login |
| `voiceos://subscription-success` | Triggers checkout completion UI state |
| `voiceos://subscription-updated` | Refreshes user plan tier in UI |
| `voiceos://subscription-canceled` | Updates UI to show canceled / downgraded state |
| `voiceos://team-subscription-success` | Unlocks team features |

---

## 5. Local Hardware & Native Binary APIs

Located in: `Desktop_App_Portable/resources/binaries/`

| Binary Executable | API / Communication | Responsibility |
| :--- | :---: | :--- |
| `microphone-capture.exe` | Stdio / PCM stream | Windows WASAPI high-performance 48kHz audio capture |
| `keyboard-listener.exe` | Stdio IPC JSON | Global low-level keyboard hook (detects Left-Ctrl, Left-Alt, Left-Shift chords) |
| `text-injector.exe` | Windows Win32 API | Injects/types transcribed text into whatever window has keyboard focus |
| `active-window-listener.exe`| Win32 hooks | Detects active application (Chrome, VS Code, Slack, Word) for contextual awareness |
| `screen-capture-sidecar.exe`| Win32 DXGI | Fast desktop screenshot capture for vision models |
| `selection-reader.exe` | Win32 clipboard | Reads currently highlighted/selected text in active app |
| `audio-duck.exe` | WASAPI Session | Lowers volume of background music/video while user is speaking |
| `codex-pipe-relay.exe` | Named pipes | Local bridge to OpenAI Codex AppX application |

---

## 6. Electron IPC Invocation APIs (380+ Methods)

Called via `electron.ipcRenderer.invoke(channel, ...args)` from the React UI to Node.js Main process:

### 🎙️ Audio & Voice Recording
* `start-native-recording` — Begins mic capture
* `stop-native-recording` — Ends capture and triggers transcription
* `get-native-audio-devices` — Enumerates microphones
* `get-native-audio-devices-with-info` — Detailed device sample rates & formats
* `get-default-microphone-name` — Finds system default mic
* `cancel-transcription` — Aborts active transcription job
* `audio-backend:set-backend` — Selects WASAPI vs Fallback audio driver

### 🤖 Agent & AI Modes
* `agent:submit-text` — Sends typed prompt to AI agent
* `agent:cancel-run` — Cancels ongoing AI execution
* `agent:confirm-action` — Approves pending tool execution
* `agent:reject-action` — Rejects tool execution
* `agent:get-status` — Queries current agent state machine
* `agent:get-conversation` — Fetches current turn transcript
* `agent-knowledge:list` — Retrieves saved memory/knowledge
* `agent-knowledge:save` — Adds new long-term user memory
* `agent-knowledge:delete` — Deletes knowledge item

### 💻 Coding Agent & Local Tools
* `codingAgent:start` — Launches local code generation session
* `codingAgent:cancel` — Stops coding task
* `codingAgent:send-message` — Feeds prompt into coding agent
* `codingAgent:apply-diff` — Applies file modifications to disk
* `codingAgent:get-models` — Lists available AI models (Opus, Sonnet, Haiku)

### 🔌 Model Context Protocol (MCP) & Integrations
* `custom-mcp:list` — Lists all registered local & remote MCP servers
* `custom-mcp:add` — Registers new MCP server (`server.ts` or HTTP URL)
* `custom-mcp:remove` — Unregisters MCP server
* `custom-mcp:test-connection` — Pings MCP server over stdio / SSE
* `integration-studio:scaffold` — Generates boilerplate for new voice tool
* `integration-studio:verify` — Runs `bun verify.ts` tests on local integration
* `integration-studio:install` — Enables local integration in VoiceOS

### 💳 Subscription & Billing
* `subscription:get-status` — Fetches current subscription plan & limits
* `subscription:create-checkout` — Initiates Stripe checkout
* `subscription:cancel` — Requests cancellation
* `subscription:change-plan` — Updates tier (monthly ↔ annual)
* `subscription:get-portal-url` — Opens Stripe Customer Portal

### ⚙️ Settings, Dictionary & Storage
* `settings:get` — Retrieves all user settings
* `settings:set` — Saves preference updates
* `dictionary:list` — Lists custom spelled words / acronyms
* `dictionary:add` — Adds custom word for speech bias
* `dictionary:remove` — Deletes custom word
* `notes:list` — Retrieves saved voice memos
* `notes:save` — Creates/edits voice memo
* `notes:delete` — Deletes voice memo

### 🪟 Window & UI Controls
* `pill:set-bounds` — Moves the floating dictation pill
* `pill:set-visible` — Shows/hides floating pill
* `agent-notch:expand` — Expands notch panel
* `agent-notch:collapse` — Minimizes notch panel
* `window:close` — Closes window
* `window:minimize` — Minimizes to system tray
* `window:toggle-maximize` — Maximizes/restores dashboard

---

## 7. Electron IPC Push / Event Channels

Emitted by Main process, listened to by Renderer via `ipcRenderer.on(channel, callback)`:

| Channel Name | Payload | Event Description |
| :--- | :---: | :--- |
| `recording-state-update` | `{ isRecording, mode }` | Fired when microphone starts or stops |
| `volume-update` | `number (0.0 - 1.0)` | Real-time audio waveform volume levels |
| `transcription-processing`| `{}` | Audio uploaded; waiting for transcription |
| `transcription-raw-ready` | `{ text, isFinal }` | Live partial / streaming transcript |
| `agent-status-update` | `{ status, message }` | Agent state transition (Thinking, Tool, Text, etc.) |
| `key-event` | `{ chord, eventType }` | Global hotkey pressed/released |
| `native-binary-error` | `{ binary, error }` | Helper process crash or error |
| `subscription-event` | `{ plan, active }` | Stripe payment completed notification |
| `user-auth-update` | `{ user, session }` | Supabase login / logout event |
| `update-available` | `{ version, notes }` | New version detected on AWS S3 |
| `update-download-progress`| `{ percent }` | Auto-updater download percentage |

---

## 8. Local SQLite3 Database Schema

Managed by `node_sqlite3.node` at `%APPDATA%\VoiceOS\storage.db`:

```sql
-- Conversations & Dictations
CREATE TABLE voice_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    created_at INTEGER,
    duration_ms INTEGER,
    raw_transcript TEXT,
    polished_transcript TEXT,
    mode INTEGER -- 0: Dictate, 1: Edit, 2: Write, 3: Agent
);

-- Agent Action Log
CREATE TABLE agent_turns (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES voice_sessions(id),
    prompt TEXT,
    tool_name TEXT,
    tool_input TEXT,
    tool_result TEXT,
    response_text TEXT,
    status INTEGER
);

-- Custom Vocabulary (ASR Biasing)
CREATE TABLE custom_dictionary (
    id TEXT PRIMARY KEY,
    word TEXT UNIQUE,
    pronunciation TEXT,
    created_at INTEGER
);

-- Saved Voice Notes
CREATE TABLE user_notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    body_markdown TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
```

---



1. **Audio Streaming:** Audio is recorded locally via `microphone-capture.exe` and sent to `https://api.voiceos.com/delivery` via ConnectRPC Protobuf.
2. **AI Execution:** Uses standard MCP (Model Context Protocol). You can point local tools to any stdio or remote MCP server.
3. **Payments:** Can be easily bypassed locally by modifying `subscription:get-status` to return `{ plan: "pro_yearly", active: true }`.
4. **Auth:** Uses standard Supabase OAuth PKCE flow.

