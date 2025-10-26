import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dices, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import type { Punishment } from "@shared/schema";

export default function Punishments() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: punishments = [] } = useQuery<Punishment[]>({
    queryKey: ["/api/punishments"],
  });

  const createPunishmentMutation = useMutation({
    mutationFn: async (number: number) => {
      const response = await apiRequest("POST", "/api/punishments", {
        number,
        isCompleted: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punishments"] });
      toast({
        title: "Number generated!",
        description: "New punishment added to the list.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/punishments/${id}/complete`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punishments"] });
      toast({
        title: "Punishment completed!",
        description: "Good job finishing it!",
      });
    },
    onError: () => {
      toast({
        title: "Failed to mark complete",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTextMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const response = await apiRequest("PUT", `/api/punishments/${id}`, { text });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punishments"] });
    },
    onError: () => {
      toast({
        title: "Failed to update",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deletePunishmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/punishments/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punishments"] });
      toast({
        title: "Punishment deleted",
        description: "Removed from the list.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateRandomNumber = () => {
    setIsGenerating(true);
    
    // Random number between 1 and 59
    const randomNum = Math.floor(Math.random() * 59) + 1;
    
    // Add a small delay for effect
    setTimeout(() => {
      createPunishmentMutation.mutate(randomNum);
      setIsGenerating(false);
    }, 500);
  };

  const incompletePunishments = punishments.filter(p => !p.isCompleted);
  const completedPunishments = punishments.filter(p => p.isCompleted);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Punishments</h1>
          <p className="text-muted-foreground">Generate random numbers (1-59) and track completion</p>
        </div>
        <Button 
          onClick={generateRandomNumber} 
          disabled={isGenerating || createPunishmentMutation.isPending}
          size="lg"
          data-testid="button-generate-number"
        >
          <Dices className="mr-2" size={20} />
          {isGenerating ? "Generating..." : "Generate Number"}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Incomplete Punishments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pending ({incompletePunishments.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incompletePunishments.length === 0 ? (
              <div className="text-center py-12">
                <Dices className="mx-auto mb-4 text-muted-foreground" size={64} />
                <h3 className="text-xl font-semibold mb-2">No pending punishments</h3>
                <p className="text-muted-foreground mb-6">
                  Click the "Generate Number" button to add a punishment
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {incompletePunishments.map((punishment) => (
                  <div
                    key={punishment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4"
                    data-testid={`punishment-${punishment.id}`}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => markCompleteMutation.mutate(punishment.id)}
                        disabled={markCompleteMutation.isPending}
                        data-testid={`checkbox-complete-${punishment.id}`}
                      />
                      <Badge variant="default" className="text-lg px-3 py-1 flex-shrink-0">
                        {punishment.number}
                      </Badge>
                      <Input
                        type="text"
                        placeholder="Add note..."
                        defaultValue={punishment.text || ""}
                        onBlur={(e) => updateTextMutation.mutate({ id: punishment.id, text: e.target.value })}
                        className="flex-1"
                        data-testid={`input-text-${punishment.id}`}
                      />
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        {new Date(punishment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePunishmentMutation.mutate(punishment.id)}
                      disabled={deletePunishmentMutation.isPending}
                      data-testid={`button-delete-${punishment.id}`}
                    >
                      <Trash2 size={18} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Punishments */}
        {completedPunishments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed ({completedPunishments.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {completedPunishments.map((punishment) => (
                  <div
                    key={punishment.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-muted/30 opacity-60 gap-4"
                    data-testid={`punishment-completed-${punishment.id}`}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <Check size={20} className="text-green-500 flex-shrink-0" />
                      <Badge variant="secondary" className="text-lg px-3 py-1 flex-shrink-0">
                        {punishment.number}
                      </Badge>
                      {punishment.text && (
                        <span className="text-sm text-muted-foreground line-through flex-1">
                          {punishment.text}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        Completed {punishment.completedAt ? new Date(punishment.completedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePunishmentMutation.mutate(punishment.id)}
                      disabled={deletePunishmentMutation.isPending}
                      data-testid={`button-delete-completed-${punishment.id}`}
                    >
                      <Trash2 size={18} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
