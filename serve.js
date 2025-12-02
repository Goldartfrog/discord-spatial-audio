const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const HTML_FILE = path.join(__dirname, 'canvas.html');

const server = http.createServer((req, res) => {
    // Serve canvas.html for all routes
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

server.listen(PORT, '0.0.0.0', () => {
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
    
    console.log(`Server running at:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  http://${localIP}:${PORT}`);
});

