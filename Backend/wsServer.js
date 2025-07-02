const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const clients = {}; // Store connected clients

wss.on('connection', (ws, req) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const role = urlParams.get('role');
    const traineeId = urlParams.get('traineeid');

    console.log(traineeId);

    if (!traineeId) {
        ws.close();
        return;
    }

    if (!clients[traineeId]) clients[traineeId] = {};
    clients[traineeId][role] = ws;

    console.log(`${role} for trainee ${traineeId} connected`);

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        console.log(`Received from ${role} (${traineeId}):`, parsedMessage.type);

        if (role === 'trainee') {
            // Send to trainer if connected
            if (clients[traineeId].trainer) {
                clients[traineeId].trainer.send(message);
            }
        } else if (role === 'trainer' && clients[traineeId].trainee) {
            clients[traineeId].trainee.send(message);
        }
    });

    ws.on('close', () => {
        console.log(`${role} for trainee ${traineeId} disconnected`);
        delete clients[traineeId][role];
    });
});

console.log("Signaling server running on ws://localhost:8080");
