/*
this is the socketHandler file that i will try to understand
*/

import db from "../db.js";
import { buildDeck, shuffleDeck, dealToPlayers, generateSeed } from "../gameService.js";
import { serverValidateDeclare } from "../rummyValidator.js";

const socketMeta = new Map(); //connecting the socketid to a players data

const hasDrawnThisTurn = new Map();
const turnKey = (sessionId, playerId) => `${sessionId}:${playerId}`;

export const registerSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`[socket] connected: ${socket.id}`);

        socket.on('join_room', async ({ roomCode, playerId, guestToken }) => {
            try {
                const room = await db.getRoomByCode(roomCode);
                if (!room) return socket.emit('error', { message: 'Room not found' });

                const player = await db.getPlayerById(playerId);
                if (!player) return socket.emit('error', { message: 'Player not found' });
                if (player.guest_token !== guestToken) return socket.emit('error', { message: 'Invalid Token' });

                await db.setPlayerActive(room.id, playerId, true);

                socket.join(roomCode);

                const activeSession = await db.getActiveSession(room.id);
                
                socketMeta.set(socket.id, {
                    playerId,
                    roomId: room.id,
                    roomCode,
                    sessionId: activeSession?.id || null
                });

                /*
                if a player disconnects and reconnects, this will store the data of what cards they had
                */

                if (activeSession) {
                    const hand = await db.getPlayerHand(activeSession.id, playerId);
                    const drawPileRaw = typeof activeSession.draw_pile === 'string'
                        ? JSON.parse(activeSession.draw_pile)
                        : (activeSession.draw_pile ?? []);
                    const discardRaw = typeof activeSession.discard_pile === 'string'
                        ? JSON.parse(activeSession.discard_pile)
                        : (activeSession.discard_pile ?? []);
                    const roomPlayers = await db.getPlayersInRoom(room.id);

                    socket.emit('game_restored', {
                        sessionId: activeSession.id,
                        drawPileSize: drawPileRaw.length,
                        discardPileTop: discardRaw[0] || null,
                        currentTurnPlayerId: activeSession.current_turn_player_id,
                        hand,
                        players: roomPlayers.map(p => ({
                            playerId: p.player_id,
                            username: p.username,
                            pfp: p.pfp,
                            seatPosition: p.seat_position,
                            cardCount: null
                        })),
                    });
                }

                await broadcastRoomState(io, roomCode, room.id);

                io.to(roomCode).emit('player_joined', {
                    playerId,
                    username: player.username,
                    pfp: player.pfp
                });

            } catch (e) {
                console.log('[join_room', e);
                socket.emit('error', { message: 'failed to join room' });
            }
        });

        /*
        to check whether player is ready or not
        */
        socket.on('player_ready', async () => {
            const meta = socketMeta.get(socket.id);
            if(!meta) return socket.emit('error', { message: 'not in room' });

            try {
                await db.setPlayerReady(meta.roomId, meta.playerId, true);
                await broadcastRoomState(io, meta.roomCode, meta.roomId);
            } catch (e) {
                console.log('[player_ready]', e);
            }
        });


        /*
        start game endpoint
        */
        socket.on('start_game', async ({ cardsPerPlayer = 13 } = {}) => {
            const meta = socketMeta.get(socket.id);
            if (!meta) return socket.emit('error', { message: 'Not in a room' });

            try {
                const room = await db.getRoomById(meta.roomId);
                if (!room) return socket.emit('error', { message: 'Room not found' });
                if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started' });

                const players = await db.getPlayersInRoom(meta.roomId);
                if (players.length < 2) return socket.emit('error', { message: 'Need at least 2 players' });

                // Only the host (seat 1 / room creator) can start the game
                const hostPlayer = players.find(p => p.seat_position === 1);
                if (!hostPlayer || hostPlayer.player_id !== meta.playerId) {
                    return socket.emit('error', { message: 'Only the host can start the game' });
                }

                // All players must be ready
                const allReady = players.every(p => p.is_ready);
                if (!allReady) return socket.emit('error', { message: 'All players must be ready before starting' });
                
                //build and shuffle deck
                const seed = generateSeed();
                const shuffled = shuffleDeck(buildDeck(), seed);

                //shuffle and deal cards to player
                const playerIds = players.map((p) => p.player_id);
                const { hands, drawPile } = dealToPlayers(shuffled, playerIds, cardsPerPlayer);

                //persist socket connection and player's data
                const session = await db.createGameSession(meta.roomId, seed, drawPile);

                for (const pid of playerIds) {
                    await db.setPlayerHand(session.id, pid, hands[pid]);
                }

                //set first turn to seat 1
                const firstPlayer = players[0];
                await db.setCurrentTurn(session.id, firstPlayer.player_id);
                await db.setRoomStatus(meta.roomId, 'in_progress');

                for (const [sid, m] of socketMeta.entries()) {
                    if (m.roomCode === meta.roomCode) {
                        socketMeta.set(sid, { ...m, sessionId: session.id });
                    }
                }

                //send all players their hands, and other payload that is shared
                const socketsInRoom = await io.in(meta.roomCode).fetchSockets();
                for (const s of socketsInRoom) {
                    const m = socketMeta.get(s.id);
                    if (!m) continue;
                    s.emit('hand_updated', { hand: hands[m.playerId] || [] });
                }

                //broadcast game state, not hands
                io.to(meta.roomCode).emit('game_started', {
                    sessionId: session.id,
                    drawPileSize: drawPile.length,
                    discardPile: [],
                    currentTurnPlayerId: firstPlayer.player_id,
                    players: players.map((p) => ({
                        playerId: p.player_id,
                        username: p.username,
                        pfp: p.pfp,
                        seatPosition: p.seat_position,
                        cardCount: cardsPerPlayer 
                    }))
                });
            } catch (e) {
                console.error('[start_game]', e);
                socket.emit('error', { message: 'failed to start game' });
            }
        });

        socket.on('draw_card', async () => {
            const meta = socketMeta.get(socket.id);
            if (!meta?.roomId) return socket.emit('error', { message: 'Not in room'});

            try {
                const session = await db.getActiveSession(meta.roomId);
                if (!session) return socket.emit('error', { message: 'No active session' });

                //update sessionId in meta after reconnecting
                if (!meta.sessionId) {
                    socketMeta.set(socket.id, { ...meta, sessionId: session.id});
                }

                //enforce turn
                const turnId = session.current_turn_player_id?.trim();
                const pid = meta.playerId?.trim();
                console.log(`[draw_card] turn=${turnId} player=${pid} match=${turnId === pid}`);
                if (turnId !== pid) return socket.emit('error', { message: 'Not your turn' });

                //enfore drawing only once per turn
                const drawKey = turnKey(session.id, pid);
                if (hasDrawnThisTurn.get(drawKey)) return socket.emit('error', { message: 'Already drawn for this turn' });

                //draw pile comes back as string if JSONB is auto parsed
                let drawPile = typeof session.draw_pile === 'string'
                    ? JSON.parse(session.draw_pile)
                    : (session.draw_pile ?? []);

                //if draw pile is empty, the discard pile will reshuffle; and keeps the top card of discard pile in place for next turn
                if (drawPile.length === 0) {
                    const discardRaw = typeof session.discard_pile === 'string'
                        ? JSON.parse(session.discard_pile)
                        : (session.discard_pile ?? []);

                    if (discardRaw.length < 2) return socket.emit('error', { message: 'discard pile is too small' });

                    const [keepOnTop, ...toReshuffle] = discardRaw;

                    const newSeed = Math.floor(Math.random() * 2 ** 31);
                    const { shuffleDeck } = await import ('../gameService.js');
                    drawPile = shuffleDeck(toReshuffle, newSeed);

                    await db.updatePiles(session.id, drawPile, [keepOnTop]);

                    io.to(meta.roomCode).emit('deck_reshuffled', {
                        drawPileSize: drawPile.length,
                        discardPileTop: keepOnTop
                    });
                }

                //pop from top
                const [drawnCard, ...remainingDraw] = drawPile;

                //update player hand
                const hand = await db.getPlayerHand(session.id, meta.playerId);
                const newHand = [...hand, drawnCard];

                await db.updateDrawPile(session.id, remainingDraw);
                await db.setPlayerHand(session.id, meta.playerId, newHand);
                try { await db.logAction(session.id, meta.playerId, 'draw_from_deck', drawnCard, newHand); } catch {}
                hasDrawnThisTurn.set(turnKey(session.id, meta.playerId?.trim()), true);

                //tell drawer their new hand
                socket.emit('hand_updated', { hand: newHand });

                //tell everyone that a card was drawn
                const player = await db.getPlayerById(meta.playerId);
                io.to(meta.roomCode).emit('card_drawn', {
                    playerId: meta.playerId,
                    username: player?.username,
                    drawPileSize: remainingDraw.length,
                    source: 'deck',
                    card: drawnCard
                });

            } catch (e) {
                console.error('[error]', e);
                socket.emit('error', { message: 'failed to draw card' });
            }
        })

        socket.on('draw_from_discard', async () => {
            const meta = socketMeta.get(socket.id);
            if (!meta?.roomId) return socket.emit('error', { message: 'Not in a room' });

            const earlyKey = `pending:${socket.id}`;
            if (hasDrawnThisTurn.get(earlyKey)) return;
            hasDrawnThisTurn.set(earlyKey, true);

            try {
                const session = await db.getActiveSession(meta.roomId);
                if (!session) {
                    hasDrawnThisTurn.delete(earlyKey);
                    return socket.emit('error', { message: 'No active session' });
                }

                if (!meta.sessionId) socketMeta.set(socket.id, { ...meta, sessionId: session.id });

                const turnId = session.current_turn_player_id?.trim();
                const pid = meta.playerId?.trim();
                if (turnId !== pid) {
                    hasDrawnThisTurn.delete(earlyKey);
                    return socket.emit('error', { message: 'Not your turn' });
                }

                const drawKey = turnKey(session.id, pid);
                if (hasDrawnThisTurn.get(drawKey)) {
                    hasDrawnThisTurn.delete(earlyKey);
                    return socket.emit('error', { message: 'Already drew this turn' });
                }

                const discardPile = typeof session.discard_pile === 'string'
                    ? JSON.parse(session.discard_pile)
                    :(session.discard_pile ?? []);
                if (discardPile.length === 0) {
                    hasDrawnThisTurn.delete(earlyKey);
                    return socket.emit('error', { message: 'discard pile is empty' });
                }

                hasDrawnThisTurn.set(drawKey, true);
                hasDrawnThisTurn.delete(earlyKey);

                //take top card from discard pile
                const [drawnCard, ...remainingDiscard] = discardPile;
                const hand = await db.getPlayerHand(session.id, meta.playerId);
                const newHand = [...hand, drawnCard];

                await db.updateDiscardPile(session.id, remainingDiscard);
                await db.setPlayerHand(session.id, meta.playerId, newHand);
                try { await db.logAction(session.id, meta.playerId, 'draw_from_discard', drawnCard, newHand); } catch {}

                //send update hand to player
                socket.emit('hand_updated', { hand: newHand });

                //send the face up card of teh discard pile to everyone;
                const drawPileRaw = typeof session.draw_pile === 'string'
                    ? JSON.parse(session.draw_pile)
                    : (session.draw_pile ?? []);
                
                const player = await db.getPlayerById(meta.playerId);
                io.to(meta.roomCode).emit('card_drawn', {
                    playerId: meta.playerId,
                    username: player?.username,
                    drawPileSize: drawPileRaw.length,
                    discardPileTop: remainingDiscard[0] || null,
                    source: 'discard',
                    card: drawnCard,
                });
            } catch (e) {
                hasDrawnThisTurn.delete(`pending:${socket.id}`);
                console.error('[drawn_from_discard]', e);
                socket.emit('error', { message: 'failed to draw cardfrom discard' });
            }
        });

        socket.on('play_card', async ({ cardId, handOrder }) => {
            const meta = socketMeta.get(socket.id);
            if (!meta?.roomId) return socket.emit('error', { message: 'not in a room' });

            try {
                const session = await db.getActiveSession(meta.roomId);
                if (!session) return socket.emit('error', { message: 'No active session' });

                if (!meta.sessionId) socketMeta.set(socket.id, { ...meta, sessionId: session.id });

                const turnId = session.current_turn_player_id?.trim();
                const pid = meta.playerId?.trim();
                if (turnId !== pid) return socket.emit('error', { message: 'not your turn' } );

                //must draw before discarding
                const playerKey = turnKey(session.id, pid);
                if (!hasDrawnThisTurn.get(playerKey)) return socket.emit('error', { message: 'draw a card first' });

                const hand = await db.getPlayerHand(session.id, meta.playerId);
                const cardIndex = hand.findIndex((c) => c.id === cardId);
                if (cardIndex === -1) return socket.emit('error', { message: 'card not in hand' });

                // Apply the client's preferred drag order before removing the discarded card
                let orderedHand = hand;
                if (handOrder && Array.isArray(handOrder)) {
                    const cardMap = new Map(hand.map(c => [c.id, c]));
                    orderedHand = [
                        ...handOrder.map(id => cardMap.get(id)).filter(Boolean),
                        ...hand.filter(c => !handOrder.includes(c.id)), // catch any stragglers
                    ];
                }

                const [playerCard] = orderedHand.splice(orderedHand.findIndex(c => c.id === cardId), 1);
                const discardPileRaw = typeof session.discard_pile === 'string'
                    ? JSON.parse(session.discard_pile)
                    : (session.discard_pile ?? []);
                const newDiscard = [playerCard, ...discardPileRaw];

                await db.updateDiscardPile(session.id, newDiscard);
                await db.setPlayerHand(session.id, meta.playerId, orderedHand);
                try { await db.logAction(session.id, meta.playerId, 'discard', playerCard, orderedHand); } catch {}

                //check win condition;
                if (orderedHand.length === 0) {
                    await db.endGameSession(session.id);
                    await db.setRoomStatus(meta.roomId, 'finished');
                    io.to(meta.roomCode).emit('game_over', { winnerId: meta.playerId });
                    return;
                }

                //advance turn
                const players = await db.getPlayersInRoom(meta.roomId);
                const currentIdx = players.findIndex((p) => p.player_id === meta.playerId);
                const nextPlayer = players[(currentIdx + 1) % players.length];
                await db.setCurrentTurn(session.id, nextPlayer.player_id);

                hasDrawnThisTurn.delete(turnKey(session.id, meta.playerId?.trim()));

                socket.emit('hand_updated', { hand: orderedHand });

                const player = await db.getPlayerById(meta.playerId);
                const nextPlayerData = await db.getPlayerById(nextPlayer.player_id);
                io.to(meta.roomCode).emit('card_played', {
                    playerId: meta.playerId,
                    username: player?.username,
                    card: playerCard,
                    discardPileTop: playerCard,
                    nextTurnPlayerId: nextPlayer.player_id,
                    nextTurnUsername: nextPlayerData?.username,
                    playerCardCount: hand.length
                });
            } catch (e) {
                console.error('[player_card]', e);
                socket.emit('error', {  message: 'failed to play card' });
            }
        });

        socket.on('declare_hand', async ({ discardCardId, activeSplit, handOrder }) => {
            const meta = socketMeta.get(socket.id);
            if (!meta?.roomId) return socket.emit('error', { message: 'not in a room' });

            if (!discardCardId) return socket.emit('declare_invalid', { errors: ['no discard card specified'] });

            try {
                const session = await db.getActiveSession(meta.roomId);
                if (!session) return socket.emit('error', { message: 'no active session' });

                const turnId = session.current_turn_player_id?.trim();
                const pid = meta.playerId?.trim();

                if (turnId !== pid) return socket.emit('declare_invalid', { errors: ['you can only declare on your turn'] });

                const drawKey = turnKey(session.id, pid);
                if (!hasDrawnThisTurn.get(drawKey)) return socket.emit('declare_invalid', { errors: ['You need to draw first'] });

                let hand = await db.getPlayerHand(session.id, meta.playerId); // will have 14 cards

                // Apply client's preferred drag order before validation
                if (handOrder && Array.isArray(handOrder)) {
                    const cardMap = new Map(hand.map(c => [c.id, c]));
                    hand = [
                        ...handOrder.map(id => cardMap.get(id)).filter(Boolean),
                        ...hand.filter(c => !handOrder.includes(c.id)),
                    ];
                }

                // don't consider the selected card for declare
                const discardIndex = hand.findIndex(c => c.id === discardCardId);
                if (discardIndex === -1) return socket.emit('declare_invalid', { errors: ['discard card not found in hand'] });
                const [discardedCard] = hand.splice(discardIndex, 1);

                //validate the 13 cards with the chosen split layout
                const result = serverValidateDeclare(hand, activeSplit);

                if (!result.valid) return socket.emit('declare_invalid', { errors: result.errors });

                //validate the cards and end the game
                const discardPileRaw = typeof session.discard_pile === 'string'
                    ? JSON.parse(session.discard_pile)
                    : (session.discard_pile ?? []);
                const newDiscard = [discardedCard, ...discardPileRaw];

                await db.updateDiscardPile(session.id, newDiscard);
                await db.setPlayerHand(session.id, meta.playerId, hand);
                await db.endGameSession(session.id);
                await db.setRoomStatus(meta.roomId, 'finished');
                try { await db.logAction(session.id, meta.playerId, 'declare_win', discardedCard, hand); } catch {}

                const player = await db.getPlayerById(meta.playerId);

                // Collect every player's final hand for the results screen
                const allRoomPlayers = await db.getPlayersInRoom(meta.roomId);
                const allHands = await Promise.all(
                    allRoomPlayers.map(async (p) => ({
                        playerId: p.player_id,
                        username: p.username,
                        pfp: p.pfp || 'avatar',
                        hand: p.player_id === meta.playerId
                            ? hand          // winner's hand is already splice-updated
                            : await db.getPlayerHand(session.id, p.player_id),
                    }))
                );

                io.to(meta.roomCode).emit('game_over', {
                    winnerId: meta.playerId,
                    winnerName: player?.username,
                    declared: true,
                    groups: result.groups,
                    allHands,
                });
            } catch (e) {
                console.error(`[declare_hand]`, e);
                socket.emit('error', { message: 'failed to process declaration' });
            }
        });

        socket.on('disconnect', async () => {
            const meta = socketMeta.get(socket.id);
            if (!meta) return;

            console.log(`[socket], disconnected: ${socket.id} (player ${meta.playerId})`);
            socketMeta.delete(socket.id);

            try {
                await db.setPlayerActive(meta.roomId, meta.playerId, false);
                const player = await db.getPlayerById(meta.playerId);
                io.to(meta.roomCode).emit('player_left', { 
                    playerId: meta.playerId,
                    username: player?.username
                });
                await broadcastRoomState(io, meta.roomCode, meta.roomId);
            } catch (e) {
                console.error(`[disconnect]`, e);
            }
        });
    });
};

//emit everyone roomState

const broadcastRoomState = async (io, roomCode, roomId) => {
    const [room, players] = await Promise.all([
        db.getRoomById(roomId),
        db.getPlayersInRoom(roomId),
    ]);
    io.to(roomCode).emit('room_state', {
        roomCode,
        status: room.status,
        maxPlayers: room.max_players,
        players: players.map((p) => ({
            playerId: p.player_id,
            username: p.username,
            seatPosition: p.seat_position,
            isReady: p.is_ready,
            isActive: p.is_active,
            pfp: p.pfp || 'avatar',
        })),
    });
};