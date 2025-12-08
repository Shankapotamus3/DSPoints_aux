import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trophy, Users, Check, Clock, Spade, Heart, Diamond, Club, X } from "lucide-react";

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

interface PokerGame {
  id: string;
  player1Id: string;
  player2Id: string;
  status: string;
  player1Wins: number;
  player2Wins: number;
  currentRound: number;
  winnerId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface PokerRound {
  id: string;
  gameId: string;
  roundNumber: number;
  status: string;
  player1Cards: string;
  player2Cards: string;
  player1DiscardIndices: string | null;
  player2DiscardIndices: string | null;
  player1Ready: boolean;
  player2Ready: boolean;
  player1BestHand: string | null;
  player2BestHand: string | null;
  player1HandRank: string | null;
  player2HandRank: string | null;
  winnerId: string | null;
  isTie: boolean;
}

const SUITS: Record<string, { icon: typeof Spade; color: string }> = {
  'S': { icon: Spade, color: 'text-gray-900 dark:text-white' },
  'H': { icon: Heart, color: 'text-red-500' },
  'D': { icon: Diamond, color: 'text-red-500' },
  'C': { icon: Club, color: 'text-gray-900 dark:text-white' },
};

function PlayingCard({ 
  card, 
  isHighlighted = false,
  isSelected = false,
  isSelectable = false,
  onClick
}: { 
  card: string; 
  isHighlighted?: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  onClick?: () => void;
}) {
  const suitChar = card[card.length - 1];
  const rank = card.slice(0, -1);
  const suit = SUITS[suitChar] || SUITS['S'];
  const SuitIcon = suit.icon;
  
  return (
    <div
      onClick={isSelectable ? onClick : undefined}
      className={`relative w-14 h-20 sm:w-16 sm:h-24 bg-white dark:bg-gray-800 rounded-lg border-2 flex flex-col items-center justify-between p-1 sm:p-2 shadow-md transition-all ${
        isSelectable ? 'cursor-pointer hover:scale-105' : ''
      } ${
        isSelected 
          ? 'border-red-500 ring-2 ring-red-500/50 -translate-y-2' 
          : isHighlighted 
            ? 'border-yellow-400 ring-2 ring-yellow-400/50' 
            : 'border-gray-300 dark:border-gray-600'
      }`}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5">
          <X className="w-3 h-3 text-white" />
        </div>
      )}
      <div className={`text-sm sm:text-base font-bold ${suit.color}`}>{rank}</div>
      <SuitIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${suit.color}`} />
      <div className={`text-sm sm:text-base font-bold ${suit.color}`}>{rank}</div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="w-14 h-20 sm:w-16 sm:h-24 bg-blue-600 rounded-lg border-2 border-blue-800 flex items-center justify-center shadow-md">
      <div className="w-10 h-16 sm:w-12 sm:h-18 border-2 border-blue-400 rounded-md bg-blue-700 flex items-center justify-center">
        <div className="text-blue-300 text-lg sm:text-2xl font-bold">?</div>
      </div>
    </div>
  );
}

export default function PokerPage() {
  const { toast } = useToast();
  const [selectedOpponent, setSelectedOpponent] = useState<string>("");
  const [selectedDiscards, setSelectedDiscards] = useState<number[]>([]);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: gameData, isLoading: isLoadingGame } = useQuery<{
    game: PokerGame | null;
    currentRound: PokerRound | null;
    rounds: PokerRound[];
  }>({
    queryKey: ["/api/poker/current"],
    refetchInterval: 3000,
  });

  const startGameMutation = useMutation({
    mutationFn: async (opponentId: string) => {
      const response = await apiRequest("POST", "/api/poker/start", { opponentId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/poker/current"] });
      toast({
        title: "Game Started!",
        description: "A new poker game has begun. Good luck!",
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

  const discardMutation = useMutation({
    mutationFn: async ({ gameId, discardIndices }: { gameId: string; discardIndices: number[] }) => {
      const response = await apiRequest("POST", "/api/poker/discard", { gameId, discardIndices });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/poker/current"] });
      setSelectedDiscards([]);
      if (data.bothSubmitted) {
        toast({
          title: "Cards Drawn!",
          description: "Both players have drawn. Lock in your final hand!",
        });
      } else {
        toast({
          title: "Waiting...",
          description: "Waiting for opponent to select discards.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit discards",
        variant: "destructive",
      });
    },
  });

  const readyMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await apiRequest("POST", "/api/poker/ready", { gameId });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/poker/current"] });
      if (data.roundComplete) {
        if (data.gameComplete) {
          toast({
            title: "Game Complete!",
            description: "The poker game has ended.",
          });
        } else {
          toast({
            title: "Round Complete!",
            description: "Next round is starting...",
          });
        }
      } else {
        toast({
          title: "Ready!",
          description: "Waiting for opponent to lock in their hand.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set ready status",
        variant: "destructive",
      });
    },
  });

  const game = gameData?.game;
  const currentRound = gameData?.currentRound;
  const rounds = gameData?.rounds || [];

  const isPlayer1 = game?.player1Id === currentUser?.id;
  const opponentId = isPlayer1 ? game?.player2Id : game?.player1Id;
  const opponent = users.find(u => u.id === opponentId);
  
  const myCards = currentRound 
    ? JSON.parse(isPlayer1 ? currentRound.player1Cards : currentRound.player2Cards) as string[]
    : [];
  
  const iAmReady = currentRound 
    ? (isPlayer1 ? currentRound.player1Ready : currentRound.player2Ready)
    : false;
  
  const opponentReady = currentRound
    ? (isPlayer1 ? currentRound.player2Ready : currentRound.player1Ready)
    : false;

  const myWins = game ? (isPlayer1 ? game.player1Wins : game.player2Wins) : 0;
  const opponentWins = game ? (isPlayer1 ? game.player2Wins : game.player1Wins) : 0;

  const myBestHand = currentRound?.status === 'complete'
    ? JSON.parse(isPlayer1 ? currentRound.player1BestHand! : currentRound.player2BestHand!) as string[]
    : [];
  const opponentBestHand = currentRound?.status === 'complete'
    ? JSON.parse(isPlayer1 ? currentRound.player2BestHand! : currentRound.player1BestHand!) as string[]
    : [];
  const myHandRank = currentRound?.status === 'complete'
    ? (isPlayer1 ? currentRound.player1HandRank : currentRound.player2HandRank)
    : null;
  const opponentHandRank = currentRound?.status === 'complete'
    ? (isPlayer1 ? currentRound.player2HandRank : currentRound.player1HandRank)
    : null;

  // Discard phase tracking
  const inDiscardPhase = currentRound?.status === 'dealing';
  const inDrawnPhase = currentRound?.status === 'drawing';
  
  const myDiscardIndices = currentRound 
    ? (isPlayer1 ? currentRound.player1DiscardIndices : currentRound.player2DiscardIndices)
    : null;
  const hasSubmittedDiscards = myDiscardIndices !== null;
  
  const opponentDiscardIndices = currentRound
    ? (isPlayer1 ? currentRound.player2DiscardIndices : currentRound.player1DiscardIndices)
    : null;
  const opponentSubmittedDiscards = opponentDiscardIndices !== null;

  const toggleDiscard = (index: number) => {
    if (selectedDiscards.includes(index)) {
      setSelectedDiscards(selectedDiscards.filter(i => i !== index));
    } else if (selectedDiscards.length < 5) {
      setSelectedDiscards([...selectedDiscards, index]);
    }
  };

  // Reset selections when round changes
  useEffect(() => {
    setSelectedDiscards([]);
  }, [currentRound?.id]);

  const availableOpponents = users.filter(u => u.id !== currentUser?.id);

  if (isLoadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Spade className="w-6 h-6" />
              7-Card Draw Poker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-muted-foreground">
              <p className="mb-4">Challenge another player to a best-of-19 poker match!</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Each player receives 7 cards</li>
                <li>Best 5-card hand wins each round</li>
                <li>First to win 10 rounds wins the game</li>
                <li>Non-admin winners earn points equal to (wins - opponent's wins)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium">Select Opponent</label>
              <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                <SelectTrigger data-testid="select-poker-opponent">
                  <SelectValue placeholder="Choose an opponent..." />
                </SelectTrigger>
                <SelectContent>
                  {availableOpponents.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {user.avatarType === 'image' && user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} />
                          ) : (
                            <AvatarFallback className="text-xs">{user.avatar}</AvatarFallback>
                          )}
                        </Avatar>
                        <span>{user.displayName || user.username}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => startGameMutation.mutate(selectedOpponent)}
                disabled={!selectedOpponent || startGameMutation.isPending}
                className="w-full"
                data-testid="button-start-poker"
              >
                <Users className="w-4 h-4 mr-2" />
                {startGameMutation.isPending ? "Starting..." : "Start Game"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roundComplete = currentRound?.status === 'complete';
  const iWonRound = currentRound?.winnerId === currentUser?.id;
  const roundWasTie = currentRound?.isTie;

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Spade className="w-5 h-5" />
              Poker - Round {game.currentRound}
            </CardTitle>
            <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
              {game.status === 'active' ? 'In Progress' : 'Complete'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 text-center">
            <div className="flex flex-col items-center">
              <Avatar className="w-12 h-12 mb-1">
                {currentUser?.avatarType === 'image' && currentUser.avatarUrl ? (
                  <AvatarImage src={currentUser.avatarUrl} />
                ) : (
                  <AvatarFallback>{currentUser?.avatar}</AvatarFallback>
                )}
              </Avatar>
              <span className="text-sm font-medium">{currentUser?.displayName || currentUser?.username}</span>
              <span className="text-2xl font-bold text-primary">{myWins}</span>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">vs</div>
            <div className="flex flex-col items-center">
              <Avatar className="w-12 h-12 mb-1">
                {opponent?.avatarType === 'image' && opponent.avatarUrl ? (
                  <AvatarImage src={opponent.avatarUrl} />
                ) : (
                  <AvatarFallback>{opponent?.avatar}</AvatarFallback>
                )}
              </Avatar>
              <span className="text-sm font-medium">{opponent?.displayName || opponent?.username}</span>
              <span className="text-2xl font-bold text-primary">{opponentWins}</span>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground mt-2">
            First to 10 wins
          </div>
        </CardContent>
      </Card>

      {game.status === 'completed' ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${game.winnerId === currentUser?.id ? 'text-yellow-500' : 'text-gray-400'}`} />
            <h2 className="text-2xl font-bold mb-2">
              {game.winnerId === currentUser?.id ? 'You Won!' : `${opponent?.displayName || opponent?.username} Won!`}
            </h2>
            <p className="text-muted-foreground">
              Final Score: {myWins} - {opponentWins}
            </p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/poker/current"] })}
              className="mt-4"
              variant="outline"
              data-testid="button-new-poker-game"
            >
              Start New Game
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Your Hand
                {inDiscardPhase && !hasSubmittedDiscards && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (Tap cards to discard: {selectedDiscards.length}/5)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {myCards.map((card, index) => (
                  <PlayingCard 
                    key={index} 
                    card={card} 
                    isHighlighted={roundComplete && myBestHand.includes(card)}
                    isSelected={selectedDiscards.includes(index)}
                    isSelectable={inDiscardPhase && !hasSubmittedDiscards}
                    onClick={() => toggleDiscard(index)}
                  />
                ))}
              </div>
              {roundComplete && myHandRank && (
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-4 py-1">
                    {myHandRank}
                  </Badge>
                </div>
              )}
              {inDiscardPhase && !hasSubmittedDiscards && (
                <div className="text-center mt-4">
                  <Button
                    onClick={() => discardMutation.mutate({ gameId: game.id, discardIndices: selectedDiscards })}
                    disabled={discardMutation.isPending}
                    data-testid="button-submit-discards"
                  >
                    {discardMutation.isPending 
                      ? "Submitting..." 
                      : selectedDiscards.length === 0 
                        ? "Keep All Cards" 
                        : `Discard ${selectedDiscards.length} Card${selectedDiscards.length > 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
              {inDiscardPhase && hasSubmittedDiscards && (
                <div className="text-center text-muted-foreground">
                  Waiting for opponent to select discards...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Opponent's Hand</CardTitle>
            </CardHeader>
            <CardContent>
              {roundComplete ? (
                <>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {JSON.parse(isPlayer1 ? currentRound!.player2Cards : currentRound!.player1Cards).map((card: string, index: number) => (
                      <PlayingCard 
                        key={index} 
                        card={card}
                        isHighlighted={opponentBestHand.includes(card)}
                      />
                    ))}
                  </div>
                  {opponentHandRank && (
                    <div className="text-center">
                      <Badge variant="outline" className="text-lg px-4 py-1">
                        {opponentHandRank}
                      </Badge>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {[...Array(7)].map((_, index) => (
                    <CardBack key={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {roundComplete ? (
            <Card className={`border-2 ${iWonRound ? 'border-green-500' : roundWasTie ? 'border-yellow-500' : 'border-red-500'}`}>
              <CardContent className="py-6 text-center">
                <h3 className="text-xl font-bold mb-2">
                  {roundWasTie ? "It's a Tie!" : iWonRound ? "You Won This Round!" : "Opponent Won This Round"}
                </h3>
                <p className="text-muted-foreground">
                  Next round will start automatically...
                </p>
              </CardContent>
            </Card>
          ) : inDrawnPhase ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {iAmReady ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                    <span>You: {iAmReady ? 'Ready' : 'Not Ready'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Opponent: {opponentReady ? 'Ready' : 'Waiting'}</span>
                    {opponentReady ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => readyMutation.mutate(game.id)}
                  disabled={iAmReady || readyMutation.isPending}
                  className="w-full"
                  data-testid="button-poker-ready"
                >
                  {readyMutation.isPending ? "Locking In..." : iAmReady ? "Waiting for Opponent..." : "Lock In Hand"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {rounds.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Round History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {rounds.filter(r => r.status === 'complete').map((round) => {
                    const playerWon = round.winnerId === currentUser?.id;
                    const wasTie = round.isTie;
                    const myRank = isPlayer1 ? round.player1HandRank : round.player2HandRank;
                    const theirRank = isPlayer1 ? round.player2HandRank : round.player1HandRank;
                    
                    return (
                      <div 
                        key={round.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          wasTie 
                            ? 'bg-yellow-100 dark:bg-yellow-900/20' 
                            : playerWon 
                              ? 'bg-green-100 dark:bg-green-900/20' 
                              : 'bg-red-100 dark:bg-red-900/20'
                        }`}
                      >
                        <span className="font-medium">Round {round.roundNumber}</span>
                        <div className="text-sm text-muted-foreground">
                          {myRank} vs {theirRank}
                        </div>
                        <Badge variant={wasTie ? 'outline' : playerWon ? 'default' : 'secondary'}>
                          {wasTie ? 'Tie' : playerWon ? 'Won' : 'Lost'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
