import express from 'express';
import { startGame, joinGame } from '../controllers/roomController.js'

const lobbyRouter = express.Router();

lobbyRouter.post('/start-game', startGame);
lobbyRouter.post('/join-game', joinGame);

export default lobbyRouter;