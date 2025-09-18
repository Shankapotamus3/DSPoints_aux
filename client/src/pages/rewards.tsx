import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Gift, Coins, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RewardCard from "@/components/reward-card";
import AddRewardModal from "@/components/add-reward-modal";
import type { Reward } from "@shared/schema";

const REWARD_CATEGORIES = {
  all: { label: 'All Categories', icon: '🎁' },
  entertainment: { label: 'Entertainment', icon: '🎬' },
  treats: { label: 'Food & Treats', icon: '🍰' },
  activities: { label: 'Activities', icon: '🎯' },
  shopping: { label: 'Shopping', icon: '🛍️' },
  other: { label: 'Other', icon: '✨' }
};

export default function Rewards() {
  const [showAddReward, setShowAddReward] = useState(false);
  const [editReward, setEditReward] = useState<Reward | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  }) as { data: { points: number } | undefined };

  const userPoints = user?.points ?? 0;
  
  // Filter by category first
  const filteredRewards = selectedCategory === 'all' 
    ? rewards 
    : rewards.filter(reward => reward.category === selectedCategory);
  
  const availableRewards = filteredRewards.filter(reward => reward.isAvailable && reward.cost <= userPoints);
  const expensiveRewards = filteredRewards.filter(reward => reward.isAvailable && reward.cost > userPoints);

  const handleEditReward = (reward: Reward) => {
    setEditReward(reward);
    setShowAddReward(true);
  };

  const handleCloseModal = () => {
    setShowAddReward(false);
    setEditReward(undefined);
  };

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Rewards</h1>
            <p className="text-muted-foreground">Spend your points on exciting rewards</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-accent/10 px-4 py-2 rounded-lg border">
              <Coins className="text-accent" size={16} />
              <span className="font-semibold">{userPoints.toLocaleString()}</span>
              <span className="text-muted-foreground text-sm">points</span>
            </div>
            <Button onClick={() => setShowAddReward(true)} data-testid="button-add-reward">
              <Plus className="mr-2" size={16} />
              Add Reward
            </Button>
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <Filter size={16} className="text-muted-foreground" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="select-reward-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REWARD_CATEGORIES).map(([key, category]) => (
                  <SelectItem key={key} value={key}>
                    {category.icon} {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available" className="flex items-center space-x-2">
              <Gift size={16} />
              <span>Available ({availableRewards.length})</span>
            </TabsTrigger>
            <TabsTrigger value="expensive" className="flex items-center space-x-2">
              <Coins size={16} />
              <span>Save Up ({expensiveRewards.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {availableRewards.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Gift className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-semibold mb-2">No rewards available</h3>
                  <p className="text-muted-foreground mb-6">
                    {rewards.length === 0 
                      ? "Add some rewards to motivate yourself!" 
                      : "Complete more chores to earn points for rewards."}
                  </p>
                  <Button onClick={() => setShowAddReward(true)}>
                    <Plus className="mr-2" size={16} />
                    Add Your First Reward
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {availableRewards.map(reward => (
                  <RewardCard 
                    key={reward.id} 
                    reward={reward} 
                    canAfford={true}
                    onEdit={handleEditReward}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="expensive" className="space-y-4">
            {expensiveRewards.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Coins className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-semibold mb-2">No expensive rewards</h3>
                  <p className="text-muted-foreground">
                    All available rewards are within your budget! Great job earning points.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {expensiveRewards.map(reward => (
                  <RewardCard 
                    key={reward.id} 
                    reward={reward} 
                    canAfford={false}
                    onEdit={handleEditReward}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AddRewardModal 
        open={showAddReward} 
        onClose={handleCloseModal}
        editReward={editReward}
      />
    </>
  );
}
