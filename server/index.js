import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import roomRouter from './routes/roomRoutes.js';
import { registerSocketHandlers } from './socket/socketHandler.js';

console.log("starting");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*', // tighten this in production
        methods: ['GET', 'POST'],
    },
});

app.use(cors());
app.use(express.json());

app.use('/api/room', roomRouter);

// Attach io to app so routes/controllers can emit if needed
app.set('io', io);

registerSocketHandlers(io);

httpServer.listen(5000, () => console.log('server running on port 5000'));