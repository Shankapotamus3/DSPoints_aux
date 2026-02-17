import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertChore, Chore, User, VoiceMessage } from "@shared/schema";

interface AddChoreModalProps {
  open: boolean;
  onClose: () => void;
  editChore?: Chore;
}

export default function AddChoreModal({ open, onClose, editChore }: AddChoreModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<InsertChore>({
    name: editChore?.name || "",
    description: editChore?.description || "",
    points: editChore?.points || 50,
    estimatedTime: editChore?.estimatedTime || "",
    isRecurring: editChore?.isRecurring || false,
    recurringType: (editChore?.recurringType as 'daily' | 'weekly' | 'monthly') || undefined,
    assignedToId: editChore?.assignedToId || undefined,
    voiceMessageId: editChore?.voiceMessageId || undefined,
  });
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: voiceMessages = [] } = useQuery<VoiceMessage[]>({
    queryKey: ["/api/voice-messages"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertChore) => {
      const response = await apiRequest("POST", "/api/chores", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Chore Created",
        description: "New chore has been added successfully!",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create chore",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertChore) => {
      const response = await apiRequest("PUT", `/api/chores/${editChore!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Chore Updated",
        description: "Chore has been updated successfully!",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update chore",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editChore) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      points: 50,
      estimatedTime: "",
      isRecurring: false,
      recurringType: undefined,
      assignedToId: undefined,
      voiceMessageId: undefined,
    });
    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editChore ? "Edit Chore" : "Add New Chore"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Chore Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter chore name"
              required
              data-testid="input-chore-name"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the chore..."
              className="h-20"
              data-testid="input-chore-description"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="points">Point Value</Label>
              <Input
                id="points"
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                placeholder="50"
                min="1"
                required
                data-testid="input-chore-points"
              />
            </div>
            <div>
              <Label htmlFor="estimatedTime">Estimated Time</Label>
              <Input
                id="estimatedTime"
                value={formData.estimatedTime || ""}
                onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                placeholder="30 minutes"
                data-testid="input-chore-time"
              />
            </div>
          </div>
          
          {/* Family Member Assignment */}
          <div>
            <Label htmlFor="assignedTo">Assign To</Label>
            <Select
              value={formData.assignedToId || "unassigned"}
              onValueChange={(value) => 
                setFormData({ ...formData, assignedToId: value === "unassigned" ? undefined : value })
              }
            >
              <SelectTrigger data-testid="select-assigned-to">
                <SelectValue placeholder="Choose family member (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Anyone</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.avatar} {user.displayName || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Completion Voice Message */}
          <div>
            <Label htmlFor="voiceMessage">Completion Sound</Label>
            <Select
              value={formData.voiceMessageId === null ? "none" : (formData.voiceMessageId || "default")}
              onValueChange={(value) => 
                setFormData({ 
                  ...formData, 
                  voiceMessageId: value === "default" ? undefined : (value === "none" ? null : value)
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose completion sound" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (no sound)</SelectItem>
                <SelectItem value="none">No sound</SelectItem>
                {voiceMessages.length > 0 && (
                  <SelectItem value="random">Random</SelectItem>
                )}
                {voiceMessages.map(msg => (
                  <SelectItem key={msg.id} value={msg.id}>
                    {msg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a voice message to play when this chore is completed. "Random" picks a different one each time.
            </p>
          </div>

          {/* Recurring Chore Options */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isRecurring" className="text-base font-medium">Recurring Chore</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically resets when completed
                </p>
              </div>
              <Switch
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  isRecurring: checked,
                  recurringType: checked ? 'daily' : undefined
                })}
                data-testid="switch-recurring"
              />
            </div>
            
            {formData.isRecurring && (
              <div>
                <Label htmlFor="recurringType">Repeat Schedule</Label>
                <Select
                  value={formData.recurringType}
                  onValueChange={(value) => 
                    setFormData({ ...formData, recurringType: value as 'daily' | 'weekly' | 'monthly' })
                  }
                >
                  <SelectTrigger data-testid="select-recurring-type">
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleClose}
              data-testid="button-cancel-chore"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isLoading}
              data-testid="button-submit-chore"
            >
              {isLoading ? "Saving..." : editChore ? "Update Chore" : "Create Chore"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
