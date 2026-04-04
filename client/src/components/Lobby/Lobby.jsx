import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./Lobby.css";

const SERVER = "http://localhost:5000";

const Lobby = () => {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const socketRef = useRef(null);

    const [playerId] = useState(() => localStorage.getItem("playerId"));
    const [guestToken] = useState(() => localStorage.getItem("guestToken"));
    const [myPfp] = useState(() => localStorage.getItem("pfp") || "avatar");

const pfpSrc = (pfpName) =>
    new URL(`../../assets/pfp/${pfpName || "avatar"}.jpeg`, import.meta.url).href;

    const [players,   setPlayers]   = useState([]);
    const [connected, setConnected] = useState(false);
    const [toasts,    setToasts]    = useState([]);

    const addToast = useCallback((text, type = "info") => {
        const id = Date.now();
        setToasts(prev => [...prev.slice(-3), { text, type, id }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);

    useEffect(() => {
        if (!playerId || !guestToken) { navigate("/"); return; }

        const socket = io(SERVER, { autoConnect: false });
        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);
            socket.emit("join_room", { roomCode, playerId, guestToken });
        });

        socket.on("disconnect", () => setConnected(false));

        socket.on("room_state", (state) => {
            setPlayers(state.players || []);
            if (state.status === "in_progress") {
                navigate(`/room/${roomCode}`, { state: { fromLobby: true } });
            }
        });

        socket.on("player_joined", ({ username }) => addToast(`${username} joined`, "info"));

        socket.on("player_left", () => addToast("A player disconnected", "warn"));

        socket.on("game_started", () => {
            navigate(`/room/${roomCode}`, { state: { fromLobby: true } });
        });

        socket.on("error", ({ message }) => addToast(message, "error"));

        socket.connect();

        return () => socket.disconnect();

    }, [roomCode, playerId, guestToken]);

    const handleReady = () => socketRef.current?.emit("player_ready");
    const handleStart = () => {
        const cardsPerPlayer = parseInt(localStorage.getItem("handSize") || "13", 10);
        socketRef.current?.emit("start_game", { cardsPerPlayer });
    };

    const selfPlayer  = players.find(p => p.playerId === playerId);
    const readyCount  = players.filter(p => p.isReady).length;
    const isSelfReady = selfPlayer?.isReady;
    const isHost      = selfPlayer?.seatPosition === 1;
    const allReady    = players.length >= 2 && players.every(p => p.isReady);

    return (
        <div className="lobby-root">
            <div className="lobby-bg" />

            <div className="lobby-panel">
                <div className="lobby-header">
                    <h1 className="lobby-code">
                        Room Code: <span className="room-code">{roomCode}</span>
                    </h1>
                    <div className={`lobby-conn ${connected ? "lobby-conn--on" : ""}`}>
                        <span className="lobby-conn-dot" />
                        {connected ? "connected" : "connecting…"}
                    </div>
                </div>

                <div className="lobby-players">
                    {players.map(p => (
                        <div
                            key={p.playerId}
                            className={`lobby-player ${p.playerId === playerId ? "lobby-player--self" : ""}`}
                        >
                            <span className="lobby-player-avatar">
                                <img
                                    src={pfpSrc(p.playerId === playerId ? myPfp : p.pfp)}
                                    alt={p.username}
                                />
                            </span>
                            <span className="lobby-player-name">
                                {p.username}{p.playerId === playerId ? " (you)" : ""}
                            </span>
                            <span className={`lobby-player-status ${p.isReady ? "lobby-player-status--ready" : ""}`}>
                                {p.isReady ? "ready" : "waiting"}
                            </span>
                        </div>
                    ))}
                    {players.length === 0 && (
                        <p className="lobby-empty">Waiting for players to connect…</p>
                    )}
                </div>

                <div className="lobby-footer">
                    <span className="lobby-count">{readyCount}/{players.length} ready</span>
                    <div className="lobby-actions">
                        {!isSelfReady && (
                        <button className="lobby-btn lobby-btn--ready" onClick={handleReady}>
                            Mark ready
                        </button>
                        )}
                        {isSelfReady && isHost && (
                        <button
                            className="lobby-btn lobby-btn--start"
                            onClick={handleStart}
                            disabled={!allReady}
                            title={!allReady ? 'Waiting for all players to ready up…' : 'Start the game'}
                        >
                            Start Game
                        </button>
                        )}
                        {isSelfReady && !isHost && (
                        <button className="lobby-btn lobby-btn--waiting" disabled>
                            Waiting for host…
                        </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="lobby-toasts">
                {toasts.map((t, i) => (
                    <div key={i} className={`lobby-toast lobby-toast--${t.type}`}>{t.text}</div>
                ))}
            </div>
        </div>
    );
};

export default Lobby;