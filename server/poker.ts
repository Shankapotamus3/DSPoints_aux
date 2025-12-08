// 7-Card Draw Poker game logic

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface HandResult {
  rank: number;
  name: string;
  cards: Card[];
  highCards: number[];
}

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return function() {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

export function shuffleDeck(deck: Card[], seed: string): Card[] {
  const shuffled = [...deck];
  const random = seededRandom(seed);
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

export function dealCards(seed: string): { player1Cards: Card[], player2Cards: Card[], remainingDeck: Card[] } {
  const deck = shuffleDeck(createDeck(), seed);
  return {
    player1Cards: deck.slice(0, 7),
    player2Cards: deck.slice(7, 14),
    remainingDeck: deck.slice(14)
  };
}

export function drawReplacementCards(
  currentCards: Card[],
  discardIndices: number[],
  remainingDeck: Card[],
  startIndex: number
): Card[] {
  const newCards = [...currentCards];
  for (let i = 0; i < discardIndices.length; i++) {
    const idx = discardIndices[i];
    if (idx >= 0 && idx < 7 && startIndex + i < remainingDeck.length) {
      newCards[idx] = remainingDeck[startIndex + i];
    }
  }
  return newCards;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

export function stringToCard(str: string): Card {
  const suitChar = str[str.length - 1].toLowerCase();
  const rankStr = str.slice(0, -1);
  
  const suitMap: Record<string, Suit> = { 'h': 'hearts', 'd': 'diamonds', 'c': 'clubs', 's': 'spades' };
  const suit = suitMap[suitChar];
  const rank = rankStr as Rank;
  
  return { rank, suit };
}

export function cardsToStrings(cards: Card[]): string[] {
  return cards.map(cardToString);
}

export function stringsToCards(strings: string[]): Card[] {
  return strings.map(stringToCard);
}

function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

function sortCardsByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
}

function countRanks(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

function countSuits(cards: Card[]): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  for (const card of cards) {
    counts.set(card.suit, (counts.get(card.suit) || 0) + 1);
  }
  return counts;
}

function isFlush(cards: Card[]): boolean {
  return new Set(cards.map(c => c.suit)).size === 1;
}

function isStraight(cards: Card[]): boolean {
  const values = cards.map(c => getRankValue(c.rank)).sort((a, b) => a - b);
  
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i + 1] - values[i] !== 1) {
      if (values[0] === 2 && values[values.length - 1] === 14 && i === values.length - 2) {
        const aceAdjusted = [1, ...values.slice(0, -1)].sort((a, b) => a - b);
        let isAceLowStraight = true;
        for (let j = 0; j < aceAdjusted.length - 1; j++) {
          if (aceAdjusted[j + 1] - aceAdjusted[j] !== 1) {
            isAceLowStraight = false;
            break;
          }
        }
        return isAceLowStraight;
      }
      return false;
    }
  }
  return true;
}

function getFlushCards(cards: Card[]): Card[] | null {
  const suitCounts = countSuits(cards);
  for (const [suit, count] of Array.from(suitCounts.entries())) {
    if (count >= 5) {
      const flushCards = cards.filter(c => c.suit === suit);
      return sortCardsByRank(flushCards).slice(0, 5);
    }
  }
  return null;
}

