import { pfpSrc } from "../utils/pfpSrc";

// Oval: width=80vw, height=50vh, center=(50vw, 39vh) [4vh padding-top + 10vh margin + 25vh half-height]
// Positions computed via parametric ellipse: x = 50 + 40·cos(θ), y = 39 + 25·sin(θ)
// transform: translate(-50%,-50%) centres the avatar on the edge point
// Each position adjusted -3vh to sit above the oval edge

const SEAT_POSITIONS = [
  { left: "12vw",   top: "28.3vh" }, // seat 0 — far left       (θ=198°)
  { left: "26.5vw", top: "15.8vh" }, // seat 1 — upper-left     (θ=234°)
  { left: "50vw",   top: "11vh"   }, // seat 2 — top center     (θ=270°)
  { left: "73.5vw", top: "15.8vh" }, // seat 3 — upper-right    (θ=306°)
  { left: "88vw",   top: "28.3vh" }, // seat 4 — far right      (θ=342°)
];

// Which seat indices to use for N opponents
const SEAT_MAP = {
  1: [2],
  2: [1, 3],
  3: [1, 2, 3],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
};

const OpponentPanel = ({ opponents, currentTurnPlayerId, allPlayers, playerId }) => {
  // Sort all players by their index in allPlayers (which reflects join/turn order)
  // Then rotate so that self is always at the "bottom" (index 0 after rotation)
  const selfIndex = allPlayers.findIndex(p => p.playerId === playerId);

  // Rotate allPlayers so self is first, then opponents follow in turn order
  const rotated = [
    ...allPlayers.slice(selfIndex),
    ...allPlayers.slice(0, selfIndex),
  ];

  // opponents in rotated order (everyone except self)
  const orderedOpponents = rotated.filter(p => p.playerId !== playerId);

  const count = Math.min(orderedOpponents.length, 5);
  const seatIndices = SEAT_MAP[count] || [];

  return (
    <>
      {orderedOpponents.slice(0, 5).map((p, i) => {
        const pos = SEAT_POSITIONS[seatIndices[i]];
        if (!pos) return null;
        const isCurrentTurn = currentTurnPlayerId === p.playerId;
        return (
          <div
            key={p.playerId}
            className="opponent"
            style={{ position: "fixed", left: pos.left, top: pos.top, transform: "translate(-50%, -50%)" }}
          >
            <span className="opponent__name">{p.username}</span>
            <div className={`opponent__avatar ${isCurrentTurn ? "opponent__avatar--active" : ""}`}>
              <img src={pfpSrc(p.pfp)} alt={p.username} />
            </div>
          </div>
        );
      })}
    </>
  );
};

export default OpponentPanel;