import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { validateRummyHand } from "../../../../shared/rummyValidator.js";
import "./Room.css";

const SERVER = "http://localhost:5000";

const cardImg = (card) => {
  if (!card) return new URL("../../assets/cards/back.png", import.meta.url).href;

  if (card.joker) {
    return new URL(`../../assets/cards/${card.joker}.png`, import.meta.url).href;
  }

  const rankMap = { J: "J", Q: "Q", K: "K", A: "A" };
  const suitMap = { spades: "S", hearts: "H", diamonds: "D", clubs: "C" };
  const r = rankMap[card.rank] || card.rank;
  const s = suitMap[card.suit] || card.suit;
  return new URL(`../../assets/cards/${r}${s}.png`, import.meta.url).href;
};

const PlayerSeat = ({ player, isCurrentTurn, isSelf }) => (
  <div className={`seat ${isCurrentTurn ? "seat--turn" : ""} ${isSelf ? "seat--self" : ""}`}>
    <div className="seat__avatar">
      {player.username?.[0]?.toUpperCase() || "?"}
      {isCurrentTurn && <span className="seat__turn-ring" />}
    </div>
    <div className="seat__info">
      <span className="seat__name">{player.username}{isSelf ? " (you)" : ""}</span>
      <span className="seat__cards">{player.cardCount ?? "–"} cards</span>
    </div>
    {player.isReady && !isCurrentTurn && <span className="seat__ready">✓</span>}
    {!player.isActive && <span className="seat__offline">offline</span>}
  </div>
);

const CardBack = ({ label, count, onClick, disabled }) => (
  <button className={`pile pile--back ${disabled ? "pile--disabled" : ""}`} onClick={onClick} disabled={disabled}>
    <img src={cardImg(null)} alt="deck" draggable={false} />
    <span className="pile__count">{count}</span>
    {label && <span className="pile__label">{label}</span>}
  </button>
);

const Toast = ({ messages }) => (
  <div className="toasts">
    {messages.map((m, i) => (
      <div key={i} className={`toast toast--${m.type}`}>{m.text}</div>
    ))}
  </div>
);

// ── Declare Modal ─────────────────────────────────────────────────────────────
const GROUP_LABELS = {
  pure_sequence:   { label: "Pure Sequence",   color: "#4ade80", icon: "✦" },
  impure_sequence: { label: "Impure Sequence",  color: "#facc15", icon: "◈" },
  set:             { label: "Set",              color: "#60a5fa", icon: "◉" },
};

const cardShortName = (card) => {
  if (card?.joker) return "🃏";
  const suitIcon = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  return `${card.rank}${suitIcon[card.suit] || card.suit}`;
};

