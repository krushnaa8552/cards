const RoomTopBar = ({ roomCode, connected, isMyTurn }) => (
  <header className="room__header">
    <div className="room__code-tag">{roomCode}</div>
    <div className={`room__conn ${connected ? "room__conn--on" : ""}`}>
      <span className="room__conn-dot" /> {connected ? "live" : "reconnecting"}
    </div>
    <div className={`room__turn-badge ${isMyTurn ? "room__turn-badge--active" : ""}`}>
      {isMyTurn ? "YOUR TURN" : "Waiting…"}
    </div>
  </header>
);

export default RoomTopBar;