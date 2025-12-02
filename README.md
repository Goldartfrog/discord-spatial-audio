# SpatialVoice

Distance-based volume control for Discord voice channels.

## How it works

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │
│  canvas.html    │──────►│  server.js      │──────►│  Discord Plugin │
│  (drag around)  │  ws   │  (syncs pos)    │  ws   │  (sets volume)  │
│                 │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. Open `canvas.html` in a browser
2. Enter your Discord user ID and name
3. The plugin (running in Discord) receives positions and adjusts volumes

## Setup

### 1. Run the server

```bash
npm install ws
node server.js
```

### 2. Install the plugin

Copy `index.tsx` to your Vencord userplugins folder:

```
Vencord/src/userplugins/spatialVoice/index.tsx
```

Build and restart Discord:

```bash
cd Vencord
pnpm build
```

Enable "SpatialVoice" in Vencord settings.

### 3. Open the canvas

Open `canvas.html` in your browser. Enter:
- Your name
- Your Discord user ID (enable Developer Mode, right-click yourself, Copy User ID)
- Server URL (default: ws://localhost:8080)

Click Connect and drag yourself around!

## Files

- `index.tsx` - Vencord plugin (runs in Discord)
- `server.js` - WebSocket server (syncs positions)
- `canvas.html` - Web UI (drag to move)

## TODO

- [ ] Save/restore original volume levels
- [ ] Configurable max distance
- [ ] Configurable server URL in plugin settings
- [ ] Handle reconnection gracefully
