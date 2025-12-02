const WebSocket = require('ws');

const PROXY_PORT = 8080;
const REMOTE_URL = 'ws://216.15.14.234:34197';

// Create WebSocket server on 127.0.0.1:8080 (IPv4 explicitly)
const wss = new WebSocket.Server({ 
    port: PROXY_PORT, 
    host: '127.0.0.1' 
});

// Store all connected clients
const clients = new Set();

// Store the connection to the remote server
let remoteWs = null;

// Function to connect to the remote WebSocket server
function connectToRemote() {
    if (remoteWs && remoteWs.readyState === WebSocket.OPEN) {
        return;
    }

    console.log(`[Proxy] Connecting to remote server: ${REMOTE_URL}`);
    remoteWs = new WebSocket(REMOTE_URL);

    remoteWs.on('open', () => {
        console.log(`[Proxy] Connected to remote server: ${REMOTE_URL}`);
    });

    remoteWs.on('message', (data) => {
        // Forward message from remote server to all connected clients
        console.log(`[Proxy] Received message from remote, forwarding to ${clients.size} client(s)`);
        
        const message = data.toString();
        broadcastToClients(message);
    });

    remoteWs.on('error', (error) => {
        console.error(`[Proxy] Remote connection error:`, error.message);
    });

    remoteWs.on('close', () => {
        console.log(`[Proxy] Disconnected from remote server, attempting to reconnect...`);
        remoteWs = null;
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
            connectToRemote();
        }, 3000);
    });
}

// Function to broadcast messages to all connected clients
function broadcastToClients(message) {
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

// Function to send message to remote server
function sendToRemote(message) {
    if (remoteWs && remoteWs.readyState === WebSocket.OPEN) {
        remoteWs.send(message);
    }
}

// Handle client connections
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[Proxy] Client connected (${clients.size} total client(s))`);

    // Forward messages from client to remote server
    ws.on('message', (data) => {
        console.log(`[Proxy] Received message from client, forwarding to remote`);
        sendToRemote(data.toString());
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[Proxy] Client disconnected (${clients.size} total client(s))`);
    });

    ws.on('error', (error) => {
        console.error(`[Proxy] Client error:`, error.message);
    });
});

console.log(`[Proxy] Starting WebSocket proxy server on 127.0.0.1:${PROXY_PORT}`);
console.log(`[Proxy] Will forward events from ${REMOTE_URL}`);
connectToRemote();