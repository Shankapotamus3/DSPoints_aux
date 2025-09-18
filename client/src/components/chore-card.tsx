import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chore, User } from "@shared/schema";

interface ChoreCardProps {
  chore: Chore;
  onComplete?: (points: number, newBalance: number) => void;
  showActions?: boolean;
  onEdit?: (chore: Chore) => void;
  onDelete?: (choreId: string) => void;
}

export default function ChoreCard({ 
  chore, 
  onComplete, 
  showActions = true,
  onEdit,
  onDelete 
}: ChoreCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  const assignedUser = chore.assignedToId ? users.find(u => u.id === chore.assignedToId) : null;

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/chores/${chore.id}/complete`);
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate and refetch user data to update balance throughout the app
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      // Get the updated user balance for the celebration callback
      const userResponse = await queryClient.fetchQuery({
        queryKey: ["/api/user"]
      });
      
      onComplete?.(chore.points, (userResponse as any).points);
      
      toast({
        title: "Chore Completed! 🎉",
        description: `You earned ${chore.points} points!`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete chore",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/chores/${chore.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      onDelete?.(chore.id);
      toast({
        title: "Chore Deleted",
        description: "Chore has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete chore",
        variant: "destructive",
      });
    },
  });

  const getChoreIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('clean') || lower.includes('vacuum')) return "🧹";
    if (lower.includes('dish') || lower.includes('kitchen')) return "🍽️";
    if (lower.includes('trash') || lower.includes('garbage')) return "🗑️";
    if (lower.includes('laundry')) return "👕";
    if (lower.includes('garden') || lower.includes('yard')) return "🌱";
    return "✨";
  };

  return (
    <Card className={`hover-lift ${chore.isCompleted ? 'opacity-60' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">{getChoreIcon(chore.name)}</span>
              </div>
              <div>
                <h3 className="font-semibold" data-testid={`text-chore-name-${chore.id}`}>{chore.name}</h3>
                {chore.description && (
                  <p className="text-muted-foreground text-sm" data-testid={`text-chore-description-${chore.id}`}>
                    {chore.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-accent/20 text-accent">
              <span className="mr-1">🪙</span>
              {chore.points}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {chore.estimatedTime && (
              <div className="flex items-center text-muted-foreground text-sm">
                <Clock className="mr-2" size={14} />
                <span>{chore.estimatedTime}</span>
              </div>
            )}
            {chore.isRecurring && (
              <div className="flex items-center text-muted-foreground text-sm">
                <span className="mr-1">🔄</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {chore.recurringType}
                </span>
              </div>
            )}
            {assignedUser && (
              <div className="flex items-center text-muted-foreground text-sm">
                <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                  {assignedUser.avatar} {assignedUser.displayName || assignedUser.username}
                </span>
              </div>
            )}
          </div>
          
          {showActions && !chore.isCompleted && (
            <div className="flex items-center space-x-2">
              {onEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEdit(chore)}
                  data-testid={`button-edit-chore-${chore.id}`}
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
                  data-testid={`button-delete-chore-${chore.id}`}
                >
                  Delete
                </Button>
              )}
              <Button 
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="celebration-bounce"
                data-testid={`button-complete-chore-${chore.id}`}
              >
                <Check className="mr-2" size={16} />
                Complete
              </Button>
            </div>
          )}
          
          {chore.isCompleted && (
            <div className="flex items-center text-chart-1 text-sm font-medium">
              <Check className="mr-2" size={14} />
              Completed
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