function getStraightCards(cards: Card[]): Card[] | null {
  const uniqueRanks = new Map<number, Card>();
  for (const card of cards) {
    const value = getRankValue(card.rank);
    if (!uniqueRanks.has(value)) {
      uniqueRanks.set(value, card);
    }
  }
  
  const sortedValues = Array.from(uniqueRanks.keys()).sort((a, b) => b - a);
  
  for (let i = 0; i <= sortedValues.length - 5; i++) {
    let consecutive = true;
    for (let j = 0; j < 4; j++) {
      if (sortedValues[i + j] - sortedValues[i + j + 1] !== 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      return sortedValues.slice(i, i + 5).map(v => uniqueRanks.get(v)!);
    }
  }
  
  if (uniqueRanks.has(14) && uniqueRanks.has(2) && uniqueRanks.has(3) && uniqueRanks.has(4) && uniqueRanks.has(5)) {
    return [5, 4, 3, 2, 14].map(v => uniqueRanks.get(v === 14 ? 14 : v)!);
  }
  
  return null;
}

function getStraightFlushCards(cards: Card[]): Card[] | null {
  for (const suit of SUITS) {
    const suitCards = cards.filter(c => c.suit === suit);
    if (suitCards.length >= 5) {
      const straight = getStraightCards(suitCards);
      if (straight) {
        return straight;
      }
    }
  }
  return null;
}

export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate a hand');
  }
  
  const straightFlush = getStraightFlushCards(cards);
  if (straightFlush) {
    const highCard = getRankValue(straightFlush[0].rank);
    if (highCard === 14) {
      return {
        rank: HAND_RANKS.ROYAL_FLUSH,
        name: 'Royal Flush',
        cards: straightFlush,
        highCards: [14]
      };
    }
    return {
      rank: HAND_RANKS.STRAIGHT_FLUSH,
      name: 'Straight Flush',
      cards: straightFlush,
      highCards: [highCard]
    };
  }
  
  const rankCounts = countRanks(cards);
  const countArray = Array.from(rankCounts.entries());
  
  const quads = countArray.filter(([_, count]) => count === 4);
  if (quads.length > 0) {
    const quadRank = quads[0][0];
    const quadCards = cards.filter(c => c.rank === quadRank);
    const kicker = sortCardsByRank(cards.filter(c => c.rank !== quadRank))[0];
    return {
      rank: HAND_RANKS.FOUR_OF_A_KIND,
      name: 'Four of a Kind',
      cards: [...quadCards, kicker],
      highCards: [getRankValue(quadRank), getRankValue(kicker.rank)]
    };
  }
  
  const trips = countArray.filter(([_, count]) => count >= 3).map(([rank]) => rank);
  const pairs = countArray.filter(([_, count]) => count >= 2).map(([rank]) => rank);
  
  if (trips.length > 0 && (pairs.length > 1 || (pairs.length === 1 && trips.length > 1))) {
    const tripRank = trips.sort((a, b) => getRankValue(b) - getRankValue(a))[0];
    const pairRank = pairs.filter(r => r !== tripRank).sort((a, b) => getRankValue(b) - getRankValue(a))[0] || 
                     trips.filter(r => r !== tripRank)[0];
    const tripCards = cards.filter(c => c.rank === tripRank).slice(0, 3);
    const pairCards = cards.filter(c => c.rank === pairRank).slice(0, 2);
    return {
      rank: HAND_RANKS.FULL_HOUSE,
      name: 'Full House',
      cards: [...tripCards, ...pairCards],
      highCards: [getRankValue(tripRank), getRankValue(pairRank)]
    };
  }
  
  const flushCards = getFlushCards(cards);
  if (flushCards) {
    return {
      rank: HAND_RANKS.FLUSH,
      name: 'Flush',
      cards: flushCards,
      highCards: flushCards.map(c => getRankValue(c.rank))
    };
  }
  
  const straightCards = getStraightCards(cards);
  if (straightCards) {
    const highCard = Math.max(...straightCards.map(c => getRankValue(c.rank)));
    return {
      rank: HAND_RANKS.STRAIGHT,
      name: 'Straight',
      cards: straightCards,
      highCards: [highCard]
    };
  }
  
  if (trips.length > 0) {
    const tripRank = trips.sort((a, b) => getRankValue(b) - getRankValue(a))[0];
    const tripCards = cards.filter(c => c.rank === tripRank).slice(0, 3);
    const kickers = sortCardsByRank(cards.filter(c => c.rank !== tripRank)).slice(0, 2);
    return {
      rank: HAND_RANKS.THREE_OF_A_KIND,
      name: 'Three of a Kind',
      cards: [...tripCards, ...kickers],
      highCards: [getRankValue(tripRank), ...kickers.map(c => getRankValue(c.rank))]
    };
  }
  
  const actualPairs = countArray.filter(([_, count]) => count === 2).map(([rank]) => rank);
  if (actualPairs.length >= 2) {
    const sortedPairs = actualPairs.sort((a, b) => getRankValue(b) - getRankValue(a));
    const topPairs = sortedPairs.slice(0, 2);
    const pairCards = cards.filter(c => topPairs.includes(c.rank));
    const kicker = sortCardsByRank(cards.filter(c => !topPairs.includes(c.rank)))[0];
    return {
      rank: HAND_RANKS.TWO_PAIR,
      name: 'Two Pair',
      cards: [...pairCards, kicker],
      highCards: [getRankValue(topPairs[0]), getRankValue(topPairs[1]), getRankValue(kicker.rank)]
    };
  }
  
  if (actualPairs.length === 1) {
    const pairRank = actualPairs[0];
    const pairCards = cards.filter(c => c.rank === pairRank);
    const kickers = sortCardsByRank(cards.filter(c => c.rank !== pairRank)).slice(0, 3);
    return {
      rank: HAND_RANKS.PAIR,
      name: 'Pair',
      cards: [...pairCards, ...kickers],
      highCards: [getRankValue(pairRank), ...kickers.map(c => getRankValue(c.rank))]
    };
  }
  
  const highCards = sortCardsByRank(cards).slice(0, 5);
  return {
    rank: HAND_RANKS.HIGH_CARD,
    name: 'High Card',
    cards: highCards,
    highCards: highCards.map(c => getRankValue(c.rank))
  };
}

