import { useState } from "react";
import PlayerSeat from "./PlayerSeat";
import GroupSplitMenu from "./GroupSplitMenu";
import { cardImg } from "../utils/cardImg";

function parseSplit(splitKey) {
  if (!splitKey) return null;
  return splitKey.split("-").map(Number);
}

/**
 * Build grouped items from the "keep" cards (all but the last).
 * Returns an array of groups; each group is an array of cards.
 */
function buildGroupedItems(keepCards, splitKey) {
  const groups = parseSplit(splitKey);
  if (!groups || groups.reduce((a, b) => a + b, 0) !== keepCards.length) {
    return [keepCards];
  }
  const result = [];
  let idx = 0;
  groups.forEach((size) => {
    result.push(keepCards.slice(idx, idx + size));
    idx += size;
  });
  return result;
}

/** Render a single draggable card button */
function CardButton({ card, selectedCard, draggingId, onSelectCard, onDragStart, onDragEnter, onDragEnd }) {
  return (
    <button
      key={card.id}
      draggable
      className={[
        "card-face",
        "card-face--draggable",
        selectedCard?.id === card.id ? "card-face--selected" : "",
        draggingId === card.id ? "card-face--ghost" : "",
      ].join(" ")}
      onDragStart={e => onDragStart(e, card.id)}
      onDragEnter={e => onDragEnter(e, card.id)}
      onDragOver={e => e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={() => onSelectCard(card)}
    >
      <img
        src={cardImg(card)}
        alt={card.joker ? "Joker" : `${card.rank} of ${card.suit}`}
        draggable={false}
      />
    </button>
  );
}

const SelfPanel = ({
  selfPlayer,
  myHand,
  isMyTurn,
  hasDrawn,
  selectedCard,
  draggingId,
  onSelectCard,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrawDeck,
  onDiscard,
  onDeclare,
  drawPileSize,
}) => {
  const [activeSplit, setActiveSplit] = useState(null);

  // Discard slot only appears AFTER the player has drawn a card
  const showDiscardSlot = hasDrawn && myHand.length > 0;
  const keepCards = showDiscardSlot ? myHand.slice(0, -1) : myHand;
  const discardCard = showDiscardSlot ? myHand[myHand.length - 1] : null;
  const groupedItems = buildGroupedItems(keepCards, activeSplit);

  return (
    <>
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
        <div className="hand__top">
          <div className="hand__title-row">
            <h2 className="hand__title">Your Hand</h2>
            {/* Split menu based on keep-card count (N-1) */}
            {keepCards.length > 0 && (
              <GroupSplitMenu
                cardCount={keepCards.length}
                activeSplit={activeSplit}
                onApplySplit={setActiveSplit}
              />
            )}
          </div>

          {isMyTurn && (
            <div className="hand__actions">
              {!hasDrawn && (
                <button className="btn btn--draw" onClick={onDrawDeck} disabled={!drawPileSize}>
                  Draw from Deck
                </button>
              )}
              {hasDrawn && (
                <button className="btn btn--play" onClick={onDiscard} disabled={!selectedCard}>
                  {selectedCard
                    ? (selectedCard.joker ? "Discard Joker" : `Discard ${selectedCard.rank} of ${selectedCard.suit}`)
                    : "Select a card to discard"}
                </button>
              )}
              {hasDrawn && selectedCard && (
                <button className="btn btn--declare" onClick={() => onDeclare(activeSplit)}>
                  <span className="btn__declare-icon">⚑</span>
                  Declare
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="hand__cards-row">
          {/* Grouped keep cards */}
          <div className="hand__cards" onDragOver={e => e.preventDefault()} onDragEnd={onDragEnd}>
            {groupedItems.map((group, gi) => (
              <div
                key={gi}
                className={`hand__group${activeSplit ? " hand__group--split" : ""}`}
              >
                {group.map(card => (
                  <CardButton
                    key={card.id}
                    card={card}
                    selectedCard={selectedCard}
                    draggingId={draggingId}
                    onSelectCard={onSelectCard}
                    onDragStart={onDragStart}
                    onDragEnter={onDragEnter}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            ))}
            {myHand.length === 0 && <p className="hand__empty">Your hand is empty</p>}
          </div>

          {/* Discard slot — always the last card, visually separated */}
          {discardCard && (
            <div className="hand__discard-slot">
              <span className="hand__discard-label">Discard</span>
              <CardButton
                key={discardCard.id}
                card={discardCard}
                selectedCard={selectedCard}
                draggingId={draggingId}
                onSelectCard={onSelectCard}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragEnd={onDragEnd}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SelfPanel;