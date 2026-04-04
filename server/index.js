import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import roomRouter from './routes/roomRoutes.js';
import { registerSocketHandlers } from './socket/socketHandler.js';
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.SERVER_PORT

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

httpServer.listen(PORT, () => console.log(`server running on port ${PORT}`));