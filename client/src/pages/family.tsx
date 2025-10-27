import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, UserCircle, Crown, Edit, Shield, ShieldOff, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AddFamilyMemberModal from "@/components/add-family-member-modal";
import EditProfileModal from "@/components/edit-profile-modal";
import AdjustPointsDialog from "@/components/adjust-points-dialog";
import type { User } from "@shared/schema";

export default function Family() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [adjustingPointsUser, setAdjustingPointsUser] = useState<User | null>(null);
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const response = await apiRequest("PUT", `/api/users/${userId}/admin`, { isAdmin });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update admin status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Admin Status Updated",
        description: "User's admin privileges have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    },
  });

  const handleAdminToggle = (userId: string, currentAdminStatus: boolean) => {
    // Prevent admin from removing their own admin status if they're the last admin
    if (currentAdminStatus && userId === currentUser?.id) {
      const adminCount = users.filter(u => u.isAdmin).length;
      if (adminCount <= 1) {
        toast({
          title: "Cannot Remove Admin",
          description: "You cannot remove your own admin privileges as the last admin.",
          variant: "destructive",
        });
        return;
      }
    }
    
    toggleAdminMutation.mutate({ userId, isAdmin: !currentAdminStatus });
  };

  const isCurrentUserAdmin = currentUser?.isAdmin || false;

  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Family Members</h1>
            <p className="text-muted-foreground">Manage your family members and their roles</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted rounded-full w-16 mx-auto"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Family Members</h1>
            <p className="text-muted-foreground">Manage your family members and their roles</p>
          </div>
          <Button onClick={() => setShowAddMember(true)} data-testid="button-add-family-member">
            <Plus className="mr-2" size={16} />
            Add Family Member
          </Button>
        </div>

        {users.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="mx-auto mb-4 text-muted-foreground" size={64} />
              <h3 className="text-xl font-semibold mb-2">No family members yet</h3>
              <p className="text-muted-foreground mb-6">
                Add family members to assign chores and track their progress.
              </p>
              <Button onClick={() => setShowAddMember(true)}>
                <Plus className="mr-2" size={16} />
                Add Your First Family Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <Card key={user.id} className="hover:shadow-md transition-shadow" data-testid={`card-user-${user.id}`}>
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center space-x-2">
                    <CardTitle className="text-lg" data-testid={`text-username-${user.id}`}>
                      {user.displayName || user.username}
                    </CardTitle>
                    {user.isAdmin && (
                      <Crown className="text-amber-500" size={16} />
                    )}
                  </div>
                  {user.displayName && (
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  )}
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <Avatar className="w-16 h-16 mx-auto text-2xl">
                      {user.avatarType === "image" && user.avatarUrl ? (
                        <AvatarImage 
                          src={user.avatarUrl} 
                          alt={`${user.displayName || user.username}'s avatar`}
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback>{user.avatar}</AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <Badge variant="secondary" data-testid={`text-points-${user.id}`}>
                        {user.points.toLocaleString()} points
                      </Badge>
                      {isCurrentUserAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => setAdjustingPointsUser(user)}
                          data-testid={`button-adjust-points-${user.id}`}
                        >
                          <Coins className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
                      <UserCircle size={12} />
                      <span>Member since creation</span>
                    </div>
                    
                    {/* Admin Toggle - Only visible to admins */}
                    {isCurrentUserAdmin && (
                      <div className="flex items-center justify-center space-x-2 mt-3 p-2 bg-muted/50 rounded-lg">
                        {user.isAdmin ? (
                          <Shield className="w-4 h-4 text-amber-500" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Label 
                          htmlFor={`admin-toggle-${user.id}`} 
                          className="text-xs cursor-pointer"
                        >
                          Admin
                        </Label>
                        <Switch
                          id={`admin-toggle-${user.id}`}
                          checked={user.isAdmin}
                          onCheckedChange={() => handleAdminToggle(user.id, user.isAdmin)}
                          disabled={toggleAdminMutation.isPending}
                          data-testid={`switch-admin-${user.id}`}
                        />
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setEditingUser(user)}
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AddFamilyMemberModal 
        open={showAddMember} 
        onClose={() => setShowAddMember(false)}
      />
      
      {editingUser && (
        <EditProfileModal
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
        />
      )}

      {adjustingPointsUser && (
        <AdjustPointsDialog
          open={!!adjustingPointsUser}
          onClose={() => setAdjustingPointsUser(null)}
          user={adjustingPointsUser}
        />
      )}
    </>
  );
}