# Discord Spatial Audio

Distance-based volume control for Discord voice channels. Users position themselves on a 2D canvas, and their volumes adjust based on proximity to you.

## How It Works

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Canvas UI      │       │  Server         │       │  Discord Plugin │
│  (webpage)      │◄─────►│  (WebSocket)    │◄─────►│  (Vencord)      │
│                 │       │                 │       │                 │
│  Drag to move   │       │  Syncs positions│       │  Sets volume    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

- **Canvas UI**: Drag your avatar to change position
- **Server**: Broadcasts everyone's positions to all clients  
- **Plugin**: Receives positions, calculates distance, calls Discord's `setLocalVolume()`

## Installation (Windows)

### One-Click Install

1. Open PowerShell
2. Run:
   ```powershell
   irm https://raw.githubusercontent.com/Goldartfrog/discord-spatial-audio/main/install.ps1 | iex
   ```

This will:
- Clone Vencord
- Install the SpatialVoice plugin
- Build and inject Vencord into Discord
- Download the proxy server

### Manual Install

1. Clone Vencord from source:
   ```bash
   git clone https://github.com/Vendicated/Vencord.git
   cd Vencord
   ```

2. Create the plugin folder:
   ```bash
   mkdir -p src/userplugins/spatialVoice
   ```

3. Download `index.tsx` into that folder

4. Build and inject:
   ```bash
   pnpm install
   pnpm build
   pnpm inject
   ```

5. Enable "SpatialVoice" in Discord: Settings → Vencord → Plugins

## Usage

1. **Start the proxy server** (connects your Discord to the main server):
   ```powershell
   .\run-proxy.ps1
   ```
   Or:
   ```bash
   node proxy-server.js
   ```

2. **Open the canvas UI**: [Canvas Link Here]

3. **Enter your info**:
   - Your name
   - Your Discord User ID (right-click yourself → Copy User ID)

4. **Join a voice channel** in Discord

5. **Drag yourself around** on the canvas — other users' volumes will change based on distance!

## Files

| File | Description |
|------|-------------|
| `index.tsx` | Vencord plugin (runs inside Discord) |
| `proxy-server.js` | Local proxy to bypass Discord's CSP |
| `server.js` | Main position sync server |
| `canvas.html` | Web UI for positioning |
| `install.ps1` | Windows installer script |
| `run-proxy.ps1` | Starts the proxy server |

## Configuration

The plugin connects to `ws://127.0.0.1:8080` by default (the local proxy).

The proxy connects to the main server at `ws://216.15.14.234:34197`.

To change these, edit:
- `index.tsx` line 55: `serverUrl`
- `proxy-server.js` line 4: `REMOTE_URL`

## How Volume Scaling Works

| Distance (pixels) | Volume |
|-------------------|--------|
| 0 | 100% |
| 100 | 67% |
| 200 | 33% |
| 300+ | 0% |

## Troubleshooting

### Plugin not loading
- Make sure you built Vencord: `pnpm build`
- Restart Discord: Ctrl+R
- Check Settings → Vencord → Plugins for "SpatialVoice"

### Can't connect to server
- Make sure the proxy is running: `node proxy-server.js`
- Check that port 8080 is free: `netstat -an | findstr 8080`

### Volume not changing
- Open Discord DevTools (Ctrl+Shift+I)
- Check console for `[SpatialVoice]` messages
- Make sure you entered your real Discord User ID in the canvas

## TODO

- [ ] Save/restore original volume levels
- [ ] Configurable max distance  
- [ ] Plugin settings UI
- [ ] Auto-reconnect on disconnect

## License

MIT
