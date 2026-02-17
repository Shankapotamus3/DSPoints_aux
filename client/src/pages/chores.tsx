import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckSquare, Clock, AlertCircle, CheckCircle, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChoreCard from "@/components/chore-card";
import AddChoreModal from "@/components/add-chore-modal";
import AdminApprovalModal from "@/components/admin-approval-modal";
import CelebrationOverlay from "@/components/celebration-overlay";
import VoiceRecorder from "@/components/voice-recorder";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chore, User } from "@shared/schema";

export default function Chores() {
  const [showAddChore, setShowAddChore] = useState(false);
  const [editChore, setEditChore] = useState<Chore | undefined>();
  const [celebrationData, setCelebrationData] = useState<{ 
    show: boolean; 
    points?: number; 
    newBalance?: number;
    type: 'completion' | 'approval' 
  }>({ 
    show: false, 
    points: 0, 
    newBalance: 0,
    type: 'completion'
  });

  const { data: chores = [] } = useQuery<Chore[]>({
    queryKey: ["/api/chores"],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: pendingApprovalChores = [] } = useQuery<Chore[]>({
    queryKey: ["/api/chores/pending-approval"],
    enabled: user?.isAdmin === true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter chores by status
  const pendingChores = chores.filter(chore => chore.status === 'pending');
  const awaitingApprovalChores = chores.filter(chore => chore.status === 'completed');
  const approvedChores = chores.filter(chore => chore.status === 'approved');
  const rejectedChores = chores.filter(chore => chore.status === 'rejected');

  const approveMutation = useMutation({
    mutationFn: async (data: { choreId: string, points: number, newBalance: number }) => {
      const response = await apiRequest("POST", `/api/chores/${data.choreId}/approve`, {});
      return { ...response.json(), ...data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chores/pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      // Trigger approval celebration with points
      setCelebrationData({ 
        show: true, 
        points: data.points, 
        newBalance: data.newBalance,
        type: 'approval'
      });
      
      toast({
        title: "Chore Approved! ✅",
        description: "The chore has been approved and points have been awarded.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve chore",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (choreId: string) => {
      const response = await apiRequest("POST", `/api/chores/${choreId}/reject`, {
        comment: "Chore needs to be redone"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chores/pending-approval"] });
      toast({
        title: "Chore Rejected",
        description: "The chore has been rejected with feedback.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject chore",
        variant: "destructive",
      });
    },
  });

  const handleChoreComplete = () => {
    // Show completion celebration (no points until approval)
    setCelebrationData({ show: true, type: 'completion' });
  };

  const handleChoreApprove = (choreId: string, points: number, newBalance: number) => {
    approveMutation.mutate({ choreId, points, newBalance });
  };

  const handleEditChore = (chore: Chore) => {
    setEditChore(chore);
    setShowAddChore(true);
  };

  const handleCloseModal = () => {
    setShowAddChore(false);
    setEditChore(undefined);
  };

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Chores</h1>
            <p className="text-muted-foreground">Manage your tasks and earn points</p>
          </div>
          <Button onClick={() => setShowAddChore(true)} data-testid="button-add-chore">
            <Plus className="mr-2" size={16} />
            Add Chore
          </Button>
        </div>

        {user?.isAdmin && pendingApprovalChores.length > 0 && (
          <div className="mb-6">
            <AdminApprovalModal pendingChores={pendingApprovalChores} />
          </div>
        )}

        {user?.isAdmin && (
          <div className="mb-6">
            <VoiceRecorder />
          </div>
        )}

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className={`grid w-full ${user?.isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="pending" className="flex items-center space-x-2">
              <Clock size={16} />
              <span>To Do ({pendingChores.length})</span>
            </TabsTrigger>
            <TabsTrigger value="awaiting" className="flex items-center space-x-2">
              <AlertCircle size={16} />
              <span>Awaiting ({awaitingApprovalChores.length})</span>
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center space-x-2">
              <CheckCircle size={16} />
              <span>Approved ({approvedChores.length})</span>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center space-x-2">
              <XCircle size={16} />
              <span>Rejected ({rejectedChores.length})</span>
            </TabsTrigger>
            {user?.isAdmin && (
              <TabsTrigger value="admin" className="flex items-center space-x-2">
                <Shield size={16} />
                <span>Admin ({pendingApprovalChores.length})</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingChores.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-semibold mb-2">No pending chores</h3>
                  <p className="text-muted-foreground mb-6">
                    Great job! You've completed all your pending chores. Add new ones to keep earning points.
                  </p>
                  <Button onClick={() => setShowAddChore(true)}>
                    <Plus className="mr-2" size={16} />
                    Add New Chore
                  </Button>
                </CardContent>
              </Card>
            ) : (
              pendingChores.map(chore => (
                <ChoreCard 
                  key={chore.id} 
                  chore={chore} 
                  onComplete={handleChoreComplete}
                  onEdit={handleEditChore}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="awaiting" className="space-y-4">
            {awaitingApprovalChores.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertCircle className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-semibold mb-2">No chores awaiting approval</h3>
                  <p className="text-muted-foreground">
                    Complete some chores to see them here awaiting admin approval.
                  </p>
                </CardContent>
              </Card>
            ) : (
              awaitingApprovalChores.map(chore => (
                <ChoreCard key={chore.id} chore={chore} showActions={false} />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedChores.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-semibold mb-2">No approved chores yet</h3>
                  <p className="text-muted-foreground">
                    Complete and get approval for chores to see your achievements here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              approvedChores.map(chore => (
                <ChoreCard key={chore.id} chore={chore} showActions={false} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedChores.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <XCircle className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-semibold mb-2">No rejected chores</h3>
                  <p className="text-muted-foreground">
                    Keep up the good work! No chores have been rejected.
                  </p>
                </CardContent>
              </Card>
            ) : (
              rejectedChores.map(chore => (
                <ChoreCard 
                  key={chore.id} 
                  chore={chore} 
                  showActions={false}
                />
              ))
            )}
          </TabsContent>

          {user?.isAdmin && (
            <TabsContent value="admin" className="space-y-4">
              {pendingApprovalChores.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Shield className="mx-auto mb-4 text-muted-foreground" size={64} />
                    <h3 className="text-xl font-semibold mb-2">No chores pending approval</h3>
                    <p className="text-muted-foreground">
                      All submitted chores have been reviewed. You'll see new submissions here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pendingApprovalChores.map(chore => (
                  <ChoreCard 
                    key={chore.id} 
                    chore={chore} 
                    showActions={false}
                    showApprovalActions={true}
                    onApprove={handleChoreApprove}
                    onReject={rejectMutation.mutate}
                  />
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      <AddChoreModal 
        open={showAddChore} 
        onClose={handleCloseModal}
        editChore={editChore}
      />

      <CelebrationOverlay 
        show={celebrationData.show}
        points={celebrationData.points}
        newBalance={celebrationData.newBalance}
        type={celebrationData.type}
        onClose={() => setCelebrationData({ show: false, points: 0, newBalance: 0, type: 'completion' })}
      />
    </>
  );
}
