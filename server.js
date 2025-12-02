const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require("ws");

// Use the testing port 34197 (can still be overridden by env if needed)
const PORT = process.env.PORT || 34197;
const HOST = '0.0.0.0';
const HTML_FILE = path.join(__dirname, 'canvas.html');

// Store positions: odId -> { odId, odname, x, y }
const positions = {};

// Track which ws belongs to which odId
const wsToUser = new Map();

// All connected clients
const clients = new Set();

// Get local IP for display
const os = require('os');
const networkInterfaces = os.networkInterfaces();
let localIP = 'localhost';

// Find the first non-internal IPv4 address
for (const interfaceName of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
        }
    }
    if (localIP !== 'localhost') break;
}

// Basic HTTP server to serve canvas.html on the same port as WebSocket
const server = http.createServer((req, res) => {
    fs.readFile(HTML_FILE, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading canvas.html');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
});

// Attach WebSocket server to the same HTTP server (same port)
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`[Server] Client connected (${clients.size} total)`);

    // Send current positions to new client
    ws.send(JSON.stringify({
        type: "positions",
        positions: positions
    }));

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === "updatePosition") {
                // Track which user this ws belongs to
                wsToUser.set(ws, message.odId);
                
                // Store new position
                positions[message.odId] = {
                    odId: message.odId,
                    odname: message.odname,
                    x: message.x,
                    y: message.y
                };

                console.log(`[Server] ${message.odname} -> (${message.x}, ${message.y})`);

                // Broadcast to ALL clients
                broadcast({
                    type: "positions",
                    positions: positions
                });
            }
        } catch (e) {
            console.error("[Server] Bad message:", e);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        
        // Remove user's position
        const odId = wsToUser.get(ws);
        if (odId) {
            delete positions[odId];
            wsToUser.delete(ws);
            console.log(`[Server] ${odId} disconnected (${clients.size} total)`);
            
            // Broadcast updated positions
            broadcast({
                type: "positions",
                positions: positions
            });
        } else {
            console.log(`[Server] Client disconnected (${clients.size} total)`);
        }
    });
});

function broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

// Start the HTTP + WebSocket server
server.listen(PORT, HOST, () => {
    console.log(`[SpatialVoice Server] HTTP + WS running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  http://${localIP}:${PORT}`);
    console.log(`  ws://localhost:${PORT}`);
    console.log(`  ws://${localIP}:${PORT}`);
});
