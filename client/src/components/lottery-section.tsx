import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ticket, Sparkles, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LotteryTicket } from "@shared/schema";

const LOTTERY_COST = 20;

export default function LotterySection() {
  const [showHistory, setShowHistory] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  }) as { data: { points: number; id: string } | undefined };

  const { data: lotteryHistory = [] } = useQuery<LotteryTicket[]>({
    queryKey: ["/api/lottery/tickets"],
    enabled: showHistory,
  });

  const drawTicket = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/lottery/draw', {}) as Promise<{
        ticket: LotteryTicket;
        user: { points: number };
        netChange: number;
      }>;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lottery/tickets"] });
      
      setLastResult(data);
      
      const netChange = data.netChange;
      if (netChange > 0) {
        toast({
          title: "🎉 You won!",
          description: `${data.ticket.outcome} (+${netChange} points)`,
        });
      } else if (netChange < 0) {
        toast({
          title: "😞 Sorry!",
          description: `${data.ticket.outcome} (${netChange} points)`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "🎟️ Lottery Result",
          description: data.ticket.outcome,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to draw lottery ticket",
        variant: "destructive",
      });
    },
  });

  const handleDraw = async () => {
    setIsDrawing(true);
    setLastResult(null);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await drawTicket.mutateAsync();
    setIsDrawing(false);
  };

  const canAfford = (user?.points ?? 0) >= LOTTERY_COST;

  return (
    <>
      <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-2 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Ticket className="text-purple-500" size={24} />
            <span>Lottery Tickets</span>
            <Sparkles className="text-yellow-500" size={20} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Try your luck!</p>
              <p className="text-2xl font-bold text-purple-500">{LOTTERY_COST} points per ticket</p>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowHistory(true)}
                data-testid="button-lottery-history"
              >
                History
              </Button>
              <Button 
                onClick={handleDraw}
                disabled={!canAfford || isDrawing || drawTicket.isPending}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                data-testid="button-draw-lottery"
              >
                {isDrawing || drawTicket.isPending ? (
                  <>
                    <Sparkles className="mr-2 animate-spin" size={16} />
                    Drawing...
                  </>
                ) : (
                  <>
                    <Ticket className="mr-2" size={16} />
                    Draw Ticket
                  </>
                )}
              </Button>
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
              <AlertCircle size={16} />
              <span>You need {LOTTERY_COST - (user?.points ?? 0)} more points to purchase a ticket</span>
            </div>
          )}

          {lastResult && (
            <div className={`p-4 rounded-lg border-2 ${
              lastResult.netChange > 0 
                ? 'bg-green-50 dark:bg-green-950/30 border-green-500' 
                : lastResult.netChange < 0
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500'
                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-500'
            }`}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {lastResult.netChange > 0 ? (
                    <TrendingUp className="text-green-600" size={24} />
                  ) : lastResult.netChange < 0 ? (
                    <TrendingDown className="text-red-600" size={24} />
                  ) : (
                    <Sparkles className="text-blue-600" size={24} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{lastResult.ticket.outcome}</p>
                  {lastResult.ticket.specialReward && (
                    <p className="text-sm text-muted-foreground mt-1">{lastResult.ticket.specialReward}</p>
                  )}
                  <p className="text-sm font-medium mt-2">
                    {lastResult.netChange > 0 && (
                      <span className="text-green-600">+{lastResult.netChange} points</span>
                    )}
                    {lastResult.netChange < 0 && (
                      <span className="text-red-600">{lastResult.netChange} points</span>
                    )}
                    {lastResult.netChange === 0 && lastResult.ticket.pointsAwarded === 0 && (
                      <span className="text-muted-foreground">No point change</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lottery History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            {lotteryHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket size={48} className="mx-auto mb-4 opacity-50" />
                <p>No lottery tickets drawn yet</p>
                <p className="text-sm">Purchase your first ticket to see your history</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lotteryHistory.map((ticket) => (
                  <Card key={ticket.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{ticket.outcome}</p>
                          {ticket.specialReward && (
                            <p className="text-sm text-muted-foreground mt-1">{ticket.specialReward}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(ticket.createdAt).toLocaleDateString()} at {new Date(ticket.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className={`text-right ${
                          ticket.pointsAwarded > 0 ? 'text-green-600' : 
                          ticket.pointsAwarded < 0 ? 'text-red-600' : 
                          'text-muted-foreground'
                        }`}>
                          {ticket.pointsAwarded > 0 && `+${ticket.pointsAwarded}`}
                          {ticket.pointsAwarded < 0 && ticket.pointsAwarded}
                          {ticket.pointsAwarded === 0 && '—'}
                          <p className="text-xs">points</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
