import { cardImg } from "../utils/cardImg";

const CardBack = ({ label, count, onClick, disabled }) => (
  <button className={`pile pile--back ${disabled ? "pile--disabled" : ""}`} onClick={onClick} disabled={disabled}>
    <img src={cardImg(null)} alt="deck" draggable={false} />
    <span className="pile__count">{count}</span>
    {label && <span className="pile__label">{label}</span>}
  </button>
);

const RoomCenter = ({ gameState, isMyTurn, hasDrawn, canDrawDiscard, onDrawDeck, onDrawDiscard }) => (
  <div className="table__center">
    <CardBack
      label="DRAW"
      count={gameState?.drawPileSize ?? "–"}
      onClick={onDrawDeck}
      disabled={!isMyTurn || hasDrawn}
    />
    <div className="pile pile--discard">
      {gameState?.discardPileTop ? (
        <button
          className={`discard-top ${canDrawDiscard ? "discard-top--drawable" : ""}`}
          onClick={canDrawDiscard ? onDrawDiscard : undefined}
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
);

export default RoomCenter;