const DeclareModal = ({ result, onClose, onConfirm, confirming }) => {
  if (!result) return null;

  return (
    <div className="declare-overlay" onClick={onClose}>
      <div className="declare-modal" onClick={e => e.stopPropagation()}>
        {result.valid ? (
          <>
            <div className="declare-modal__icon declare-modal__icon--win">🏆</div>
            <h2 className="declare-modal__title declare-modal__title--win">Valid Declaration!</h2>
            <p className="declare-modal__subtitle">Your hand is complete. Declare to win the game.</p>
            <div className="declare-groups">
              {result.groups.map((group, i) => {
                const meta = GROUP_LABELS[group.type];
                return (
                  <div key={i} className="declare-group" style={{ "--group-color": meta.color }}>
                    <span className="declare-group__label">
                      <span className="declare-group__icon">{meta.icon}</span>
                      {meta.label}
                    </span>
                    <div className="declare-group__cards">
                      {group.cards.map(card => {
                        const isRed = card.suit === "hearts" || card.suit === "diamonds";
                        return (
                          <span
                            key={card.id}
                            className={`declare-card ${card?.joker ? "declare-card--joker" : ""} ${isRed ? "declare-card--red" : ""}`}
                          >
                            {cardShortName(card)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="declare-modal__actions">
              <button className="btn btn--ghost" onClick={onClose}>Review Hand</button>
              <button className="btn btn--declare-confirm" onClick={onConfirm} disabled={confirming}>
                {confirming ? "Declaring…" : "Confirm Declare"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="declare-modal__icon declare-modal__icon--fail">✗</div>
            <h2 className="declare-modal__title declare-modal__title--fail">Invalid Declaration</h2>
            <p className="declare-modal__subtitle">Fix these issues before declaring:</p>
            <ul className="declare-errors">
              {result.errors.map((err, i) => (
                <li key={i} className="declare-error">{err}</li>
              ))}
            </ul>
            <div className="declare-modal__actions">
              <button className="btn btn--start" onClick={onClose}>Continue Playing</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Room = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const dragSrcId = useRef(null);

  const [playerId]   = useState(() => localStorage.getItem("playerId"));
  const [guestToken] = useState(() => localStorage.getItem("guestToken"));

  const [roomState,    setRoomState]    = useState(null);
  const [gameState,    setGameState]    = useState(null);
  const [myHand,       setMyHand]       = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [draggingId,   setDraggingId]   = useState(null);
  const [hasDrawn,     setHasDrawn]     = useState(false);
  const [phase,        setPhase]        = useState("playing");
  const [winner,       setWinner]       = useState(null);
  const [toasts,       setToasts]       = useState([]);
  const [connected,    setConnected]    = useState(false);
  const [declareResult,  setDeclareResult]  = useState(null); // { valid, errors, groups }
  const [declareConfirming, setDeclareConfirming] = useState(false);

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
      setRoomState(state);
      if (state.status === "in_progress") setPhase("playing");
      if (state.status === "waiting") navigate(`/lobby/${roomCode}`);
    });

    socket.on("player_joined", ({ username: u }) => addToast(`${u} joined`, "info"));
    socket.on("player_left", () => addToast("A player disconnected", "warn"));

    socket.on("game_started", (state) => {
      setPhase("playing");
      setHasDrawn(false);
      setGameState({
        drawPileSize:        state.drawPileSize,
        discardPileTop:      state.discardPile?.[0] || null,
        currentTurnPlayerId: state.currentTurnPlayerId,
        players:             state.players,
      });
      addToast("Game started! Cards dealt.", "success");
    });

    socket.on("hand_updated", ({ hand }) => {
      // Merge incoming hand into existing local order:
      // 1. Keep cards still in the new hand, preserving user's arrangement
      // 2. Append any new cards (just drawn) at the end
      setMyHand(prev => {
        const newIds  = new Set(hand.map(c => c.id));
        const kept    = prev.filter(c => newIds.has(c.id));
        const keptIds = new Set(kept.map(c => c.id));
        const added   = hand.filter(c => !keptIds.has(c.id));
        return [...kept, ...added];
      });
      setSelectedCard(null);
    });

    socket.on("game_restored", (state) => {
      setPhase("playing");
      setMyHand(state.hand);
      setSelectedCard(null);
      setHasDrawn(false);
      setGameState({
        drawPileSize:        state.drawPileSize,
        discardPileTop:      state.discardPileTop,
        currentTurnPlayerId: state.currentTurnPlayerId,
        players:             state.players,
      });
    });

    socket.on("card_drawn", ({ playerId: pid, drawPileSize, discardPileTop, source, card }) => {
      setGameState(prev => prev ? {
        ...prev,
        drawPileSize,
        ...(discardPileTop !== undefined ? { discardPileTop } : {}),
      } : prev);
      if (pid === playerId) {
        setHasDrawn(true);
      } else {
        const src = source === "discard" ? `discard pile (${card?.rank} of ${card?.suit})` : "deck";
        addToast(`Opponent drew from ${src}`, "info");
      }
    });

    socket.on("card_played", ({ playerId: pid, card, discardPileTop, nextTurnPlayerId, playerCardCount }) => {
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
      if (pid !== playerId) addToast(`Opponent played ${card.rank} of ${card.suit}`, "info");
      setHasDrawn(false);
    });

    socket.on("game_over", ({ winnerId }) => {
      setPhase("over");
      setWinner(winnerId === playerId ? "You" : "Opponent");
    });

    socket.on("declare_invalid", ({ errors }) => {
      // Server-side validation failed (shouldn't normally differ from client, but safety net)
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
  const handleDrawDiscard  = () => socketRef.current?.emit("draw_from_discard");
  const handlePlayCard     = () => { if (selectedCard) socketRef.current?.emit("play_card", { cardId: selectedCard.id }); };

  const handleDeclare = () => {
    if (!selectedCard) return;
    // Validate the 13-card hand AFTER discarding the selected card
    const handAfterDiscard = myHand.filter(c => c.id !== selectedCard.id);
    const result = validateRummyHand(handAfterDiscard);
    setDeclareResult(result);
    setDeclareConfirming(false);
  };

  const handleDeclareConfirm = () => {
    if (!selectedCard) return;
    // Server will discard this card first, then validate the remaining 13
    setDeclareConfirming(true);
    socketRef.current?.emit("declare_hand", { discardCardId: selectedCard.id });
  };

  const handleDeclareClose = () => {
    setDeclareResult(null);
    setDeclareConfirming(false);
  };

  // HTML5 drag handlers — use stable card.id, suppress ghost image
  const onDragStart = (e, cardId) => {
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => document.body.removeChild(ghost));
    dragSrcId.current = cardId;
    setDraggingId(cardId);
  };

  const onDragEnter = (e, targetId) => {
    e.preventDefault();
    const srcId = dragSrcId.current;
    if (!srcId || srcId === targetId) return;
    setMyHand(prev => {
      const from = prev.findIndex(c => c.id === srcId);
      const to   = prev.findIndex(c => c.id === targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onDragEnd = () => { dragSrcId.current = null; setDraggingId(null); };

  const isMyTurn        = gameState?.currentTurnPlayerId === playerId;
  const allPlayers      = roomState?.players || [];
  const opponents       = allPlayers.filter(p => p.playerId !== playerId);
  const selfPlayer      = allPlayers.find(p => p.playerId === playerId);
  const canDrawDiscard  = isMyTurn && !hasDrawn && !!gameState?.discardPileTop;

  // ── Game over ─────────────────────────────────────────────────────────────
  if (phase === "over") {
    return (
      <div className="room room--over">
        <div className="over__panel">
          <div className="over__title">{winner === "You" ? "🏆" : "💀"}</div>
          <h1 className="over__heading">{winner === "You" ? "You Win!" : `${winner} Wins`}</h1>
          <button className="btn btn--start" onClick={() => navigate("/")}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  // ── Game board ────────────────────────────────────────────────────────────
  return (
    <div className="room room--game">
      <div className="table__felt" />

      <header className="room__header">
        <div className="room__code-tag">{roomCode}</div>
        <div className={`room__conn ${connected ? "room__conn--on" : ""}`}>
          <span className="room__conn-dot" /> {connected ? "live" : "reconnecting"}
        </div>
        <div className={`room__turn-badge ${isMyTurn ? "room__turn-badge--active" : ""}`}>
          {isMyTurn ? "YOUR TURN" : "Waiting…"}
        </div>
      </header>

      <div className="opponents">
        {opponents.map(p => (
          <PlayerSeat key={p.playerId} player={p}
            isCurrentTurn={gameState?.currentTurnPlayerId === p.playerId} isSelf={false} />
        ))}
      </div>

      <div className="table__center">
        <CardBack
          label="DRAW"
          count={gameState?.drawPileSize ?? "–"}
          onClick={handleDrawFromDeck}
          disabled={!isMyTurn || hasDrawn}
        />
        <div className="pile pile--discard">
          {gameState?.discardPileTop ? (
            <button
              className={`discard-top ${canDrawDiscard ? "discard-top--drawable" : ""}`}
              onClick={canDrawDiscard ? handleDrawDiscard : undefined}
            >
              <img
                src={cardImg(gameState.discardPileTop)}
                alt={`${gameState.discardPileTop.rank} of ${gameState.discardPileTop.suit}`}
                draggable={false}
              />
            </button>
          ) : (
            <div className="pile__empty">Discard</div>
          )}
          <span className="pile__label">{canDrawDiscard ? "TAP TO DRAW" : "DISCARD"}</span>
        </div>
      </div>

      <div className="self-area">
        {selfPlayer && (
          <PlayerSeat
            player={{ ...selfPlayer, cardCount: myHand.length }}
            isCurrentTurn={isMyTurn}
            isSelf
          />
        )}
      </div>

      <div className="hand">
        <div className="hand__cards" onDragOver={e => e.preventDefault()}>
          {myHand.map(card => (
            <button
              key={card.id}
              draggable
              className={[
                "card-face",
                "card-face--draggable",
                selectedCard?.id === card.id ? "card-face--selected" : "",
                draggingId === card.id     ? "card-face--ghost"    : "",
              ].join(" ")}
              onDragStart={e => onDragStart(e, card.id)}
              onDragEnter={e => onDragEnter(e, card.id)}
              onDragOver={e => e.preventDefault()}
              onDragEnd={onDragEnd}
              onClick={() => setSelectedCard(prev => prev?.id === card.id ? null : card)}
            >
              <img src={cardImg(card)} alt={`${card.rank} of ${card.suit}`} draggable={false} />
            </button>
          ))}
          {myHand.length === 0 && <p className="hand__empty">Your hand is empty</p>}
        </div>

        {isMyTurn && (
          <div className="hand__actions">
            {!hasDrawn && (
              <button className="btn btn--draw" onClick={handleDrawFromDeck} disabled={!gameState?.drawPileSize}>
                Draw from Deck
              </button>
            )}
            {hasDrawn && (
              <button className="btn btn--play" onClick={handlePlayCard} disabled={!selectedCard}>
                {selectedCard ? `Discard ${selectedCard.rank} of ${selectedCard.suit}` : "Select a card to discard"}
              </button>
            )}
            {hasDrawn && selectedCard && (
              <button className="btn btn--declare" onClick={handleDeclare}>
                <span className="btn__declare-icon">⚑</span>
                Declare
              </button>
            )}
            {hasDrawn && !selectedCard && (
              <p className="hand__hint">Tap a card to select it, then discard</p>
            )}
          </div>
        )}
      </div>

      <DeclareModal
        result={declareResult}
        onClose={handleDeclareClose}
        onConfirm={handleDeclareConfirm}
        confirming={declareConfirming}
      />

      <Toast messages={toasts} />
    </div>
  );
};

export default Room;