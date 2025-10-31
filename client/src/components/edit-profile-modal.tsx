import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { User } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

const AVATAR_OPTIONS = [
  "👤", "👨", "👩", "🧑", "👦", "👧", "👴", "👵", 
  "👶", "👨‍💼", "👩‍💼", "👨‍🎓", "👩‍🎓", "👨‍🍳", "👩‍🍳", 
  "👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🚀", "👩‍🚀"
];

export default function EditProfileModal({ open, onClose, user }: EditProfileModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    displayName: user.displayName || "",
    avatar: user.avatar,
    avatarType: user.avatarType || "emoji",
    avatarUrl: user.avatarUrl,
    pin: "",
  });
  
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(
    user.avatarType === "image" && user.avatarUrl ? user.avatarUrl : null
  );
  const [avatarTab, setAvatarTab] = useState<"emoji" | "upload">(
    user.avatarType === "image" ? "upload" : "emoji"
  );
  
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<User>) => {
      // If uploading a new image, handle avatar URL update
      if (updates.avatarType === "image" && updates.avatarUrl) {
        console.log("🖼️  Updating avatar with URL:", updates.avatarUrl);
        const response = await apiRequest("PUT", `/api/users/${user.id}/avatar`, {
          avatarUrl: updates.avatarUrl
        });
        const result = await response.json();
        console.log("✅ Avatar update response:", result);
        return result;
      } else {
        // Just update user fields
        console.log("📝 Updating user profile:", updates);
        const response = await apiRequest("PUT", `/api/users/${user.id}`, updates);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only include PIN if it was entered
    const updates = { ...formData };
    if (!updates.pin) {
      delete updates.pin;
    }
    updateMutation.mutate(updates);
  };

  const handleClose = () => {
    setFormData({
      displayName: user.displayName || "",
      avatar: user.avatar,
      avatarType: user.avatarType || "emoji",
      avatarUrl: user.avatarUrl,
      pin: "",
    });
    setUploadedImageUrl(user.avatarType === "image" && user.avatarUrl ? user.avatarUrl : null);
    setAvatarTab(user.avatarType === "image" ? "upload" : "emoji");
    onClose();
  };

  const isLoading = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Enter display name (optional)"
              data-testid="input-edit-display-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Friendly name shown in the app
            </p>
          </div>

          <div>
            <Label htmlFor="pin">PIN (4-6 digits)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={formData.pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // Only allow digits
                setFormData({ ...formData, pin: value });
              }}
              placeholder={user.pin ? "Enter new PIN to change" : "Set your PIN"}
              data-testid="input-edit-pin"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {user.pin ? "Leave blank to keep current PIN" : "Required for login"}
            </p>
          </div>
          
          {/* Avatar Selection */}
          <div>
            <Label>Avatar</Label>
            <Tabs value={avatarTab} onValueChange={(value) => setAvatarTab(value as "emoji" | "upload")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="emoji" data-testid="tab-edit-emoji-avatar">Emoji</TabsTrigger>
                <TabsTrigger value="upload" data-testid="tab-edit-upload-avatar">Upload Image</TabsTrigger>
              </TabsList>
              
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-center">
                  <Avatar className="w-16 h-16 text-2xl border-2 border-border">
                    {formData.avatarType === "image" && uploadedImageUrl ? (
                      <AvatarImage src={uploadedImageUrl} alt="Profile avatar" className="object-cover" />
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
                            avatarUrl: null 
                          });
                          setUploadedImageUrl(null);
                        }}
                        className={`p-2 text-lg rounded-lg border transition-colors hover:bg-accent ${
                          formData.avatar === avatar && formData.avatarType === "emoji"
                            ? "border-primary bg-accent" 
                            : "border-border"
                        }`}
                        data-testid={`button-edit-avatar-${avatar}`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="upload" className="space-y-3">
                  <div className="text-center">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB limit for avatars
                      onGetUploadParameters={async () => {
                        const response = await apiRequest("POST", `/api/users/${user.id}/avatar-upload`);
                        const data = await response.json();
                        console.log("Backend upload params:", data);
                        
                        // Return the full data from backend (includes uploadURL and cloudinaryParams)
                        return data;
                      }}
                      onComplete={(result) => {
                        console.log("Upload complete, result:", result);
                        if (result.successful && result.successful.length > 0) {
                          const file = result.successful[0];
                          console.log("Successful file:", file);
                          
                          // Get the avatar URL - ObjectUploader sets file.uploadURL for both storage types
                          const avatarUrl = file.uploadURL;
                          console.log("Avatar URL from uploadURL:", avatarUrl);
                          
                          if (avatarUrl) {
                            console.log("✅ Setting avatar URL in form:", avatarUrl);
                            setUploadedImageUrl(avatarUrl);
                            setFormData({
                              ...formData,
                              avatarType: "image",
                              avatarUrl,
                            });
                            toast({
                              title: "Avatar Uploaded!",
                              description: "Your avatar image has been uploaded successfully.",
                            });
                          } else {
                            console.error("❌ No URL found in upload result");
                            console.error("File object:", file);
                            toast({
                              title: "Upload Error",
                              description: "Upload completed but could not get the file URL",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>📷</span>
                        <span>Upload New Avatar</span>
                      </div>
                    </ObjectUploader>
                    <p className="text-xs text-muted-foreground mt-2">
                      JPG, PNG, or GIF up to 5MB
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
              data-testid="button-cancel-edit-profile"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isLoading}
              data-testid="button-save-profile"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}