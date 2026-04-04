import express from 'express';
import { startGame, joinGame } from '../controllers/roomController.js'

const roomRouter = express.Router();

roomRouter.post('/start-game', startGame);
roomRouter.post('/join-game', joinGame);

export default roomRouter;