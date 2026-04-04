import { Pool } from 'pg';
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: 
        PerformanceObserverEntryList.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false, 
});

// ─── Rooms ───────────────────────────────────────────────────────────────────

const createRoom = async (code, handSize = 13) => {
    const result = await pool.query(
        'INSERT INTO rooms (room_code, hand_size) VALUES ($1, $2) RETURNING *',
        [code, handSize]
    );
    return result.rows[0];
};

const getRoomByCode = async (code) => {
    const result = await pool.query(
        `SELECT * FROM rooms WHERE room_code = $1
         AND status IN ('waiting', 'in_progress')`,
        [code]
    );
    return result.rows[0] || null;
};

const getRoomById = async (roomId) => {
    const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    return result.rows[0] || null;
};

const setRoomStatus = async (roomId, status) => {
    const result = await pool.query(
        'UPDATE rooms SET status = $1 WHERE id = $2 RETURNING *',
        [status, roomId]
    );
    return result.rows[0];
};

// ─── Players ──────────────────────────────────────────────────────────────────

const createPlayer = async (username, pfp = null) => {
    const result = await pool.query(
        'INSERT INTO players (username, pfp) VALUES ($1, $2) RETURNING *',
        [username, pfp]
    );
    return result.rows[0];
};

const getPlayerById = async (playerId) => {
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    return result.rows[0] || null;
};

// ─── Room Players ─────────────────────────────────────────────────────────────

const addPlayerToRoom = async (roomId, playerId, seatPosition) => {
    const result = await pool.query(
        'INSERT INTO room_players (room_id, player_id, seat_position) VALUES ($1, $2, $3) RETURNING *',
        [roomId, playerId, seatPosition]
    );
    return result.rows[0];
};

const getPlayersInRoom = async (roomId) => {
    const result = await pool.query(
        `SELECT rp.*, p.username, p.guest_token, p.pfp
         FROM room_players rp
         JOIN players p ON p.id = rp.player_id
         WHERE rp.room_id = $1
         ORDER BY rp.seat_position`,
        [roomId]
    );
    return result.rows;
};

const setPlayerReady = async (roomId, playerId, isReady) => {
    const result = await pool.query(
        `UPDATE room_players SET is_ready = $1
         WHERE room_id = $2 AND player_id = $3
         RETURNING *`,
        [isReady, roomId, playerId]
    );
    return result.rows[0];
};

const setPlayerActive = async (roomId, playerId, isActive) => {
    await pool.query(
        `UPDATE room_players SET is_active = $1
         WHERE room_id = $2 AND player_id = $3`,
        [isActive, roomId, playerId]
    );
};

// ─── Game Sessions ────────────────────────────────────────────────────────────

const createGameSession = async (roomId, deckSeed, drawPile) => {
    const result = await pool.query(
        `INSERT INTO game_sessions (room_id, status, deck_seed, draw_pile, discard_pile)
         VALUES ($1, 'active', $2, $3, $4)
         RETURNING *`,
        [roomId, deckSeed, JSON.stringify(drawPile), JSON.stringify([])]
    );
    return result.rows[0];
};

const getActiveSession = async (roomId) => {
    const result = await pool.query(
        `SELECT * FROM game_sessions WHERE room_id = $1 AND status = 'active'
         ORDER BY started_at DESC LIMIT 1`,
        [roomId]
    );
    return result.rows[0] || null;
};

const updateDrawPile = async (sessionId, drawPile) => {
    await pool.query(
        'UPDATE game_sessions SET draw_pile = $1 WHERE id = $2',
        [JSON.stringify(drawPile), sessionId]
    );
};

const updateDiscardPile = async (sessionId, discardPile) => {
    await pool.query(
        'UPDATE game_sessions SET discard_pile = $1 WHERE id = $2',
        [JSON.stringify(discardPile), sessionId]
    );
};

const updatePiles = async (sessionId, drawPile, discardPile) => {
    await pool.query(
        'UPDATE game_sessions SET draw_pile = $1, discard_pile = $2 WHERE id = $3',
        [JSON.stringify(drawPile), JSON.stringify(discardPile), sessionId]
    );
};

const setCurrentTurn = async (sessionId, playerId) => {
    await pool.query(
        'UPDATE game_sessions SET current_turn_player_id = $1 WHERE id = $2',
        [playerId, sessionId]
    );
};

const endGameSession = async (sessionId) => {
    await pool.query(
        `UPDATE game_sessions SET status = 'finished', ended_at = NOW() WHERE id = $1`,
        [sessionId]
    );
};

// ─── Player Hands ─────────────────────────────────────────────────────────────

/**
 * Upsert a player's hand for a session.
 * If you have a player_hands table; otherwise we piggyback on game_log.
 */
const setPlayerHand = async (sessionId, playerId, cards) => {
    // Using a simple upsert — assumes you have a player_hands table:
    // CREATE TABLE player_hands (session_id uuid, player_id uuid, cards jsonb,
    //   PRIMARY KEY (session_id, player_id));
    await pool.query(
        `INSERT INTO player_hands (session_id, player_id, cards)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id, player_id)
         DO UPDATE SET cards = EXCLUDED.cards`,
        [sessionId, playerId, JSON.stringify(cards)]
    );
};

const getPlayerHand = async (sessionId, playerId) => {
    const result = await pool.query(
        'SELECT cards FROM player_hands WHERE session_id = $1 AND player_id = $2',
        [sessionId, playerId]
    );
    return result.rows[0]?.cards || [];
};

// ─── Game Log ─────────────────────────────────────────────────────────────────

const logAction = async (sessionId, playerId, actionType, card, handSnapshot) => {
    await pool.query(
        `INSERT INTO game_log (session_id, player_id, action_type, card, hand_snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, playerId, actionType, JSON.stringify(card), JSON.stringify(handSnapshot)]
    );
};

export default {
    pool,
    // rooms
    createRoom, getRoomByCode, getRoomById, setRoomStatus,
    // players
    createPlayer, getPlayerById,
    // room_players
    addPlayerToRoom, getPlayersInRoom, setPlayerReady, setPlayerActive,
    // sessions
    createGameSession, getActiveSession, updateDrawPile, updateDiscardPile,
    updatePiles, setCurrentTurn, endGameSession,
    // hands
    setPlayerHand, getPlayerHand,
    // log
    logAction,
};