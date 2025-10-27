import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Check, Clock, CheckCircle, XCircle, HelpCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CompleteChoreDialog from "@/components/complete-chore-dialog";
import type { Chore, User, ChoreStatus } from "@shared/schema";

interface ChoreCardProps {
  chore: Chore;
  onComplete?: () => void;
  showActions?: boolean;
  onEdit?: (chore: Chore) => void;
  onDelete?: (choreId: string) => void;
  showApprovalActions?: boolean;
  onApprove?: (choreId: string, points: number, newBalance: number) => void;
  onReject?: (choreId: string) => void;
}

export default function ChoreCard({ 
  chore, 
  onComplete, 
  showActions = true,
  onEdit,
  onDelete,
  showApprovalActions = false,
  onApprove,
  onReject
}: ChoreCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  const assignedUser = chore.assignedToId ? users.find(u => u.id === chore.assignedToId) : null;
  
  const getStatusBadge = (status: ChoreStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <HelpCircle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Awaiting Approval
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };


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
            {getStatusBadge(chore.status as ChoreStatus)}
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
                <div className="flex items-center space-x-2 text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                  {assignedUser.avatarType === "image" && assignedUser.avatarUrl ? (
                    <img 
                      src={assignedUser.avatarUrl} 
                      alt={`${assignedUser.displayName || assignedUser.username}'s avatar`}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <span>{assignedUser.avatar}</span>
                  )}
                  <span>{assignedUser.displayName || assignedUser.username}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Regular actions for pending, approved, and rejected chores */}
          {showActions && (chore.status === 'pending' || chore.status === 'approved' || chore.status === 'rejected') && (
            <div className="flex items-center space-x-2">
              {onEdit && chore.status === 'pending' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEdit(chore)}
                  data-testid={`button-edit-chore-${chore.id}`}
                >
                  Edit
                </Button>
              )}
              {onDelete && chore.status === 'pending' && (
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
                onClick={() => setShowCompleteDialog(true)}
                className="celebration-bounce"
                data-testid={`button-complete-chore-${chore.id}`}
              >
                <Check className="mr-2" size={16} />
                Complete{(chore.status === 'approved' || chore.status === 'rejected') ? ' Again' : ''}
              </Button>
            </div>
          )}

          {/* Approval actions for completed chores (admin only) */}
          {showApprovalActions && chore.status === 'completed' && (
            <div className="flex items-center space-x-2">
              <Button 
                onClick={async () => {
                  // Get current user data to calculate points celebration
                  const userData = await queryClient.fetchQuery({ queryKey: ["/api/user"] });
                  const currentBalance = (userData as any)?.points || 0;
                  const newBalance = currentBalance + chore.points;
                  onApprove?.(chore.id, chore.points, newBalance);
                }}
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                data-testid={`button-approve-chore-${chore.id}`}
              >
                <CheckCircle className="mr-2" size={16} />
                Approve
              </Button>
              <Button 
                onClick={() => onReject?.(chore.id)}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50"
                data-testid={`button-reject-chore-${chore.id}`}
              >
                <XCircle className="mr-2" size={16} />
                Reject
              </Button>
            </div>
          )}
          
          {/* Status indicators */}
          {chore.status === 'completed' && !showApprovalActions && (
            <div className="flex items-center text-blue-600 text-sm font-medium">
              <AlertCircle className="mr-2" size={14} />
              Awaiting Approval
            </div>
          )}
          
          {chore.status === 'approved' && (
            <div className="flex items-center text-green-600 text-sm font-medium">
              <CheckCircle className="mr-2" size={14} />
              Approved
            </div>
          )}
          
          {chore.status === 'rejected' && (
            <div className="flex items-center text-red-600 text-sm font-medium">
              <XCircle className="mr-2" size={14} />
              Rejected
              {chore.approvalComment && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({chore.approvalComment})
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      <CompleteChoreDialog
        open={showCompleteDialog}
        onClose={() => {
          setShowCompleteDialog(false);
          onComplete?.(); // Trigger celebration when dialog closes after successful completion
        }}
        chore={chore}
      />
    </Card>
  );
}
