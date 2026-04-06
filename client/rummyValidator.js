// ─── Constants ────────────────────────────────────────────────────────────────

const RANK_VALUE = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isJoker = (card) => !!card?.joker;

/**
 * Numeric value of a card rank. Ace = 1 by default; caller passes 14 for high ace.
 */
const rankVal = (card, aceHigh = false) =>
  card.rank === 'A' && aceHigh ? 14 : RANK_VALUE[card.rank];

// ─── Group Validators ─────────────────────────────────────────────────────────

/**
 * Check whether `cards` form a valid sequence (run of same suit, consecutive ranks).
 * Jokers fill gaps or extend. Ace can be low (A-2-3) or high (Q-K-A).
 *
 * Returns: null | { pure: boolean }
 */
const checkSequence = (cards) => {
  if (cards.length < 3) return null;

  const jokers = cards.filter(isJoker);
  const naturals = cards.filter((c) => !isJoker(c));
  const jokerCount = jokers.length;

  // All natural cards must share the same suit
  const suits = new Set(naturals.map((c) => c.suit));
  if (suits.size > 1) return null;

  // No duplicate natural ranks allowed in a sequence
  const rawRanks = naturals.map((c) => c.rank);
  if (new Set(rawRanks).size !== rawRanks.length) return null;

  // Try with ace-low, then ace-high
  const aceVariants = rawRanks.includes('A') ? [false, true] : [false];

  for (const aceHigh of aceVariants) {
    const vals = naturals.map((c) => rankVal(c, aceHigh)).sort((a, b) => a - b);

    // span of the natural cards
    const span = vals[vals.length - 1] - vals[0] + 1;

    // gaps that jokers must fill inside the natural span
    const internalGaps = span - vals.length;

    if (internalGaps > jokerCount) continue;          // not enough jokers to fill gaps
    if (span > 13) continue;                           // impossible range (e.g. A-high wraps past K=13)

    // jokers remaining after filling gaps can extend the sequence at either end
    const jokersLeft = jokerCount - internalGaps;
    const totalLen = span + jokersLeft;               // natural span + extensions

    if (totalLen !== cards.length) continue;           // length mismatch

    return { pure: jokerCount === 0 };
  }

  return null;
};

/**
 * Check whether `cards` form a valid set (same rank, different suits, 3–4 cards).
 * Jokers substitute for any missing suit.
 *
 * Returns: null | { pure: boolean }
 */
const checkSet = (cards) => {
  if (cards.length < 3 || cards.length > 4) return null;

  const jokers = cards.filter(isJoker);
  const naturals = cards.filter((c) => !isJoker(c));

  // All natural cards must share the same rank
  const ranks = new Set(naturals.map((c) => c.rank));
  if (ranks.size !== 1) return null;

  // All natural cards must have distinct suits
  const suits = naturals.map((c) => c.suit);
  if (new Set(suits).size !== suits.length) return null;

  // Jokers fill however many slots remain — always valid as long as above passes
  return { pure: jokers.length === 0 };
};

/**
 * Classify a group of cards.
 * Returns: null | { type: 'pure_sequence'|'impure_sequence'|'pure_set'|'impure_set', cards }
 */
const classifyGroup = (cards) => {
  const seq = checkSequence(cards);
  if (seq) {
    return { cards, type: seq.pure ? 'pure_sequence' : 'impure_sequence' };
  }

  const set = checkSet(cards);
  if (set) {
    return { cards, type: set.pure ? 'pure_set' : 'impure_set' };
  }

  return null;
};

// ─── Partition Search ─────────────────────────────────────────────────────────

/** All k-combinations of arr */
const combinations = (arr, k) => {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [first, ...c]),
    ...combinations(rest, k),
  ];
};

/**
 * Recursively find a valid partition of `cards` into groups of sizes given by `sizes[]`.
 * Returns array of classified groups, or null if impossible.
 */
const findValidPartition = (cards, sizes) => {
  if (sizes.length === 0) return cards.length === 0 ? [] : null;

  const [size, ...restSizes] = sizes;
  const combos = combinations(cards, size);

  for (const group of combos) {
    const classified = classifyGroup(group);
    if (!classified) continue;

    const groupIds = new Set(group.map((c) => c.id));
    const remaining = cards.filter((c) => !groupIds.has(c.id));

    const subResult = findValidPartition(remaining, restSizes);
    if (subResult !== null) return [classified, ...subResult];
  }

  return null;
};

// ─── Split-aware validation helpers ──────────────────────────────────────────

/**
 * Parse a split key like "3-4" into [3, 4].
 */
