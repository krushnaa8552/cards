import db from '../db.js';

const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const startGame = async (req, res) => {
    const { username, handSize = 13, pfp = 'avatar', code: clientCode } = req.body;

    if (!username?.trim()) return res.status(400).json({ error: 'Username is required' });

    const validHandSizes = [7, 10, 13];
    const parsedHandSize = validHandSizes.includes(Number(handSize)) ? Number(handSize) : 13;

    try {
        // Use client-provided code (shown to user before room creation) or generate a new one
        const code = clientCode?.trim() || generateRoomCode();

        const room = await db.createRoom(code, parsedHandSize);
        const player = await db.createPlayer(username, pfp);
        await db.addPlayerToRoom(room.id, player.id, 1); // first player, seat 1

        res.json({
            code: room.room_code,
            roomId: room.id,
            playerId: player.id,
            guestToken: player.guest_token,
            handSize: room.hand_size,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create room' });
    }
};

const joinGame = async (req, res) => {
    const { code, username, pfp = 'avatar' } = req.body;

    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
    if (!username?.trim()) return res.status(400).json({ error: 'Username is required' });

    try {
        const room = await db.getRoomByCode(code);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.status !== 'waiting') return res.status(400).json({ error: 'Game already in progress' });

        const players = await db.getPlayersInRoom(room.id);
        if (players.length >= room.max_players) return res.status(400).json({ error: 'Room is full' });

        const player = await db.createPlayer(username, pfp);
        const seatPosition = players.length + 1;
        await db.addPlayerToRoom(room.id, player.id, seatPosition);

        res.json({
            code: room.room_code,
            roomId: room.id,
            playerId: player.id,
            guestToken: player.guest_token,
            handSize: room.hand_size,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to join room' });
    }
};

export { startGame, joinGame };