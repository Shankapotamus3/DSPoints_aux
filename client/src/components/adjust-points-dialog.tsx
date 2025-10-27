import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Coins, Plus, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AdjustPointsDialogProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

export default function AdjustPointsDialog({ open, onClose, user }: AdjustPointsDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isAdding, setIsAdding] = useState(true);
  const { toast } = useToast();

  const adjustPointsMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/adjust-points`, { amount, reason });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to adjust points");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Points Adjusted",
        description: `Successfully ${isAdding ? 'added' : 'removed'} ${amount} points.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust points",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const numAmount = parseInt(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the adjustment.",
        variant: "destructive",
      });
      return;
    }

    const adjustmentAmount = isAdding ? numAmount : -numAmount;
    adjustPointsMutation.mutate({ userId: user.id, amount: adjustmentAmount, reason });
  };

  const handleClose = () => {
    setAmount("");
    setReason("");
    setIsAdding(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="dialog-adjust-points">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Adjust Points for {user.displayName || user.username}
          </DialogTitle>
          <DialogDescription>
            Add or remove points from this user's account. Current balance: <strong>{user.points.toLocaleString()} points</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add or Remove Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isAdding ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsAdding(true)}
              data-testid="button-add-mode"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Points
            </Button>
            <Button
              type="button"
              variant={!isAdding ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsAdding(false)}
              data-testid="button-remove-mode"
            >
              <Minus className="w-4 h-4 mr-2" />
              Remove Points
            </Button>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-amount"
            />
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Why are you adjusting points?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              data-testid="input-reason"
            />
          </div>

          {/* Preview */}
          {amount && parseInt(amount) > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Preview:</p>
              <p className="font-medium">
                {user.points.toLocaleString()} points 
                <span className={isAdding ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {' '}{isAdding ? '+' : '-'}{parseInt(amount).toLocaleString()}
                </span>
                {' '}= <strong>{Math.max(0, user.points + (isAdding ? parseInt(amount) : -parseInt(amount))).toLocaleString()} points</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={adjustPointsMutation.isPending}
            data-testid="button-confirm-adjust"
          >
            {adjustPointsMutation.isPending ? "Adjusting..." : `${isAdding ? 'Add' : 'Remove'} Points`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
