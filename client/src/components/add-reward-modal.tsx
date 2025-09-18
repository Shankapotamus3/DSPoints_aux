import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertReward, Reward } from "@shared/schema";

const REWARD_CATEGORIES = {
  entertainment: { label: 'Entertainment', icon: '🎬' },
  treats: { label: 'Food & Treats', icon: '🍰' },
  activities: { label: 'Activities', icon: '🎯' },
  shopping: { label: 'Shopping', icon: '🛍️' },
  other: { label: 'Other', icon: '✨' }
};

interface AddRewardModalProps {
  open: boolean;
  onClose: () => void;
  editReward?: Reward;
}

export default function AddRewardModal({ open, onClose, editReward }: AddRewardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<InsertReward>({
    name: editReward?.name || "",
    description: editReward?.description || "",
    cost: editReward?.cost || 100,
    icon: editReward?.icon || "🎁",
    category: editReward?.category ?? "other",
    isAvailable: editReward?.isAvailable ?? true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertReward) => {
      const response = await apiRequest("POST", "/api/rewards", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: "Reward Created",
        description: "New reward has been added successfully!",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create reward",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertReward) => {
      const response = await apiRequest("PUT", `/api/rewards/${editReward!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: "Reward Updated",
        description: "Reward has been updated successfully!",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update reward",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editReward) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      cost: 100,
      icon: "🎁",
      category: "other",
      isAvailable: true,
    });
    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editReward ? "Edit Reward" : "Add New Reward"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Reward Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter reward name"
              required
              data-testid="input-reward-name"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the reward..."
              className="h-20"
              data-testid="input-reward-description"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cost">Point Cost</Label>
              <Input
                id="cost"
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                placeholder="100"
                min="1"
                required
                data-testid="input-reward-cost"
              />
            </div>
            <div>
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon || ""}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🎁"
                data-testid="input-reward-icon"
              />
            </div>
          </div>
          
          {/* Category Selection */}
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger data-testid="select-reward-category">
                <SelectValue placeholder="Select category" />
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
          
          <div className="flex space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleClose}
              data-testid="button-cancel-reward"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isLoading}
              data-testid="button-submit-reward"
            >
              {isLoading ? "Saving..." : editReward ? "Update Reward" : "Create Reward"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