const parseSplitKey = (key) => key.split('-').map(Number);

/**
 * Validate groups strictly according to player's chosen split.
 * Cards are already ordered; groups are slices of that ordered array.
 * Returns array of classified groups or null.
 */
const validateWithSplit = (cards, splitKey) => {
  const sizes = parseSplitKey(splitKey);
  if (sizes.reduce((a, b) => a + b, 0) !== cards.length) return null;

  const groups = [];
  let idx = 0;
  for (const size of sizes) {
    const slice = cards.slice(idx, idx + size);
    const classified = classifyGroup(slice);
    if (!classified) return null;
    groups.push(classified);
    idx += size;
  }
  return groups;
};

// ─── Sequence / purity rules per hand size ────────────────────────────────────

/**
 * Given the classified groups and hand size, check sequence requirements.
 * Returns array of error strings (empty = OK).
 *
 * Rules:
 *  7-card:  ≥1 sequence, must be pure
 * 10-card:  ≥2 sequences, ≥1 must be pure
 * 13-card:  ≥2 sequences, ≥1 must be pure
 *
 * For 7-card with split [3,4]: the OTHER group can be set/sequence/impure —
 * but at least one of the two groups must be a sequence.
 */
const checkSequenceRules = (groups, handSize) => {
  const errors = [];

  const isSeq = (g) => g.type === 'pure_sequence' || g.type === 'impure_sequence';
  const isPure = (g) => g.type === 'pure_sequence';

  const sequences = groups.filter(isSeq);
  const pureSeqs = groups.filter(isPure);

  if (handSize === 7) {
    if (sequences.length < 1) {
      errors.push('Need at least 1 sequence (the 3-card or 4-card group must be a sequence).');
    }
    if (pureSeqs.length < 1) {
      errors.push('Need at least 1 pure sequence (no jokers).');
    }
  } else {
    // 10 or 13
    if (sequences.length < 2) {
      errors.push(`Need at least 2 sequences (have ${sequences.length}).`);
    }
    if (pureSeqs.length < 1) {
      errors.push('Need at least 1 pure sequence (no jokers).');
    }
  }

  return errors;
};

// ─── Allowed split patterns ───────────────────────────────────────────────────

const ALLOWED_SPLITS = {
  7:  [['3-4']],
  10: [['3-3-4', '5-5']],
  13: [['3-3-3-4', '3-5-5', '4-4-5']],
};

// ─── Main Validator ───────────────────────────────────────────────────────────

/**
 * Validate a Rummy hand.
 *
 * @param {object[]} hand       - Ordered array of card objects (already excludes drawn/discarded card).
 *                                Length must be 7, 10, or 13.
 * @param {string|null} splitKey - e.g. "3-4" | "3-3-4" | null (auto-find).
 *
 * @returns {{ valid: boolean, errors: string[], groups?: object[] }}
 */
export const validateRummyHand = (hand, splitKey = null) => {
  const errors = [];
  const handSize = hand.length;

  // ── 1. Hand size check ──────────────────────────────────────────────────────
  if (![7, 10, 13].includes(handSize)) {
    return {
      valid: false,
      errors: [`Hand must have 7, 10, or 13 cards (got ${handSize}).`],
    };
  }

  // ── 2. Find / validate groups ───────────────────────────────────────────────
  let groups = null;

  if (splitKey) {
    // Player chose a specific grouping — validate that exact split
    const sizes = parseSplitKey(splitKey);
    const totalCards = sizes.reduce((a, b) => a + b, 0);

    if (totalCards !== handSize) {
      return {
        valid: false,
        errors: [`Split "${splitKey}" totals ${totalCards} but hand has ${handSize} cards.`],
      };
    }

    groups = validateWithSplit(hand, splitKey);

    if (!groups) {
      return {
        valid: false,
        errors: ['One or more of your chosen groups is not a valid sequence or set.'],
      };
    }
  } else {
    // Auto-find any valid partition
    const splits = ALLOWED_SPLITS[handSize].flat();
    for (const key of splits) {
      const sizes = parseSplitKey(key);
      groups = findValidPartition(hand, sizes);
      if (groups) break;
    }

    if (!groups) {
      return {
        valid: false,
        errors: ['Cannot form valid sequences and sets from this hand.'],
      };
    }
  }

  // ── 3. Sequence / purity rules ──────────────────────────────────────────────
  const seqErrors = checkSequenceRules(groups, handSize);
  errors.push(...seqErrors);

  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, errors: [], groups };
};

// Alias used by server
export const serverValidateDeclare = (hand, splitKey = null) =>
  validateRummyHand(hand, splitKey);