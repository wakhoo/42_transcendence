import { WebSocketServer } from 'ws';
import http from 'http';

// server http pour le healthcheck du compose
const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain'});
    res.end('not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message: Buffer) => {
        console.log('Message received', message.toString());
    });
    ws.on('close', () => console.log('Client disconnected'));
});

server.listen(9000, '0.0.0.0', () => {
    console.log('Websocket server running on port 9000');
});

process.on("SIGTERM", async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.exit(0);
});