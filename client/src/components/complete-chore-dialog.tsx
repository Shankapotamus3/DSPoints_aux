import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Chore, VoiceMessage } from "@shared/schema";

interface CompleteChoreDialogProps {
  open: boolean;
  onClose: () => void;
  chore: Chore;
}

export default function CompleteChoreDialog({ open, onClose, chore }: CompleteChoreDialogProps) {
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const { data: voiceMessages = [] } = useQuery<VoiceMessage[]>({
    queryKey: ["/api/voice-messages"],
  });

  const playCompletionAudio = () => {
    if (chore.voiceMessageId === null) return;
    if (!chore.voiceMessageId) return;

    let msg;
    if (chore.voiceMessageId === "random" && voiceMessages.length > 0) {
      msg = voiceMessages[Math.floor(Math.random() * voiceMessages.length)];
    } else {
      msg = voiceMessages.find((m) => m.id === chore.voiceMessageId);
    }

    if (msg?.audioUrl) {
      try {
        const audio = new Audio(msg.audioUrl);
        audio.play().catch(() => {});
      } catch {}
    }
  };

  const completeMutation = useMutation({
    mutationFn: async (date: Date) => {
      const response = await apiRequest("POST", `/api/chores/${chore.id}/complete`, {
        completedAt: date.toISOString(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to complete chore");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      playCompletionAudio();
      toast({
        title: "Chore Completed!",
        description: `"${chore.name}" has been marked as completed and is pending approval.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete chore",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    completeMutation.mutate(completionDate);
  };

  const handleClose = () => {
    setCompletionDate(new Date());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="dialog-complete-chore">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            Complete Chore
          </DialogTitle>
          <DialogDescription>
            Mark "{chore.name}" as completed. Select the date when this chore was completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Completion Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-date-picker"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(completionDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(date) => date && setCompletionDate(date)}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                  data-testid="calendar-completion-date"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              You can only select today or a past date.
            </p>
          </div>

          {/* Chore Details */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">{chore.name}</p>
              {chore.description && (
                <p className="text-xs text-muted-foreground">{chore.description}</p>
              )}
              <p className="text-sm font-semibold text-primary">
                +{chore.points} points (pending approval)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={completeMutation.isPending}
            data-testid="button-confirm-complete"
          >
            {completeMutation.isPending ? "Completing..." : "Complete Chore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
