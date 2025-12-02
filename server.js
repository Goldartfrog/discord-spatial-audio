const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 34197;
const HTML_FILE = path.join(__dirname, "canvas.html");

// Create HTTP server to serve canvas.html
const server = http.createServer((req, res) => {
    fs.readFile(HTML_FILE, (err, data) => {
        if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error loading canvas.html");
            return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
    });
});

// Attach WebSocket to the HTTP server
const wss = new WebSocket.Server({ server });

// Store positions per channel: { channelId: { visibleId: { visibleId, odId?, x, y } } }
const channelPositions = {};

// Map visibleId -> { odId, channelId } (when plugin registers)
const userInfo = {};

// Track ws -> visibleId
const wsToUser = new Map();

// All connected clients with their channel
const clients = new Map(); // ws -> { visibleId, channelId }

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
                
                // Check if this user was already in a different channel (like "lobby")
                const oldInfo = userInfo[visibleId];
                if (oldInfo && oldInfo.channelId !== channelId) {
                    // Move their position from old channel to new channel
                    const oldPositions = getChannelPositions(oldInfo.channelId);
                    const newPositions = getChannelPositions(channelId);
                    
                    if (oldPositions[visibleId]) {
                        newPositions[visibleId] = oldPositions[visibleId];
                        newPositions[visibleId].odId = odId;
                        delete oldPositions[visibleId];
                        
                        // Broadcast to old channel that user left
                        broadcastToChannel(oldInfo.channelId);
                    }
                }
                
                // Store user info
                userInfo[visibleId] = { odId, channelId };
                wsToUser.set(ws, visibleId);
                clients.set(ws, { visibleId, channelId });
                
                // Also update any other WebSocket connections for this user (canvas)
                for (const [clientWs, clientInfo] of clients) {
                    if (clientInfo.visibleId === visibleId && clientWs !== ws) {
                        clients.set(clientWs, { visibleId, channelId });
                    }
                }
                
                console.log(`[Server] Registered: ${visibleId} (${odId}) in channel ${channelId}`);
                
                // Update position with odId if it exists
                const positions = getChannelPositions(channelId);
                if (positions[visibleId]) {
                    positions[visibleId].odId = odId;
                }
                
                // Send current positions in this channel to the new client
                ws.send(JSON.stringify({ type: "positions", positions }));
                
                // Broadcast to everyone in this channel
                broadcastToChannel(channelId);
            }
            else if (message.type === "updatePosition") {
                const { visibleId, x, y } = message;
                
                // Find which channel this user should be in
                let channelId = userInfo[visibleId]?.channelId;
                
                // If not registered yet via plugin, check existing client info
                const existingInfo = clients.get(ws);
                if (existingInfo && existingInfo.channelId && existingInfo.channelId !== "lobby") {
                    channelId = existingInfo.channelId;
                }
                
                // If still no channel, use lobby (will be moved when plugin registers)
                if (!channelId) {
                    channelId = "lobby";
                }
                
                // If user was in lobby but now has a real channel, move them
                if (existingInfo && existingInfo.channelId === "lobby" && channelId !== "lobby") {
                    const lobbyPositions = getChannelPositions("lobby");
                    if (lobbyPositions[visibleId]) {
                        delete lobbyPositions[visibleId];
                        broadcastToChannel("lobby");
                    }
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

// Start the HTTP + WebSocket server
server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SpatialVoice Server] Running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  ws://localhost:${PORT}`);
});
