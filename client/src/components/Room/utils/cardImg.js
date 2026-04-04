import backImg from "../../../assets/cards/back.png";

export const cardImg = (card) => {
  if (!card) return backImg;

  if (card.joker) {
    const jokerFile = typeof card.joker === "string" ? card.joker.toUpperCase() : `JOKER${card.joker}`;
    return new URL(`../../../assets/cards/${jokerFile}.png`, import.meta.url).href;
  }

  const rankMap = { J: "J", Q: "Q", K: "K", A: "A" };
  const suitMap = { spades: "S", hearts: "H", diamonds: "D", clubs: "C" };
  const r = rankMap[card.rank] || card.rank;
  const s = suitMap[card.suit] || card.suit;
  return new URL(`../../../assets/cards/${r}${s}.png`, import.meta.url).href;
};
