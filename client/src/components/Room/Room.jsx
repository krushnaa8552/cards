import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { validateRummyHand } from "../../../../shared/rummyValidator.js";
import { useToast } from "./components/useToast";
import { pfpSrc } from "./utils/pfpSrc";
import RoomBackground from "./components/RoomBackground";
import RoomTopBar from "./components/RoomTopBar";
import OpponentPanel from "./components/OpponentPanel";
import RoomCenter from "./components/RoomCenter";
import SelfPanel from "./components/SelfPanel";
import DeclareModal from "./components/DeclareModal";
import ToastContainer from "./components/ToastContainer";
import "./Room.css";

const SERVER = "http://localhost:5000";

const Room = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const dragSrcId = useRef(null);
  const myHandRef = useRef([]);

  const [playerId] = useState(() => localStorage.getItem("playerId"));
  const [guestToken] = useState(() => localStorage.getItem("guestToken"));
  const [myPfp] = useState(() => localStorage.getItem("pfp") || "avatar");

  const [roomState, setRoomState] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  // Keep a ref in sync so socket handlers always see the latest hand order
  useEffect(() => { myHandRef.current = myHand; }, [myHand]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [declareResult, setDeclareResult] = useState(null);
  const [declareConfirming, setDeclareConfirming] = useState(false);
  const [declareSplit, setDeclareSplit] = useState(null);

  const { toasts, addToast } = useToast();

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
      setRoomState(state);
      if (state.status === "waiting") navigate(`/lobby/${roomCode}`);
    });

    socket.on("player_joined", ({ username: u }) => addToast(`${u} joined`, "join"));
    socket.on("player_left", ({ username }) => addToast(`${username || "A player"} disconnected`, "leave"));

    socket.on("game_started", (state) => {
      setHasDrawn(false);
      setGameState({
        drawPileSize: state.drawPileSize,
        discardPileTop: state.discardPile?.[0] || null,
        currentTurnPlayerId: state.currentTurnPlayerId,
        players: state.players,
      });
      addToast("Game started! Cards dealt.", "success");
    });

    socket.on("hand_updated", ({ hand }) => {
      setMyHand(prev => {
        const newIds = new Set(hand.map(c => c.id));
        const kept = prev.filter(c => newIds.has(c.id));
        const keptIds = new Set(kept.map(c => c.id));
        const added = hand.filter(c => !keptIds.has(c.id));
        return [...kept, ...added];
      });
      setSelectedCard(null);
    });

    socket.on("game_restored", (state) => {
      setMyHand(state.hand);
      setSelectedCard(null);
      setHasDrawn(false);
      setGameState({
        drawPileSize: state.drawPileSize,
        discardPileTop: state.discardPileTop,
        currentTurnPlayerId: state.currentTurnPlayerId,
        players: state.players,
      });
    });

    socket.on("card_drawn", ({ playerId: pid, username, drawPileSize, discardPileTop, source, card }) => {
      setGameState(prev => prev ? {
        ...prev,
        drawPileSize,
        ...(discardPileTop !== undefined ? { discardPileTop } : {}),
      } : prev);
      if (pid === playerId) {
        setHasDrawn(true);
      } else {
        const playerName = username || "Opponent";
        const cardName = card?.joker ? "Joker" : `${card?.rank} of ${card?.suit}`;
        const src = source === "discard" ? `discard pile (${cardName})` : "deck";
        addToast(`${playerName} drew from ${src}`, "card");
      }
    });

    socket.on("card_played", ({ playerId: pid, username, card, discardPileTop, nextTurnPlayerId, nextTurnUsername, playerCardCount }) => {
      setGameState(prev => prev ? {
        ...prev,
        discardPileTop,
        currentTurnPlayerId: nextTurnPlayerId,
        players: prev.players?.map(p => p.playerId === pid ? { ...p, cardCount: playerCardCount } : p),
      } : prev);
      setRoomState(prev => prev ? {
        ...prev,
        players: prev.players.map(p => p.playerId === pid ? { ...p, cardCount: playerCardCount } : p),
      } : prev);

      const nextPlayerName = nextTurnPlayerId === playerId ? "Your" : (nextTurnUsername || "Opponent");

      if (pid !== playerId) {
        const cardName = card?.joker ? "Joker" : `${card?.rank} of ${card?.suit}`;
        addToast(`${username || "Opponent"} discarded ${cardName}`, "card");
      }
      addToast(`${nextPlayerName} turn`, "turn");
      setHasDrawn(false);
    });

    socket.on("game_over", ({ winnerId, winnerName, allHands }) => {
      // For the current player, replace their server-sent hand with the locally
      // reordered myHand so the card order matches what they saw when declaring.
      const handsWithLocalOrder = (allHands || []).map((p) => {
        if (p.playerId !== playerId) return p;
        // Build a set of card IDs the server says are in the final hand
        const serverIds = new Set((p.hand || []).map((c) => c.id));
        // Keep local order, only include cards confirmed by the server
        const localOrdered = myHandRef.current.filter((c) => serverIds.has(c.id));
        // Append any server cards not yet in local state (edge case)
        const localIds = new Set(localOrdered.map((c) => c.id));
        const extra = (p.hand || []).filter((c) => !localIds.has(c.id));
        return { ...p, hand: [...localOrdered, ...extra] };
      });
      // Disconnect cleanly before navigating
      socket.disconnect();
      navigate(`/room/${roomCode}/game-over`, {
        state: { winnerId, winnerName, allHands: handsWithLocalOrder },
      });
    });

    socket.on("declare_invalid", ({ errors }) => {
      setDeclareResult({ valid: false, errors });
      setDeclareConfirming(false);
    });

    socket.on("deck_reshuffled", ({ drawPileSize, discardPileTop }) => {
      setGameState(prev => prev ? { ...prev, drawPileSize, discardPileTop } : prev);
      addToast("Draw pile empty — discard pile reshuffled!", "info");
    });

    socket.on("error", ({ message }) => addToast(message, "error"));

    socket.connect();
    return () => socket.disconnect();
  }, [roomCode, playerId, guestToken]);

  const handleDrawFromDeck = () => socketRef.current?.emit("draw_card");
  const handleDrawDiscard = () => socketRef.current?.emit("draw_from_discard");
  const handlePlayCard = () => {
    if (selectedCard) {
      socketRef.current?.emit("play_card", {
        cardId: selectedCard.id,
        handOrder: myHandRef.current.map(c => c.id), // send current drag order
      });
    }
  };

  const handleDeclare = (splitKey) => {
    if (!selectedCard) return;
    const handAfterDiscard = myHand.filter(c => c.id !== selectedCard.id);
    setDeclareSplit(splitKey || null);
    setDeclareResult(validateRummyHand(handAfterDiscard, splitKey));
    setDeclareConfirming(false);
  };

  const handleDeclareConfirm = () => {
    if (!selectedCard) return;
    setDeclareConfirming(true);
    socketRef.current?.emit("declare_hand", {
      discardCardId: selectedCard.id,
      activeSplit: declareSplit,
      handOrder: myHandRef.current.map(c => c.id), // persist player's visual order
    });
  };

  const handleDeclareClose = () => {
    setDeclareResult(null);
    setDeclareConfirming(false);
    setDeclareSplit(null);
  };

  const handleSelectCard = (card) =>
    setSelectedCard(prev => prev?.id === card.id ? null : card);

  const onDragStart = (e, cardId) => {
    const el = e.currentTarget;
    const img = el.querySelector("img");
    if (img) {
      e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
    }
    e.dataTransfer.effectAllowed = "move";
    dragSrcId.current = cardId;
    setDraggingId(cardId);

    // Attach dragend directly to the source element NOW, before React can
    // detach it (cross-group reorder unmounts it). dragend on a detached
    // element doesn't bubble to document, but does fire on the element itself.
    const clear = () => {
      dragSrcId.current = null;
      setDraggingId(null);
      el.removeEventListener("dragend", clear);
    };
    el.addEventListener("dragend", clear);
  };

  const onDragEnter = (e, targetId) => {
    e.preventDefault();
    const srcId = dragSrcId.current;
    if (!srcId || srcId === targetId) return;
    setMyHand(prev => {
      const from = prev.findIndex(c => c.id === srcId);
      const to = prev.findIndex(c => c.id === targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onDragEnd = () => { dragSrcId.current = null; setDraggingId(null); };



  const isMyTurn = gameState?.currentTurnPlayerId === playerId;
  const allPlayers = roomState?.players || [];
  const opponents = allPlayers.filter(p => p.playerId !== playerId);
  const selfPlayer = allPlayers.find(p => p.playerId === playerId);
  const canDrawDiscard = isMyTurn && !hasDrawn && !!gameState?.discardPileTop;

  return (
    <div className="room room--game">
      <RoomBackground />

      <RoomTopBar
        roomCode={roomCode}
        connected={connected}
        isMyTurn={isMyTurn}
      />

      <OpponentPanel
        opponents={opponents}
        currentTurnPlayerId={gameState?.currentTurnPlayerId}
        allPlayers={allPlayers}
        playerId={playerId}
      />

      <div className="room__body">
        <RoomCenter
          gameState={gameState}
          isMyTurn={isMyTurn}
          hasDrawn={hasDrawn}
          canDrawDiscard={canDrawDiscard}
          onDrawDeck={handleDrawFromDeck}
          onDrawDiscard={handleDrawDiscard}
        />
      </div>

      {/* Self avatar pinned to bottom edge of the oval */}
      <div className="self-avatar-anchor">
        {selfPlayer && (
          <div className="opponent">
            <div className={`opponent__avatar ${isMyTurn ? "opponent__avatar--active" : ""}`}>
              <img src={pfpSrc(myPfp)} alt={selfPlayer.username} />
            </div>
            <span className="opponent__name">{selfPlayer.username} (you)</span>
          </div>
        )}
      </div>

      <SelfPanel
        selfPlayer={null}
        myHand={myHand}
        isMyTurn={isMyTurn}
        hasDrawn={hasDrawn}
        selectedCard={selectedCard}
        draggingId={draggingId}
        onSelectCard={handleSelectCard}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragEnd={onDragEnd}
        onDrawDeck={handleDrawFromDeck}
        onDiscard={handlePlayCard}
        onDeclare={handleDeclare}
        drawPileSize={gameState?.drawPileSize}
      />

      <DeclareModal
        result={declareResult}
        onClose={handleDeclareClose}
        onConfirm={handleDeclareConfirm}
        confirming={declareConfirming}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
};

export default Room;