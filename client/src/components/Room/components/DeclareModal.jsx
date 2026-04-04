const GROUP_LABELS = {
  pure_sequence:   { label: "Pure Sequence",   color: "#4ade80", icon: "✦" },
  impure_sequence: { label: "Impure Sequence",  color: "#facc15", icon: "◈" },
  set:             { label: "Set",              color: "#60a5fa", icon: "◉" },
};

const cardShortName = (card) => {
  if (card?.joker) return "🃏";
  const suitIcon = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
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

export default DeclareModal;