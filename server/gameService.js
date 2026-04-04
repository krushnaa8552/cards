/**
 * gameService.js
 * Pure game logic: deck creation, shuffling, dealing.
 * Keeps socket handler and DB layer clean.
 */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JOKERS = ['JOKER1', 'JOKER2'];

/**
 * Build a standard 52-card deck.
 */
export const buildDeck = () => {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, id: `${rank}_${suit}` });
        }
    }

    for (const joker of JOKERS) {
        deck.push({ suit: null, rank: null, joker, id: joker})
    }

    return deck;
};

/**
 * Fisher-Yates shuffle, optionally seeded.
 * Pass a numeric seed for reproducibility (stored in DB).
 */
export const shuffleDeck = (deck, seed = null) => {
    const d = [...deck];
    // Simple seeded PRNG (mulberry32) so the same seed always yields same shuffle
    const rand = seed !== null ? mulberry32(seed) : Math.random;

    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
};

const mulberry32 = (seed) => {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * Deal `count` cards from the top of the deck.
 * Returns { hand, remaining }.
 */
export const dealCards = (deck, count) => {
    const hand = deck.slice(0, count);
    const remaining = deck.slice(count);
    return { hand, remaining };
};

/**
 * Deal `cardsPerPlayer` cards to each player in order.
 * Returns { hands: { [playerId]: Card[] }, drawPile: Card[] }
 */
export const dealToPlayers = (deck, playerIds, cardsPerPlayer = 13) => {
    let remaining = [...deck];
    const hands = {};
    for (const pid of playerIds) {
        const { hand, remaining: rest } = dealCards(remaining, cardsPerPlayer);
        hands[pid] = hand;
        remaining = rest;
    }
    return { hands, drawPile: remaining };
};

/**
 * Generate a random integer seed.
 */
export const generateSeed = () => Math.floor(Math.random() * 2 ** 31);