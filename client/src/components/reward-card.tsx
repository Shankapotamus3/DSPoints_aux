import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Reward } from "@shared/schema";

interface RewardCardProps {
  reward: Reward;
  canAfford: boolean;
  onEdit?: (reward: Reward) => void;
  onDelete?: (rewardId: string) => void;
  showActions?: boolean;
}

export default function RewardCard({ 
  reward, 
  canAfford, 
  onEdit, 
  onDelete,
  showActions = true 
}: RewardCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rewards/${reward.id}/claim`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      toast({
        title: "Reward Claimed! 🎉",
        description: `You've claimed ${reward.name}!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to claim reward",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rewards/${reward.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      onDelete?.(reward.id);
      toast({
        title: "Reward Deleted",
        description: "Reward has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete reward",
        variant: "destructive",
      });
    },
  });

  const getRewardEmoji = (icon: string, name: string) => {
    if (icon && icon !== 'gift') return icon;
    
    const lower = name.toLowerCase();
    if (lower.includes('ice cream') || lower.includes('treat')) return "🍦";
    if (lower.includes('movie') || lower.includes('film')) return "🎬";
    if (lower.includes('game') || lower.includes('gaming')) return "🎮";
    if (lower.includes('shopping') || lower.includes('shop')) return "🛒";
    if (lower.includes('book')) return "📚";
    if (lower.includes('music')) return "🎵";
    return "🎁";
  };

  return (
    <Card className={`hover-lift ${!canAfford ? 'opacity-60' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Reward image placeholder */}
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">{getRewardEmoji(reward.icon || '', reward.name)}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1" data-testid={`text-reward-name-${reward.id}`}>
              {reward.name}
            </h3>
            {reward.description && (
              <p className="text-muted-foreground text-sm mb-3" data-testid={`text-reward-description-${reward.id}`}>
                {reward.description}
              </p>
            )}
            <div className="flex items-center justify-between">
              <Badge 
                variant="secondary" 
                className={canAfford ? "bg-chart-4/20 text-chart-4" : "bg-muted text-muted-foreground"}
              >
                <span className="mr-1">🪙</span>
                {reward.cost} points
              </Badge>
              
              {showActions && (
                <div className="flex items-center space-x-2">
                  {onEdit && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onEdit(reward)}
                      data-testid={`button-edit-reward-${reward.id}`}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-reward-${reward.id}`}
                    >
                      Delete
                    </Button>
                  )}
                  <Button 
                    onClick={() => claimMutation.mutate()}
                    disabled={!canAfford || claimMutation.isPending}
                    data-testid={`button-claim-reward-${reward.id}`}
                  >
                    {canAfford ? "Claim" : "Need More Points"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
