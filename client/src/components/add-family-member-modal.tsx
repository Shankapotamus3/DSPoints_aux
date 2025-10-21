import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { InsertUser } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

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
    avatarType: "emoji",
    avatarUrl: undefined,
    pin: "",
  });
  
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [avatarTab, setAvatarTab] = useState<"emoji" | "upload">("emoji");
  
  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertUser, 'password' | 'isAdmin'>) => {
      // Create the user first with emoji avatar (images will be handled after user creation)
      const userData = {
        ...data,
        avatarType: "emoji", // Always start with emoji, image will be updated later
        avatarUrl: undefined
      };
      const response = await apiRequest("POST", "/api/users", userData);
      const user = await response.json();
      
      // If user selected an image avatar, handle it after user creation
      if (data.avatarType === "image" && data.avatarUrl) {
        try {
          // Now we can use the user-specific endpoint since user exists
          await apiRequest("PUT", `/api/users/${user.id}/avatar`, {
            avatarUrl: data.avatarUrl
          });
          // Update the returned user object to reflect the image avatar
          user.avatarType = "image";
          user.avatarUrl = data.avatarUrl;
        } catch (error) {
          console.error("Failed to set avatar:", error);
          throw new Error("User created but avatar upload failed. Please edit the user's profile to set their avatar.");
        }
      }
      
      return user;
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
      avatarType: "emoji",
      avatarUrl: undefined,
      pin: "",
    });
    setUploadedImageUrl(null);
    setAvatarTab("emoji");
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

          <div>
            <Label htmlFor="pin">PIN (4-6 digits)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={formData.pin || ""}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // Only allow digits
                setFormData({ ...formData, pin: value });
              }}
              placeholder="Set login PIN"
              data-testid="input-pin"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used for quick login access
            </p>
          </div>
          
          {/* Avatar Selection */}
          <div>
            <Label>Avatar</Label>
            <Tabs value={avatarTab} onValueChange={(value) => setAvatarTab(value as "emoji" | "upload")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="emoji" data-testid="tab-emoji-avatar">Emoji</TabsTrigger>
                <TabsTrigger value="upload" data-testid="tab-upload-avatar">Upload Image</TabsTrigger>
              </TabsList>
              
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-center">
                  <Avatar className="w-16 h-16 text-2xl border-2 border-border">
                    {formData.avatarType === "image" && uploadedImageUrl ? (
                      <AvatarImage src={uploadedImageUrl} alt="Uploaded avatar" />
                    ) : (
                      <AvatarFallback>{formData.avatar}</AvatarFallback>
                    )}
                  </Avatar>
                </div>
                
                <TabsContent value="emoji" className="space-y-2">
                  <div className="grid grid-cols-7 gap-2 max-h-32 overflow-y-auto">
                    {AVATAR_OPTIONS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => {
                          setFormData({ 
                            ...formData, 
                            avatar, 
                            avatarType: "emoji",
                            avatarUrl: undefined 
                          });
                          setUploadedImageUrl(null);
                        }}
                        className={`p-2 text-lg rounded-lg border transition-colors hover:bg-accent ${
                          formData.avatar === avatar && formData.avatarType === "emoji"
                            ? "border-primary bg-accent" 
                            : "border-border"
                        }`}
                        data-testid={`button-avatar-${avatar}`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="upload" className="space-y-3">
                  <div className="text-center">
                    <div className="p-6 border-2 border-dashed border-border rounded-lg">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-2xl">📷</span>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Image Avatars</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Image avatars can be added after creating the family member.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            For now, please select an emoji avatar above.
                          </p>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAvatarTab("emoji")}
                          data-testid="button-switch-to-emoji"
                        >
                          Choose Emoji Avatar
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      You can upload an image avatar by editing the profile after creation.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
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