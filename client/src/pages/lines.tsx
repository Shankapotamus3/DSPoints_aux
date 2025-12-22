import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, PenLine, Trash2, Plus, X, Delete, CornerDownLeft } from "lucide-react";
import type { AssignedLine, User } from "@shared/schema";

function VirtualKeyboard({ 
  onKeyPress, 
  onBackspace, 
  onSubmit,
  disabled 
}: { 
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const row1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const row2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const row3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];
  const specialChars = ['!', '@', '#', '$', '%', '&', '*', '(', ')', '-', '_', '+', '='];
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  
  const [showNumbers, setShowNumbers] = useState(false);
  const [showSpecial, setShowSpecial] = useState(false);
  const [isUpperCase, setIsUpperCase] = useState(false);

  const handleKeyPress = useCallback((key: string) => {
    if (disabled) return;
    const finalKey = isUpperCase ? key.toUpperCase() : key;
    onKeyPress(finalKey);
  }, [isUpperCase, onKeyPress, disabled]);

  const keyClass = "flex-1 min-w-[28px] h-10 md:h-12 rounded-lg font-medium text-sm md:text-base bg-muted hover:bg-muted/80 active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none";
  const specialKeyClass = "min-w-[40px] md:min-w-[50px] h-10 md:h-12 rounded-lg font-medium text-xs md:text-sm bg-secondary hover:bg-secondary/80 active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none";

  return (
    <div className="w-full bg-card border rounded-xl p-2 space-y-1.5 select-none" data-testid="virtual-keyboard">
      {showNumbers || showSpecial ? (
        <>
          <div className="flex gap-1">
            {(showSpecial ? specialChars.slice(0, 10) : numbers).map((key) => (
              <Button
                key={key}
                variant="ghost"
                className={keyClass}
                onClick={() => onKeyPress(key)}
                disabled={disabled}
                data-testid={`key-${key}`}
              >
                {key}
              </Button>
            ))}
          </div>
          {showSpecial && (
            <div className="flex gap-1 justify-center">
              {specialChars.slice(10).map((key) => (
                <Button
                  key={key}
                  variant="ghost"
                  className={keyClass}
                  onClick={() => onKeyPress(key)}
                  disabled={disabled}
                  data-testid={`key-${key}`}
                >
                  {key}
                </Button>
              ))}
              <Button
                variant="ghost"
                className={keyClass}
                onClick={() => onKeyPress("'")}
                disabled={disabled}
                data-testid="key-apostrophe"
              >
                '
              </Button>
              <Button
                variant="ghost"
                className={keyClass}
                onClick={() => onKeyPress('"')}
                disabled={disabled}
                data-testid="key-quote"
              >
                "
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-1">
            {row1.map((key) => (
              <Button
                key={key}
                variant="ghost"
                className={keyClass}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                data-testid={`key-${key}`}
              >
                {isUpperCase ? key.toUpperCase() : key}
              </Button>
            ))}
          </div>
          <div className="flex gap-1 px-3">
            {row2.map((key) => (
              <Button
                key={key}
                variant="ghost"
                className={keyClass}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                data-testid={`key-${key}`}
              >
                {isUpperCase ? key.toUpperCase() : key}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              className={specialKeyClass}
              onClick={() => setIsUpperCase(!isUpperCase)}
              disabled={disabled}
              data-testid="key-shift"
            >
              {isUpperCase ? "⬆" : "⇧"}
            </Button>
            {row3.map((key) => (
              <Button
                key={key}
                variant="ghost"
                className={keyClass}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                data-testid={`key-${key}`}
              >
                {isUpperCase ? key.toUpperCase() : key}
              </Button>
            ))}
            <Button
              variant="ghost"
              className={specialKeyClass}
              onClick={onBackspace}
              disabled={disabled}
              data-testid="key-backspace"
            >
              <Delete size={18} />
            </Button>
          </div>
        </>
      )}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          className={specialKeyClass}
          onClick={() => { setShowNumbers(!showNumbers); setShowSpecial(false); }}
          disabled={disabled}
          data-testid="key-123"
        >
          123
        </Button>
        <Button
          variant="ghost"
          className={specialKeyClass}
          onClick={() => { setShowSpecial(!showSpecial); setShowNumbers(false); }}
          disabled={disabled}
          data-testid="key-symbols"
        >
          #+=
        </Button>
        <Button
          variant="ghost"
          className="flex-1 h-10 md:h-12 rounded-lg font-medium text-sm bg-muted hover:bg-muted/80 active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none"
          onClick={() => onKeyPress(' ')}
          disabled={disabled}
          data-testid="key-space"
        >
          space
        </Button>
        <Button
          variant="ghost"
          className={specialKeyClass}
          onClick={() => onKeyPress('.')}
          disabled={disabled}
          data-testid="key-period"
        >
          .
        </Button>
        <Button
          variant="ghost"
          className={specialKeyClass}
          onClick={() => onKeyPress(',')}
          disabled={disabled}
          data-testid="key-comma"
        >
          ,
        </Button>
        <Button
          variant="default"
          className={specialKeyClass + " bg-primary text-primary-foreground hover:bg-primary/90"}
          onClick={onSubmit}
          disabled={disabled}
          data-testid="key-submit"
        >
          <CornerDownLeft size={18} />
        </Button>
      </div>
    </div>
  );
}

function TypingInterface({ 
  line, 
  onComplete 
}: { 
  line: AssignedLine; 
  onComplete: () => void;
}) {
  const [typedText, setTypedText] = useState("");
  const [showError, setShowError] = useState(false);
  const { toast } = useToast();

  const progressMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const response = await apiRequest("POST", `/api/lines/${lineId}/progress`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lines/my"] });
      setTypedText("");
      if (data.isCompleted) {
        toast({
          title: "Assignment Complete!",
          description: "You've finished writing all the lines!",
        });
        onComplete();
      } else {
        toast({
          title: "Line Completed!",
          description: `${data.completedCount} of ${data.requiredCount} done.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleKeyPress = (key: string) => {
    setShowError(false);
    setTypedText((prev) => prev + key);
  };

  const handleBackspace = () => {
    setShowError(false);
    setTypedText((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (typedText === line.lineText) {
      progressMutation.mutate(line.id);
    } else {
      setShowError(true);
      toast({
        title: "Incorrect",
        description: "The text doesn't match. Please type the line exactly as shown.",
        variant: "destructive",
      });
    }
  };

  const getCharacterStatus = (index: number) => {
    if (index >= typedText.length) return "pending";
    return typedText[index] === line.lineText[index] ? "correct" : "incorrect";
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">Progress</p>
        <div className="flex items-center justify-center gap-2">
          <Progress value={(line.completedCount / line.requiredCount) * 100} className="w-48" />
          <span className="text-sm font-medium">{line.completedCount} / {line.requiredCount}</span>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">Type this line:</p>
        <p className="text-lg font-medium break-words" data-testid="target-line">{line.lineText}</p>
      </div>

      <div 
        className={`p-4 rounded-lg border-2 min-h-[80px] ${showError ? 'border-destructive bg-destructive/10' : 'border-border bg-background'}`}
        data-testid="typing-area"
      >
        <div className="flex flex-wrap font-mono text-lg">
          {line.lineText.split('').map((char, index) => (
            <span
              key={index}
              className={`
                ${getCharacterStatus(index) === 'correct' ? 'text-green-600 dark:text-green-400' : ''}
                ${getCharacterStatus(index) === 'incorrect' ? 'text-destructive bg-destructive/20' : ''}
                ${getCharacterStatus(index) === 'pending' ? 'text-muted-foreground/30' : ''}
                ${index === typedText.length ? 'border-l-2 border-primary animate-pulse' : ''}
              `}
            >
              {char === ' ' ? '\u00A0' : (index < typedText.length ? typedText[index] : char)}
            </span>
          ))}
          {typedText.length >= line.lineText.length && typedText.length > 0 && (
            <span className="border-l-2 border-primary animate-pulse">&nbsp;</span>
          )}
        </div>
      </div>

      <VirtualKeyboard
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onSubmit={handleSubmit}
        disabled={progressMutation.isPending}
      />
    </div>
  );
}

function AssignLineDialog({ 
  users, 
  onClose 
}: { 
  users: User[]; 
  onClose: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [lineText, setLineText] = useState("");
  const [requiredCount, setRequiredCount] = useState("10");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: { userId: string; lineText: string; requiredCount: number }) => {
      const response = await apiRequest("POST", "/api/lines", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({
        title: "Lines Assigned",
        description: "The user has been notified of their assignment.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign lines. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !lineText || !requiredCount) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      userId,
      lineText: lineText.trim(),
      requiredCount: parseInt(requiredCount, 10),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="user">Assign To</Label>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger data-testid="select-user">
            <SelectValue placeholder="Select a user" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.displayName || user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lineText">Line to Write</Label>
        <Input
          id="lineText"
          value={lineText}
          onChange={(e) => setLineText(e.target.value)}
          placeholder="I will be respectful."
          data-testid="input-line-text"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="count">Number of Times</Label>
        <Input
          id="count"
          type="number"
          min="1"
          max="1000"
          value={requiredCount}
          onChange={(e) => setRequiredCount(e.target.value)}
          data-testid="input-count"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-assign">
          {createMutation.isPending ? "Assigning..." : "Assign Lines"}
        </Button>
      </div>
    </form>
  );
}

export default function Lines() {
  const [selectedLine, setSelectedLine] = useState<AssignedLine | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const { toast } = useToast();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: lines = [], isLoading } = useQuery<AssignedLine[]>({
    queryKey: ["/api/lines"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/lines/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({
        title: "Deleted",
        description: "The line assignment has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isAdmin = currentUser?.isAdmin;
  const myLines = lines.filter((l) => l.userId === currentUser?.id && !l.isCompleted);
  const pendingLines = isAdmin ? lines.filter((l) => !l.isCompleted) : myLines;
  const completedLines = lines.filter((l) => l.isCompleted);

  if (selectedLine) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 pb-32">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedLine(null)}
            data-testid="button-back"
          >
            <X className="mr-2" size={18} />
            Back
          </Button>
          <Badge variant="outline">
            {selectedLine.completedCount} / {selectedLine.requiredCount}
          </Badge>
        </div>
        <TypingInterface 
          line={selectedLine} 
          onComplete={() => setSelectedLine(null)} 
        />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Lines</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Assign and track writing lines" : "Complete your assigned writing lines"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-assign-lines">
                <Plus className="mr-2" size={18} />
                Assign Lines
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Lines</DialogTitle>
              </DialogHeader>
              <AssignLineDialog 
                users={users} 
                onClose={() => setShowAssignDialog(false)} 
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenLine size={20} />
                Pending ({pendingLines.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLines.length === 0 ? (
                <div className="text-center py-8">
                  <PenLine className="mx-auto mb-4 text-muted-foreground" size={48} />
                  <p className="text-muted-foreground">
                    {isAdmin ? "No pending line assignments" : "No lines to write! You're all caught up."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLines.map((line) => {
                    const assignedUser = users.find((u) => u.id === line.userId);
                    const isMyLine = line.userId === currentUser?.id;
                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`line-${line.id}`}
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium truncate">{line.lineText}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress 
                              value={(line.completedCount / line.requiredCount) * 100} 
                              className="w-24 h-2" 
                            />
                            <span className="text-sm text-muted-foreground">
                              {line.completedCount}/{line.requiredCount}
                            </span>
                            {isAdmin && assignedUser && (
                              <Badge variant="secondary" className="text-xs">
                                {assignedUser.displayName || assignedUser.username}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isMyLine && (
                            <Button
                              size="sm"
                              onClick={() => setSelectedLine(line)}
                              data-testid={`button-start-${line.id}`}
                            >
                              Start
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(line.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${line.id}`}
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {completedLines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Check size={20} />
                  Completed ({completedLines.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedLines.map((line) => {
                    const assignedUser = users.find((u) => u.id === line.userId);
                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-muted/30 opacity-60"
                        data-testid={`line-completed-${line.id}`}
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium truncate line-through">{line.lineText}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Check size={14} className="text-green-500" />
                            <span className="text-sm text-muted-foreground">
                              {line.requiredCount} times
                            </span>
                            {isAdmin && assignedUser && (
                              <Badge variant="secondary" className="text-xs">
                                {assignedUser.displayName || assignedUser.username}
                              </Badge>
                            )}
                            {line.completedAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(line.completedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(line.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-completed-${line.id}`}
                          >
                            <Trash2 size={16} className="text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
