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

export default PlayerSeat;