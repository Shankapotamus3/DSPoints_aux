import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Flame, Plus, Gift, CheckSquare, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import ChoreCard from "../components/chore-card";
import RewardCard from "../components/reward-card";
import AddChoreModal from "@/components/add-chore-modal";
import AddRewardModal from "@/components/add-reward-modal";
import CelebrationOverlay from "@/components/celebration-overlay";
import type { Chore, Reward, Transaction } from "@shared/schema";

export default function Dashboard() {
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ show: boolean; points: number; newBalance: number }>({ 
    show: false, 
    points: 0, 
    newBalance: 0 
  });

  const { data: chores = [] } = useQuery<Chore[]>({
    queryKey: ["/api/chores"],
  });

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  }) as { data: { points: number } | undefined };

  const pendingChores = chores.filter(chore => chore.status === 'pending').slice(0, 3);
  const availableRewards = rewards.filter(reward => reward.isAvailable && reward.cost <= (user?.points ?? 0)).slice(0, 3);
  const unavailableRewards = rewards.filter(reward => reward.isAvailable && reward.cost > (user?.points ?? 0)).slice(0, 1);
  const recentTransactions = transactions.slice(0, 3);

  const todayCompleted = chores.filter(chore => 
    chore.isCompleted && chore.completedAt && 
    new Date(chore.completedAt).toDateString() === new Date().toDateString()
  ).length;

  const todayTotal = chores.filter(chore => 
    new Date(chore.createdAt!).toDateString() === new Date().toDateString()
  ).length || Math.max(5, todayCompleted);

  const todayProgress = todayTotal > 0 ? (todayCompleted / todayTotal) * 100 : 0;

  // Calculate streak (simplified - consecutive days with completed chores)
  const streak = 7; // Placeholder for streak calculation

  const handleChoreComplete = (points: number, newBalance: number) => {
    setCelebrationData({ show: true, points, newBalance });
  };

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Dashboard Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Today's Progress */}
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-chart-1/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-chart-1" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Today's Progress</h3>
                    <p className="text-muted-foreground text-sm">{todayCompleted} of {todayTotal} chores completed</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{Math.round(todayProgress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-chart-1 h-2 rounded-full progress-bar-fill transition-all duration-300" 
                    style={{ width: `${todayProgress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Streak */}
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Flame className="text-accent" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Current Streak</h3>
                    <p className="text-muted-foreground text-sm">Keep it going!</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent mb-1">{streak}</div>
                <div className="text-muted-foreground text-sm">days in a row</div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => setShowAddChore(true)}
                  data-testid="button-add-chore"
                >
                  <Plus className="mr-2" size={16} />
                  Add New Chore
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => setShowAddReward(true)}
                  data-testid="button-browse-rewards"
                >
                  <Gift className="mr-2" size={16} />
                  Browse Rewards
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Chores */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Pending Chores</h2>
              <Button variant="link" asChild>
                <a href="/chores" data-testid="link-view-all-chores">
                  View All →
                </a>
              </Button>
            </div>

            {pendingChores.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">
                    <CheckSquare className="mx-auto mb-4" size={48} />
                    <p>No pending chores. Great job!</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pendingChores.map(chore => (
                <ChoreCard 
                  key={chore.id} 
                  chore={chore} 
                  onComplete={handleChoreComplete}
                />
              ))
            )}
          </div>

          {/* Available Rewards */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Available Rewards</h2>
              <Button variant="link" asChild>
                <a href="/rewards" data-testid="link-view-all-rewards">
                  View All →
                </a>
              </Button>
            </div>

            {availableRewards.length === 0 && unavailableRewards.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">
                    <Gift className="mx-auto mb-4" size={48} />
                    <p>No rewards available. Add some rewards to motivate yourself!</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {availableRewards.map(reward => (
                  <RewardCard 
                    key={reward.id} 
                    reward={reward} 
                    canAfford={true}
                  />
                ))}
                {unavailableRewards.map(reward => (
                  <RewardCard 
                    key={reward.id} 
                    reward={reward} 
                    canAfford={false}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Transaction History</h3>
                  <Button variant="link" asChild>
                    <a href="/history" data-testid="link-view-full-history">
                      View Full History
                    </a>
                  </Button>
                </div>
              </div>
              {recentTransactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <History className="mx-auto mb-4" size={48} />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTransactions.map(transaction => (
                    <div key={transaction.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          transaction.type === 'earn' ? 'bg-chart-1/20' : 'bg-chart-2/20'
                        }`}>
                          {transaction.type === 'earn' ? (
                            <Plus className="text-chart-1" size={16} />
                          ) : (
                            <Gift className="text-chart-2" size={16} />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">{transaction.description}</h4>
                          <p className="text-muted-foreground text-sm">
                            {new Date(transaction.createdAt!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`font-semibold ${
                        transaction.type === 'earn' ? 'text-chart-1' : 'text-chart-2'
                      }`}>
                        {transaction.type === 'earn' ? '+' : '-'}{transaction.amount} points
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AddChoreModal 
        open={showAddChore} 
        onClose={() => setShowAddChore(false)} 
      />
      
      <AddRewardModal 
        open={showAddReward} 
        onClose={() => setShowAddReward(false)} 
      />

      <CelebrationOverlay 
        show={celebrationData.show}
        points={celebrationData.points}
        newBalance={celebrationData.newBalance}
        onClose={() => setCelebrationData({ show: false, points: 0, newBalance: 0 })}
      />
    </>
  );
}
