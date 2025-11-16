// Lottery ticket outcomes with their rewards and probabilities
export interface LotteryOutcome {
  outcome: string;
  pointsAwarded: number;
  specialReward?: string;
  probability: number; // Weight for random selection
}

export const lotteryOutcomes: LotteryOutcome[] = [
  { outcome: "Lose all points", pointsAwarded: -999, probability: 3 },
  { outcome: "Free reward of your choice", pointsAwarded: 0, specialReward: "Free reward of your choice", probability: 3 },
  { outcome: "Gain 5 points", pointsAwarded: 5, probability: 1 },
  { outcome: "Gain 10 points", pointsAwarded: 10, probability: 1 },
  { outcome: "Gain 15 points", pointsAwarded: 15, probability: 1 },
  { outcome: "Gain 20 points", pointsAwarded: 20, probability: 3 },
  { outcome: "Gain 25 points", pointsAwarded: 25, probability: 3 },
  { outcome: "Gain 30 points", pointsAwarded: 30, probability: 3 },
  { outcome: "Gain 35 points", pointsAwarded: 35, probability: 3 },
  { outcome: "Gain 40 points", pointsAwarded: 40, probability: 3 },
  { outcome: "Gain 50 points", pointsAwarded: 50, probability: 3 },
  { outcome: "Have you been a good slave?", pointsAwarded: 0, specialReward: "If you have no pending punishments then you earn 50 points. Otherwise your punishments are doubled.", probability: 3 },
  { outcome: "Remove a punishment of your choice", pointsAwarded: 0, specialReward: "Remove a punishment of your choice", probability: 3 },
  { outcome: "Have an orgasm, now", pointsAwarded: 0, specialReward: "Have an orgasm, now", probability: 3 },
  { outcome: "Earn double points on a day of your choosing", pointsAwarded: 0, specialReward: "Earn double points on a day of your choosing", probability: 3 },
  { outcome: "Earn triple points on a day of your choosing", pointsAwarded: 0, specialReward: "Earn triple points on a day of your choosing", probability: 3 },
  { outcome: "Earn half points all of next week", pointsAwarded: 0, specialReward: "Earn half points all of next week", probability: 3 },
  { outcome: "Earn quadruple points on a day of your choosing", pointsAwarded: 0, specialReward: "Earn quadruple points on a day of your choosing", probability: 3 },
  { outcome: "Gain 5 points", pointsAwarded: 5, probability: 1 },
  { outcome: "Gain 10 points", pointsAwarded: 10, probability: 1 },
  { outcome: "Gain 15 points", pointsAwarded: 15, probability: 1 },
  { outcome: "Remove all punishments", pointsAwarded: 0, specialReward: "Remove all punishments", probability: 3 },
  { outcome: "At the end of the week receive a punishment for every day that week that Master did not have an orgasm", pointsAwarded: 0, specialReward: "At the end of the week receive a punishment for every day that week that Master did not have an orgasm", probability: 3 },
  { outcome: "Gain 20 points plus a free ticket", pointsAwarded: 20, specialReward: "Free lottery ticket", probability: 3 },
  { outcome: "Plan a date night, Master must agree and pay", pointsAwarded: 0, specialReward: "Plan a date night, Master must agree and pay", probability: 3 },
  { outcome: "Gain 50 points if Master had an orgasm yesterday", pointsAwarded: 0, specialReward: "Gain 50 points if Master had an orgasm yesterday, get a punishment if not", probability: 3 },
  { outcome: "Gain 100 points if Master had an orgasm yesterday", pointsAwarded: 0, specialReward: "Gain 100 points if Master had an orgasm yesterday, get two punishments if not", probability: 3 },
  { outcome: "There's nothing on this ticket, oh well.", pointsAwarded: 0, probability: 3 },
  { outcome: "Master will take you to dinner on your next available night together.", pointsAwarded: 0, specialReward: "Master will take you to dinner on your next available night together", probability: 3 },
  { outcome: "Gain 5 points", pointsAwarded: 5, probability: 1 },
  { outcome: "Gain 10 points", pointsAwarded: 10, probability: 1 },
  { outcome: "Lose 5 points", pointsAwarded: -5, probability: 3 },
  { outcome: "Lose 10 points", pointsAwarded: -10, probability: 3 },
];

export const LOTTERY_TICKET_COST = 20;

export function drawLotteryTicket(): LotteryOutcome {
  const totalWeight = lotteryOutcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  let random = Math.random() * totalWeight;
  
  for (const outcome of lotteryOutcomes) {
    random -= outcome.probability;
    if (random <= 0) {
      return outcome;
    }
  }
  
  // Fallback (should never happen)
  return lotteryOutcomes[lotteryOutcomes.length - 1];
}
