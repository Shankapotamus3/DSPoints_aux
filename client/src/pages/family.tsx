import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, UserCircle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AddFamilyMemberModal from "@/components/add-family-member-modal";
import type { User } from "@shared/schema";

export default function Family() {
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
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
      <main className="max-w-6xl mx-auto px-4 py-8">
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
                      <Crown className="text-amber-500" size={16} title="Admin" />
                    )}
                  </div>
                  {user.displayName && (
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  )}
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <Avatar className="w-16 h-16 mx-auto text-2xl">
                      <AvatarFallback>{user.avatar}</AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <Badge variant="secondary" data-testid={`text-points-${user.id}`}>
                        {user.points.toLocaleString()} points
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
                      <UserCircle size={12} />
                      <span>Member since creation</span>
                    </div>
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
    </>
  );
}