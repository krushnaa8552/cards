import { cardImg } from '../Room/utils/cardImg';
import { pfpSrc } from '../Room/utils/pfpSrc';
import './GameOver.css';

const GameOverScreen = ({ winnerId, winnerName, allHands, playerId, onBack }) => {
  const isWinner = winnerId === playerId;

  // Winner first, then everyone else
  const sorted = [...(allHands || [])].sort((a, b) => {
    if (a.playerId === winnerId) return -1;
    if (b.playerId === winnerId) return 1;
    return 0;
  });

  return (
    <div className="go-screen">
      {/* title */}
      <div className="go-title-section">
        {isWinner
          ? <h1 className="go-title go-title--win">YOU WON</h1>
          : <h1 className="go-title go-title--lose">{winnerName || 'Opponent'} WON</h1>
        }
      </div>

      {/* results table */}
      <div className="go-table-wrapper">
        <table className="go-table">
          <thead>
            <tr className="go-thead-row">
              <th className="go-th go-th--player">Player</th>
              <th className="go-th go-th--hand">Hand</th>
              <th className="go-th go-th--score">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isThisWinner = p.playerId === winnerId;
              const isMe = p.playerId === playerId;
              return (
                <tr
                  key={p.playerId}
                  className={`go-row${isThisWinner ? ' go-row--winner' : ''}`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {/* Player column */}
                  <td className="go-td go-td--player">
                    <div className="go-player-cell">
                      <img
                        src={pfpSrc(p.pfp || 'avatar')}
                        alt={p.username}
                        className="go-pfp"
                      />
                      <span className="go-username">
                        {isMe ? `${p.username} (you)` : p.username}
                      </span>
                    </div>
                  </td>

                  {/* Hand column */}
                  <td className="go-td go-td--hand">
                    <div className="go-cards-row">
                      {(p.hand || []).length > 0 ? (
                        p.hand.map(card => (
                          <img
                            key={card.id}
                            src={cardImg(card)}
                            alt={card.joker ? 'Joker' : `${card.rank} of ${card.suit}`}
                            className="go-card"
                            draggable={false}
                          />
                        ))
                      ) : (
                        <span className="go-no-cards">—</span>
                      )}
                    </div>
                  </td>

                  {/* Score column — intentionally blank */}
                  <td className="go-td go-td--score">
                    <span className="go-score">—</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* footer */}
      <div className="go-footer">
        <button className="go-btn-back" onClick={onBack}>Back to Lobby</button>
      </div>
    </div>
  );
};

export default GameOverScreen;