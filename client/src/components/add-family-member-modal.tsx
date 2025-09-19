import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertUser } from "@shared/schema";

interface AddFamilyMemberModalProps {
  open: boolean;
  onClose: () => void;
}

const AVATAR_OPTIONS = [
  "👤", "👨", "👩", "🧑", "👦", "👧", "👴", "👵", 
  "👶", "👨‍💼", "👩‍💼", "👨‍🎓", "👩‍🎓", "👨‍🍳", "👩‍🍳", 
  "👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🚀", "👩‍🚀"
];

export default function AddFamilyMemberModal({ open, onClose }: AddFamilyMemberModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<Omit<InsertUser, 'password' | 'isAdmin'>>({
    username: "",
    displayName: "",
    avatar: "👤",
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertUser, 'password' | 'isAdmin'>) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Family Member Added",
        description: "New family member has been added successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add family member",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      toast({
        title: "Validation Error",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({
      username: "",
      displayName: "",
      avatar: "👤",
    });
    onClose();
  };

  const isLoading = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Enter username"
              required
              data-testid="input-username"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used for identification and must be unique
            </p>
          </div>
          
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName || ""}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Enter display name (optional)"
              data-testid="input-display-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Friendly name shown in the app (optional)
            </p>
          </div>
          
          {/* Avatar Selection */}
          <div>
            <Label>Avatar</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <Avatar className="w-16 h-16 text-2xl border-2 border-border">
                  <AvatarFallback>{formData.avatar}</AvatarFallback>
                </Avatar>
              </div>
              
              <div className="grid grid-cols-7 gap-2 max-h-32 overflow-y-auto">
                {AVATAR_OPTIONS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar })}
                    className={`p-2 text-lg rounded-lg border transition-colors hover:bg-accent ${
                      formData.avatar === avatar 
                        ? "border-primary bg-accent" 
                        : "border-border"
                    }`}
                    data-testid={`button-avatar-${avatar}`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleClose}
              data-testid="button-cancel-family-member"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isLoading}
              data-testid="button-submit-family-member"
            >
              {isLoading ? "Adding..." : "Add Family Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}