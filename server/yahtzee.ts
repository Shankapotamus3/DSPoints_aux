// Yahtzee game logic

export interface YahtzeeScorecard {
  ones: number | null;
  twos: number | null;
  threes: number | null;
  fours: number | null;
  fives: number | null;
  sixes: number | null;
  threeOfAKind: number | null;
  fourOfAKind: number | null;
  fullHouse: number | null;
  smallStraight: number | null;
  largeStraight: number | null;
  yahtzee: number | null;
  chance: number | null;
}

export interface YahtzeeGameState {
  dice: number[]; // 5 dice values (1-6)
  heldDice: boolean[]; // 5 booleans indicating which dice are held
  rollsRemaining: number; // 0-3
  scorecard: YahtzeeScorecard;
}

// Roll dice that are not held
export function rollDice(currentDice: number[], heldDice: boolean[]): number[] {
  // If no dice yet (first roll), roll all 5
  if (currentDice.length === 0) {
    return [1, 2, 3, 4, 5].map(() => Math.floor(Math.random() * 6) + 1);
  }
  
  return currentDice.map((die, index) => 
    heldDice[index] ? die : Math.floor(Math.random() * 6) + 1
  );
}

// Initialize a blank scorecard
export function initializeScorecard(): YahtzeeScorecard {
  return {
    ones: null,
    twos: null,
    threes: null,
    fours: null,
    fives: null,
    sixes: null,
    threeOfAKind: null,
    fourOfAKind: null,
    fullHouse: null,
    smallStraight: null,
    largeStraight: null,
    yahtzee: null,
    chance: null,
  };
}

// Initialize a new game state (no auto-roll, blank dice)
export function initializeGame(): YahtzeeGameState {
  return {
    dice: [], // Empty until first manual roll
    heldDice: [false, false, false, false, false],
    rollsRemaining: 3, // Full 3 rolls available
    scorecard: initializeScorecard(),
  };
}

// Helper: Count occurrences of each die value
function countDice(dice: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const die of dice) {
    counts.set(die, (counts.get(die) || 0) + 1);
  }
  return counts;
}

// Calculate score for upper section (ones through sixes)
function scoreUpperSection(dice: number[], target: number): number {
  return dice.filter(die => die === target).reduce((sum, die) => sum + die, 0);
}

// Calculate score for three of a kind
function scoreThreeOfAKind(dice: number[]): number {
  const counts = countDice(dice);
  const hasThree = Array.from(counts.values()).some(count => count >= 3);
  return hasThree ? dice.reduce((sum, die) => sum + die, 0) : 0;
}

// Calculate score for four of a kind
function scoreFourOfAKind(dice: number[]): number {
  const counts = countDice(dice);
  const hasFour = Array.from(counts.values()).some(count => count >= 4);
  return hasFour ? dice.reduce((sum, die) => sum + die, 0) : 0;
}

// Calculate score for full house (3 of one + 2 of another)
function scoreFullHouse(dice: number[]): number {
  const counts = Array.from(countDice(dice).values()).sort((a, b) => b - a);
  return counts[0] === 3 && counts[1] === 2 ? 25 : 0;
}

// Calculate score for small straight (4 consecutive numbers)
function scoreSmallStraight(dice: number[]): number {
  const uniqueSorted = Array.from(new Set(dice)).sort((a, b) => a - b);
  
  // Check for consecutive sequences of 4
  for (let i = 0; i <= uniqueSorted.length - 4; i++) {
    if (
      uniqueSorted[i + 1] === uniqueSorted[i] + 1 &&
      uniqueSorted[i + 2] === uniqueSorted[i] + 2 &&
      uniqueSorted[i + 3] === uniqueSorted[i] + 3
    ) {
      return 30;
    }
  }
  return 0;
}

// Calculate score for large straight (5 consecutive numbers)
function scoreLargeStraight(dice: number[]): number {
  const uniqueSorted = Array.from(new Set(dice)).sort((a, b) => a - b);
  
  if (uniqueSorted.length !== 5) return 0;
  
  // Check if all consecutive
  for (let i = 0; i < 4; i++) {
    if (uniqueSorted[i + 1] !== uniqueSorted[i] + 1) {
      return 0;
    }
  }
  return 40;
}

// Calculate score for yahtzee (all 5 dice the same)
function scoreYahtzee(dice: number[]): number {
  return new Set(dice).size === 1 ? 50 : 0;
}

// Calculate score for chance (sum of all dice)
function scoreChance(dice: number[]): number {
  return dice.reduce((sum, die) => sum + die, 0);
}

// Calculate the potential score for a category
export function calculateCategoryScore(dice: number[], category: keyof YahtzeeScorecard): number {
  switch (category) {
    case 'ones':
      return scoreUpperSection(dice, 1);
    case 'twos':
      return scoreUpperSection(dice, 2);
    case 'threes':
      return scoreUpperSection(dice, 3);
    case 'fours':
      return scoreUpperSection(dice, 4);
    case 'fives':
      return scoreUpperSection(dice, 5);
    case 'sixes':
      return scoreUpperSection(dice, 6);
    case 'threeOfAKind':
      return scoreThreeOfAKind(dice);
    case 'fourOfAKind':
      return scoreFourOfAKind(dice);
    case 'fullHouse':
      return scoreFullHouse(dice);
    case 'smallStraight':
      return scoreSmallStraight(dice);
    case 'largeStraight':
      return scoreLargeStraight(dice);
    case 'yahtzee':
      return scoreYahtzee(dice);
    case 'chance':
      return scoreChance(dice);
    default:
      return 0;
  }
}

// Calculate upper section bonus (35 if upper section total >= 63)
function calculateUpperBonus(scorecard: YahtzeeScorecard): number {
  const upperTotal = (
    (scorecard.ones || 0) +
    (scorecard.twos || 0) +
    (scorecard.threes || 0) +
    (scorecard.fours || 0) +
    (scorecard.fives || 0) +
    (scorecard.sixes || 0)
  );
  return upperTotal >= 63 ? 35 : 0;
}

// Calculate final score (including yahtzee bonus)
export function calculateFinalScore(scorecard: YahtzeeScorecard, yahtzeeBonus: number = 0): number {
  const total = (
    (scorecard.ones || 0) +
    (scorecard.twos || 0) +
    (scorecard.threes || 0) +
    (scorecard.fours || 0) +
    (scorecard.fives || 0) +
    (scorecard.sixes || 0) +
    (scorecard.threeOfAKind || 0) +
    (scorecard.fourOfAKind || 0) +
    (scorecard.fullHouse || 0) +
    (scorecard.smallStraight || 0) +
    (scorecard.largeStraight || 0) +
    (scorecard.yahtzee || 0) +
    (scorecard.chance || 0) +
    calculateUpperBonus(scorecard) +
    (yahtzeeBonus * 100) // Each bonus Yahtzee is worth 100 points
  );
  return total;
}

// Check if dice form a Yahtzee (all the same)
export function isYahtzee(dice: number[]): boolean {
  return new Set(dice).size === 1;
}

// Check if game is complete (all categories filled)
export function isGameComplete(scorecard: YahtzeeScorecard): boolean {
  return Object.values(scorecard).every(score => score !== null);
}

// Calculate points awarded based on final score
export function calculatePointsAwarded(finalScore: number): number {
  // Award 1 point for every 10 points scored
  return Math.floor(finalScore / 10);
}
