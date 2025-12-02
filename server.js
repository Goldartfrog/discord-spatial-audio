const WebSocket = require("ws");

const PORT = process.env.PORT || 34197;
const wss = new WebSocket.Server({ 
    port: PORT,
    host: '216.15.14.234'
});

// Store positions per channel: { channelId: { visibleId: { visibleId, odId?, x, y } } }
const channelPositions = {};

// Map visibleId -> { odId, channelId } (when plugin registers)
const userInfo = {};

// Track ws -> visibleId
const wsToUser = new Map();

// All connected clients with their channel
const clients = new Map(); // ws -> { visibleId, channelId }

console.log(`[SpatialVoice Server] Running on ws://localhost:${PORT}`);

function getChannelPositions(channelId) {
    if (!channelPositions[channelId]) {
        channelPositions[channelId] = {};
    }
    return channelPositions[channelId];
}

function broadcastToChannel(channelId) {
    const positions = getChannelPositions(channelId);
    const message = JSON.stringify({ type: "positions", positions });
    
    for (const [ws, info] of clients) {
        if (info.channelId === channelId && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}

wss.on("connection", (ws) => {
    console.log(`[Server] Client connected`);

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === "register") {
                // Plugin registering with Discord ID, username, and channel
                const { odId, visibleId, channelId } = message;
                
                // Store user info
                userInfo[visibleId] = { odId, channelId };
                wsToUser.set(ws, visibleId);
                clients.set(ws, { visibleId, channelId });
                
                console.log(`[Server] Registered: ${visibleId} (${odId}) in channel ${channelId}`);
                
                // If we already have a position for this user, update it with odId and move to correct channel
                const positions = getChannelPositions(channelId);
                if (positions[visibleId]) {
                    positions[visibleId].odId = odId;
                }
                
                // Send current positions in this channel to the new client
                ws.send(JSON.stringify({ type: "positions", positions }));
                
                // Broadcast to others in this channel
                broadcastToChannel(channelId);
            }
            else if (message.type === "updatePosition") {
                const { visibleId, x, y } = message;
                
                // Find which channel this user is in
                let channelId = userInfo[visibleId]?.channelId;
                
                // If not registered yet via plugin, check if they're in clients map
                const existingInfo = clients.get(ws);
                if (!channelId && existingInfo) {
                    channelId = existingInfo.channelId;
                }
                
                // If still no channel, they need to be in the same channel as someone with that username
                if (!channelId) {
                    // Default to a "lobby" channel for canvas-only users
                    // They'll be matched when a plugin user with same username registers
                    channelId = "lobby";
                }
                
                wsToUser.set(ws, visibleId);
                clients.set(ws, { visibleId, channelId });
                
                // Get or create positions for this channel
                const positions = getChannelPositions(channelId);
                
                // Store position
                positions[visibleId] = {
                    visibleId,
                    odId: userInfo[visibleId]?.odId || null,
                    x,
                    y
                };

                console.log(`[Server] ${visibleId} in ${channelId} -> (${Math.round(x)}, ${Math.round(y)})`);

                broadcastToChannel(channelId);
            }
        } catch (e) {
            console.error("[Server] Bad message:", e);
        }
    });

    ws.on("close", () => {
        const visibleId = wsToUser.get(ws);
        const info = clients.get(ws);
        
        if (visibleId && info) {
            const channelId = info.channelId;
            const positions = getChannelPositions(channelId);
            
            delete positions[visibleId];
            delete userInfo[visibleId];
            wsToUser.delete(ws);
            clients.delete(ws);
            
            console.log(`[Server] ${visibleId} disconnected from ${channelId}`);
            
            broadcastToChannel(channelId);
        } else {
            clients.delete(ws);
            console.log(`[Server] Client disconnected`);
        }
    });
});

console.log(`[Server] Ready`);
