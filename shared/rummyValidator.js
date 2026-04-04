/*
Rules to enforced:
- 13 cards per person, unless a card is drawn
- atleast 2 sequences
- atleast 1 of the 2 sequences must be pure (no joker) and the other may or may not be impure (with joker)
- remaining groups must be either sets (same rank) or sequences
- joker can be any card
*/

const RANK_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const rankIndex = (rank) => RANK_ORDER.indexOf(rank);
const isJoker = (card) => !!card?.joker;

// group validators

const checkSequence = (cards) => {
    if (cards.length < 3) return null;

    const nonJokers = cards.filter(c => !isJoker(c));
    const jokerCount = cards.length - nonJokers.length;

    const suits = new Set(nonJokers.map(c => c.suit));
    if (suits.size !== 1) return null;

    const ranks = nonJokers.map(c => rankIndex(c.rank));
    if (new Set(ranks).size !== ranks.length) return null;

    const sorted = [...ranks].sort((a, b) => a - b);

    const trySequence = [sorted];
    if (sorted.includes(0)) {
        const highAce = sorted.map(r => r === 0 ? 13 : r).sort((a, b) => a - b);
        trySequence.push(highAce);
    }

    for (const seq of trySequence) {
        const span = seq[seq.length - 1] - seq[0] + 1;
        const gaps = span - seq.length;
        const jokersUsedForGaps = Math.min(gaps, jokerCount);
        if (gaps > jokerCount) continue;
        if (span > 13) continue;

        const jokersAsExtension = jokerCount - jokersUsedForGaps;
        const totalSpan = span + jokersAsExtension;

        if (totalSpan === cards.length) {
            return { valid: true, pure: jokerCount === 0 };
        }
    }

    return null;
}

const checkSet = (cards) => {
    if (cards.length < 3 || cards.length > 4) return null;
    
    const nonJokers = cards.filter(c => !isJoker(c));

    const ranks = new Set(nonJokers.map(c => c.rank));
    if (ranks.size !== 1) return null;

    const suits = nonJokers.map(c => c.suit);
    if (new Set(suits).size !== suits.length) return null;

    return { valid: true };
}

const classifyGroup = (cards) => {
    const seqResult = checkSequence(cards);
    if (seqResult?.valid) {
        return { cards, type: seqResult.pure ? 'pure_sequence': 'impure_sequence' };
    }

    const setResult = checkSet(cards);
    if (setResult?.valid) {
        return { cards, type: 'set' }
    }
    
    return null;
}

const combinations = (arr, k) => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    return [
        ...combinations(rest, k - 1).map(c => [first, ...c]),
        ...combinations(rest, k)
    ];
}

const findValidPartition = (cards, groupSizes) => {
    if (groupSizes.length === 0) {
        return cards.length === 0 ? [] : null;
    }

    const [size, ...restSizes] = groupSizes;
    const combos = combinations(cards, size);

    for (const group of combos) {
        const classified = classifyGroup(group);
        if (!classified) continue;

        const groupIds = new Set(group.map(c => c.id));
        const rest = cards.filter(c => !groupIds.has(c.id));

        const subResult = findValidPartition(rest, restSizes);
        if (subResult !== null) return [classified, ...subResult];
    }

    return null;
}

//main validator
export const validateRummyHand = (hand, activeSplit = null) => {
    const errors = [];
    const handSize = hand.length;

    if (![7, 10, 13].includes(handSize)) {
        errors.push(`hand must have 7, 10 or 13 cards (has ${handSize})`);
        return { valid: false, errors }
    }

    let groups = null;

    if (activeSplit) {
        const sizes = activeSplit.split('-').map(Number);
        if (sizes.reduce((a, b) => a + b, 0) !== handSize) {
            errors.push('split configuration does not match hand size');
            return { valid: false, errors };
        }
        
        const candidateGroups = [];
        let idx = 0;
        let validStrict = true;
        
        for (const size of sizes) {
            const groupCards = hand.slice(idx, idx + size);
            const classified = classifyGroup(groupCards);
            if (!classified) {
                validStrict = false;
                break;
            }
            candidateGroups.push(classified);
            idx += size;
        }
        
        if (validStrict) {
            groups = candidateGroups;
        }
    } else {
        // HARD-CODED GROUP PATTERNS
        const GROUP_PATTERNS = {
            7: [[3, 4]],
            10: [[3, 3, 4], [5, 5]],
            13: [[3, 3, 3, 4], [3, 5, 5], [4, 4, 5]]
        };

        const allowedSplits = GROUP_PATTERNS[handSize];

        for (const sizes of allowedSplits) {
            groups = findValidPartition(hand, sizes);
            if (groups) break;
        }
    }

    if (!groups) {
        errors.push(activeSplit 
            ? 'The chosen card groups are not all valid sequences or sets.' 
            : 'cannot form valid sequences and sets from this hand');
        return { valid: false, errors };
    }

    const minSequences = handSize === 7 ? 1 : 2;

    const pureSequences = groups.filter(g => g.type === 'pure_sequence');
    const allSequences = groups.filter(g => g.type === 'pure_sequence' || g.type === 'impure_sequence');

    if (allSequences.length < minSequences) {
        errors.push(`need at least ${minSequences} sequence${minSequences > 1 ? 's' : ''}`);
    }

    if (pureSequences.length < 1) {
        errors.push(`No pure sequence found`);
    }

    if (errors.length > 0) return { valid: false, errors };

    return { valid: true, errors: [], groups };
}

export const serverValidateDeclare = (hand, activeSplit = null) => validateRummyHand(hand, activeSplit);