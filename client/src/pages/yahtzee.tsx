import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trophy, RotateCcw, Users } from "lucide-react";

interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string;
  avatarType: string;
  avatarUrl: string | null;
  points: number;
  isAdmin: boolean;
}

interface YahtzeeGame {
  id: string;
  player1Id: string;
  player2Id: string;
  currentPlayerId: string;
  dice: string;
  heldDice: string;
  rollsRemaining: number;
  player1Scorecard: string;
  player2Scorecard: string;
  player1YahtzeeBonus: number;
  player2YahtzeeBonus: number;
  status: string;
  winnerId?: string | null;
  player1FinalScore?: number | null;
  player2FinalScore?: number | null;
}

interface Scorecard {
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

const categoryNames: Record<keyof Scorecard, string> = {
  ones: "Ones",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  threeOfAKind: "Three of a Kind",
  fourOfAKind: "Four of a Kind",
  fullHouse: "Full House",
  smallStraight: "Small Straight",
  largeStraight: "Large Straight",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

// CSS Dice Component with dots
function CssDice({ value, isHeld, onClick }: { value: number | null; isHeld: boolean; onClick: () => void }) {
  if (value === null) {
    // Blank dice before first roll
    return (
      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-600 rounded-lg" />
    );
  }

  const getDotPositions = (num: number) => {
    const positions: string[] = [];
    switch (num) {
      case 1:
        positions.push("center");
        break;
      case 2:
        positions.push("top-left", "bottom-right");
        break;
      case 3:
        positions.push("top-left", "center", "bottom-right");
        break;
      case 4:
        positions.push("top-left", "top-right", "bottom-left", "bottom-right");
        break;
      case 5:
        positions.push("top-left", "top-right", "center", "bottom-left", "bottom-right");
        break;
      case 6:
        positions.push("top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right");
        break;
    }
    return positions;
  };

  const dots = getDotPositions(value);

  return (
    <button
      onClick={onClick}
      className={`relative w-16 h-16 rounded-lg border-2 transition-all ${
        isHeld
          ? "bg-blue-500 dark:bg-blue-600 border-blue-700 dark:border-blue-400 scale-105 shadow-lg"
          : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
      data-testid={`dice-${value}`}
    >
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-2">
        {/* Top row */}
        <div className="flex items-start justify-start">
          {dots.includes("top-left") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
        <div />
        <div className="flex items-start justify-end">
          {dots.includes("top-right") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
        
        {/* Middle row */}
        <div className="flex items-center justify-start">
          {dots.includes("middle-left") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
        <div className="flex items-center justify-center">
          {dots.includes("center") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
        <div className="flex items-center justify-end">
          {dots.includes("middle-right") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
        
        {/* Bottom row */}
        <div className="flex items-end justify-start">
          {dots.includes("bottom-left") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
        <div />
        <div className="flex items-end justify-end">
          {dots.includes("bottom-right") && <div className={`w-2.5 h-2.5 rounded-full ${isHeld ? "bg-white" : "bg-gray-900 dark:bg-white"}`} />}
        </div>
      </div>
      {isHeld && (
        <div className="absolute -bottom-5 left-0 right-0 text-xs font-bold text-blue-600 dark:text-blue-400 text-center">
          HELD
        </div>
      )}
    </button>
  );
}

// Score calculation functions (replicated from backend for potential score preview)
function countDice(dice: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const die of dice) {
    counts.set(die, (counts.get(die) || 0) + 1);
  }
  return counts;
}

function scoreUpperSection(dice: number[], target: number): number {
  return dice.filter(die => die === target).reduce((sum, die) => sum + die, 0);
}

function scoreThreeOfAKind(dice: number[]): number {
  const counts = countDice(dice);
  const hasThree = Array.from(counts.values()).some(count => count >= 3);
  return hasThree ? dice.reduce((sum, die) => sum + die, 0) : 0;
}

function scoreFourOfAKind(dice: number[]): number {
  const counts = countDice(dice);
  const hasFour = Array.from(counts.values()).some(count => count >= 4);
  return hasFour ? dice.reduce((sum, die) => sum + die, 0) : 0;
}

function scoreFullHouse(dice: number[]): number {
  const counts = Array.from(countDice(dice).values()).sort((a, b) => b - a);
  return counts[0] === 3 && counts[1] === 2 ? 25 : 0;
}

function scoreSmallStraight(dice: number[]): number {
  const uniqueSorted = Array.from(new Set(dice)).sort((a, b) => a - b);
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

function scoreLargeStraight(dice: number[]): number {
  const uniqueSorted = Array.from(new Set(dice)).sort((a, b) => a - b);
  if (uniqueSorted.length !== 5) return 0;
  for (let i = 0; i < 4; i++) {
    if (uniqueSorted[i + 1] !== uniqueSorted[i] + 1) {
      return 0;
    }
  }
  return 40;
}

function scoreYahtzee(dice: number[]): number {
  return new Set(dice).size === 1 ? 50 : 0;
}

function scoreChance(dice: number[]): number {
  return dice.reduce((sum, die) => sum + die, 0);
}

function calculateCategoryScore(dice: number[], category: keyof Scorecard): number {
  switch (category) {
    case 'ones': return scoreUpperSection(dice, 1);
    case 'twos': return scoreUpperSection(dice, 2);
    case 'threes': return scoreUpperSection(dice, 3);
    case 'fours': return scoreUpperSection(dice, 4);
    case 'fives': return scoreUpperSection(dice, 5);
    case 'sixes': return scoreUpperSection(dice, 6);
    case 'threeOfAKind': return scoreThreeOfAKind(dice);
    case 'fourOfAKind': return scoreFourOfAKind(dice);
    case 'fullHouse': return scoreFullHouse(dice);
    case 'smallStraight': return scoreSmallStraight(dice);
    case 'largeStraight': return scoreLargeStraight(dice);
    case 'yahtzee': return scoreYahtzee(dice);
    case 'chance': return scoreChance(dice);
    default: return 0;
  }
}

export default function YahtzeePage() {
  const [heldDice, setHeldDice] = useState<boolean[]>([false, false, false, false, false]);
  const [selectedOpponent, setSelectedOpponent] = useState<string>("");
  const { toast } = useToast();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: currentGame, isLoading } = useQuery<YahtzeeGame>({
    queryKey: ["/api/yahtzee/current"],
  });

  // Sync heldDice from game state
  useEffect(() => {
    if (currentGame) {
      const serverHeldDice = JSON.parse(currentGame.heldDice) as boolean[];
      setHeldDice(serverHeldDice);
    }
  }, [currentGame?.heldDice]);

  const startGame = useMutation({
    mutationFn: async (opponentId: string) => {
      const response = await apiRequest("POST", "/api/yahtzee/start", { opponentId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yahtzee/current"] });
      setHeldDice([false, false, false, false, false]);
      setSelectedOpponent("");
      toast({
        title: "Game started!",
        description: "Roll the dice to begin your turn",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive",
      });
    },
  });

  const rollDice = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/yahtzee/roll", {
        gameId: currentGame!.id,
        heldDice,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yahtzee/current"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to roll dice",
        variant: "destructive",
      });
    },
  });

  const scoreCategory = useMutation({
    mutationFn: async (category: keyof Scorecard) => {
      const response = await apiRequest("POST", "/api/yahtzee/score", {
        gameId: currentGame!.id,
        category,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yahtzee/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      if (data.gameComplete) {
        const winner = data.game.winnerId === currentUser?.id ? "You won!" : "You lost!";
        toast({
          title: `🎉 Game Complete! ${winner}`,
          description: `Your final score: ${data.game.player1Id === currentUser?.id ? data.game.player1FinalScore : data.game.player2FinalScore}`,
        });
      } else if (data.turnChanged) {
        toast({
          title: "Turn complete",
          description: "Waiting for opponent's turn...",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to score category",
        variant: "destructive",
      });
    },
  });

  const toggleHold = (index: number) => {
    if (!currentGame || currentGame.currentPlayerId !== currentUser?.id) return;
    const dice = JSON.parse(currentGame.dice) as number[];
    if (dice.length === 0) return; // Can't hold dice before first roll
    
    const newHeldDice = [...heldDice];
    newHeldDice[index] = !newHeldDice[index];
    setHeldDice(newHeldDice);
  };

  const handleRoll = () => {
    if (!currentGame) return;
    rollDice.mutate();
  };

  const handleScore = (category: keyof Scorecard) => {
    if (!currentGame) return;
    scoreCategory.mutate(category);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Opponent selection screen
  if (!currentGame) {
    const availableOpponents = users?.filter(u => u.id !== currentUser?.id) || [];
    
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="text-yellow-500" size={28} />
              Multiplayer Yahtzee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Challenge another family member to a game of Yahtzee! Take turns rolling dice,
              choosing categories, and scoring points. The player with the highest score wins!
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users size={16} />
                  Select Your Opponent
                </label>
                <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                  <SelectTrigger data-testid="select-opponent">
                    <SelectValue placeholder="Choose a family member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOpponents.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.avatarType === 'emoji' ? user.avatar : '👤'}</span>
                          <span>{user.displayName || user.username}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => selectedOpponent && startGame.mutate(selectedOpponent)}
                disabled={!selectedOpponent || startGame.isPending}
                size="lg"
                className="w-full"
                data-testid="button-start-game"
              >
                Start Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active game screen
  const dice = JSON.parse(currentGame.dice) as number[];
  const player1Scorecard = JSON.parse(currentGame.player1Scorecard) as Scorecard;
  const player2Scorecard = JSON.parse(currentGame.player2Scorecard) as Scorecard;
  
  const isMyTurn = currentGame.currentPlayerId === currentUser?.id;
  const isPlayer1 = currentGame.player1Id === currentUser?.id;
  const myScorecard = isPlayer1 ? player1Scorecard : player2Scorecard;
  const opponentScorecard = isPlayer1 ? player2Scorecard : player1Scorecard;
  const myYahtzeeBonus = isPlayer1 ? currentGame.player1YahtzeeBonus : currentGame.player2YahtzeeBonus;
  const opponentYahtzeeBonus = isPlayer1 ? currentGame.player2YahtzeeBonus : currentGame.player1YahtzeeBonus;

  const calculateUpperBonus = (scorecard: Scorecard) => {
    const upperTotal =
      (scorecard.ones || 0) +
      (scorecard.twos || 0) +
      (scorecard.threes || 0) +
      (scorecard.fours || 0) +
      (scorecard.fives || 0) +
      (scorecard.sixes || 0);
    return upperTotal >= 63 ? 35 : 0;
  };

  const calculateTotal = (scorecard: Scorecard, yahtzeeBonus: number) => {
    return (
      Object.values(scorecard).reduce((sum, val) => sum + (val || 0), 0) +
      calculateUpperBonus(scorecard) +
      (yahtzeeBonus * 100)
    );
  };

  const opponentUser = users?.find(u => u.id === (isPlayer1 ? currentGame.player2Id : currentGame.player1Id));
  const player1User = users?.find(u => u.id === currentGame.player1Id);
  const player2User = users?.find(u => u.id === currentGame.player2Id);

  // Scorecard rendering function
  const renderScorecard = (scorecard: Scorecard, yahtzeeBonus: number, isCurrentPlayer: boolean, label: string, user: User | undefined) => (
    <Card>
      <CardHeader>
        <CardTitle className="space-y-3">
          <div className="flex items-center justify-center">
            <Avatar className="w-24 h-24 text-5xl">
              {user?.avatarType === "image" && user?.avatarUrl ? (
                <AvatarImage 
                  src={user.avatarUrl} 
                  alt={`${user.displayName || user.username}'s avatar`}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback>{user?.avatar || "👤"}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-center justify-between">
            <span>{label}</span>
            <span className="text-lg font-mono">{calculateTotal(scorecard, yahtzeeBonus)}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Upper Section */}
          <div className="font-bold text-sm mb-2 text-muted-foreground">Upper Section</div>
          {(['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const).map((category) => {
            const isUsed = scorecard[category] !== null;
            const canClick = isCurrentPlayer && isMyTurn && !isUsed && dice.length > 0;
            const potentialScore = dice.length > 0 ? calculateCategoryScore(dice, category) : 0;
            
            return (
              <button
                key={category}
                onClick={() => canClick && handleScore(category)}
                disabled={!canClick || scoreCategory.isPending}
                className={`w-full flex justify-between items-center p-2 rounded transition-colors ${
                  isUsed
                    ? "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : canClick
                    ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-900 dark:text-green-100 cursor-pointer border-2 border-green-500"
                    : isCurrentPlayer && isMyTurn
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100"
                    : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                }`}
                data-testid={`category-${category}-${isCurrentPlayer ? 'mine' : 'opponent'}`}
              >
                <span className="text-sm">{categoryNames[category]}</span>
                <span className="font-mono font-semibold">
                  {isUsed ? (
                    scorecard[category]
                  ) : canClick ? (
                    <span className="text-green-700 dark:text-green-300">{potentialScore}</span>
                  ) : (
                    "—"
                  )}
                </span>
              </button>
            );
          })}
          
          <div className="flex justify-between p-2 bg-secondary/50 rounded font-bold text-sm mt-2">
            <span>Bonus (≥63)</span>
            <span className="font-mono">{calculateUpperBonus(scorecard)}</span>
          </div>

          {/* Lower Section */}
          <div className="font-bold text-sm mt-4 mb-2 text-muted-foreground">Lower Section</div>
          {(['threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'] as const).map((category) => {
            const isUsed = scorecard[category] !== null;
            const canClick = isCurrentPlayer && isMyTurn && !isUsed && dice.length > 0;
            const potentialScore = dice.length > 0 ? calculateCategoryScore(dice, category) : 0;
            
            return (
              <button
                key={category}
                onClick={() => canClick && handleScore(category)}
                disabled={!canClick || scoreCategory.isPending}
                className={`w-full flex justify-between items-center p-2 rounded transition-colors ${
                  isUsed
                    ? "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : canClick
                    ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-900 dark:text-green-100 cursor-pointer border-2 border-green-500"
                    : isCurrentPlayer && isMyTurn
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100"
                    : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                }`}
                data-testid={`category-${category}-${isCurrentPlayer ? 'mine' : 'opponent'}`}
              >
                <span className="text-sm">{categoryNames[category]}</span>
                <span className="font-mono font-semibold">
                  {isUsed ? (
                    scorecard[category]
                  ) : canClick ? (
                    <span className="text-green-700 dark:text-green-300">{potentialScore}</span>
                  ) : (
                    "—"
                  )}
                </span>
              </button>
            );
          })}

          {yahtzeeBonus > 0 && (
            <div className="flex justify-between p-2 bg-yellow-500/20 rounded font-bold mt-2 text-sm">
              <span>Yahtzee Bonus (×{yahtzeeBonus})</span>
              <span className="font-mono">{yahtzeeBonus * 100}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Turn Indicator Banner */}
      <div
        className={`p-4 rounded-lg text-center font-bold text-lg ${
          isMyTurn
            ? "bg-green-500 dark:bg-green-600 text-white"
            : "bg-orange-500 dark:bg-orange-600 text-white"
        }`}
        data-testid="turn-indicator"
      >
        {isMyTurn ? "🎲 YOUR TURN" : `⏳ ${opponentUser?.displayName || opponentUser?.username || "Opponent"}'s Turn`}
      </div>

      {/* Dice Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Dice
            </span>
            <span className="text-sm font-normal">
              Rolls: {currentGame.rollsRemaining}/3
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dice Display */}
          <div className="flex justify-center gap-3 pb-4">
            {dice.length === 0 ? (
              // Show blank dice before first roll
              [0, 1, 2, 3, 4].map((index) => (
                <CssDice
                  key={index}
                  value={null}
                  isHeld={false}
                  onClick={() => {}}
                />
              ))
            ) : (
              dice.map((value, index) => (
                <CssDice
                  key={index}
                  value={value}
                  isHeld={heldDice[index]}
                  onClick={() => toggleHold(index)}
                />
              ))
            )}
          </div>

          {/* Roll Button */}
          <Button
            onClick={handleRoll}
            disabled={!isMyTurn || currentGame.rollsRemaining === 0 || rollDice.isPending}
            size="lg"
            className="w-full"
            data-testid="button-roll-dice"
          >
            <RotateCcw className="mr-2" />
            {dice.length === 0 ? "Roll Dice to Start" : `Roll Dice (${currentGame.rollsRemaining} left)`}
          </Button>

          {!isMyTurn && (
            <p className="text-sm text-center text-muted-foreground">
              Waiting for opponent to complete their turn...
            </p>
          )}

          {isMyTurn && currentGame.rollsRemaining === 0 && dice.length > 0 && (
            <p className="text-sm text-center text-green-600 dark:text-green-400 font-semibold">
              Choose a category to score below
            </p>
          )}
        </CardContent>
      </Card>

      {/* Scorecards - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderScorecard(myScorecard, myYahtzeeBonus, true, "Your Scorecard", currentUser)}
        {renderScorecard(opponentScorecard, opponentYahtzeeBonus, false, `${opponentUser?.displayName || opponentUser?.username || "Opponent"}'s Scorecard`, opponentUser)}
      </div>
    </div>
  );
}