export function findBestHand(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to find best hand');
  }
  
  if (cards.length === 5) {
    return evaluateHand(cards);
  }
  
  let bestHand: HandResult | null = null;
  
  function combinations(arr: Card[], k: number): Card[][] {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    
    const [first, ...rest] = arr;
    const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo]);
    const withoutFirst = combinations(rest, k);
    
    return [...withFirst, ...withoutFirst];
  }
  
  const allCombinations = combinations(cards, 5);
  
  for (const combo of allCombinations) {
    const hand = evaluateHand(combo);
    if (!bestHand || compareHands(hand, bestHand) > 0) {
      bestHand = hand;
    }
  }
  
  return bestHand!;
}

export function compareHands(hand1: HandResult, hand2: HandResult): number {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }
  
  for (let i = 0; i < Math.min(hand1.highCards.length, hand2.highCards.length); i++) {
    if (hand1.highCards[i] !== hand2.highCards[i]) {
      return hand1.highCards[i] - hand2.highCards[i];
    }
  }
  
  return 0;
}

export function determineRoundWinner(
  player1Cards: Card[],
  player2Cards: Card[]
): { winnerId: 'player1' | 'player2' | null; player1Hand: HandResult; player2Hand: HandResult; isTie: boolean } {
  const player1Hand = findBestHand(player1Cards);
  const player2Hand = findBestHand(player2Cards);
  
  const comparison = compareHands(player1Hand, player2Hand);
  
  if (comparison > 0) {
    return { winnerId: 'player1', player1Hand, player2Hand, isTie: false };
  } else if (comparison < 0) {
    return { winnerId: 'player2', player1Hand, player2Hand, isTie: false };
  } else {
    return { winnerId: null, player1Hand, player2Hand, isTie: true };
  }
}

export function generateRoundSeed(): string {
  return `poker-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function calculatePokerPointsAwarded(winnerWins: number, loserWins: number): number {
  return winnerWins - loserWins;
}

export const WINS_TO_WIN_GAME = 10;
export const MAX_ROUNDS = 19;
