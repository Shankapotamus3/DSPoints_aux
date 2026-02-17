import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mic, Square, Play, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VoiceMessage } from "@shared/schema";

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: activeMessage } = useQuery<VoiceMessage | null>({
    queryKey: ["/api/voice-message"],
  });

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to record a voice message.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playPreview = () => {
    if (!recordedUrl && !activeMessage?.audioUrl) return;
    const url = recordedUrl || activeMessage?.audioUrl;
    if (!url) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    const audio = new Audio(url);
    audioRef.current = audio;
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play().catch(() => setIsPlaying(false));
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!recordedBlob) throw new Error("No recording to upload");

      const urlRes = await apiRequest("GET", "/api/voice-message/upload-url");
      const { uploadURL } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: recordedBlob,
        headers: { "Content-Type": "audio/webm" },
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const urlObj = new URL(uploadURL);
      const objectPath = urlObj.origin + urlObj.pathname;

      const saveRes = await apiRequest("POST", "/api/voice-message", { objectPath });
      return saveRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-message"] });
      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      toast({
        title: "Voice Message Saved",
        description: "The completion voice message has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Could not save the voice message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!activeMessage) throw new Error("No message to delete");
      await apiRequest("DELETE", `/api/voice-message/${activeMessage.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-message"] });
      toast({
        title: "Voice Message Removed",
        description: "The completion voice message has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove the voice message.",
        variant: "destructive",
      });
    },
  });

  const discardRecording = () => {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="w-4 h-4" />
          Chore Completion Voice Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Record a voice message that plays when family members complete a chore.
        </p>

        {activeMessage && !recordedBlob && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={playPreview}
              disabled={isPlaying}
            >
              <Play className="w-4 h-4 mr-1" />
              {isPlaying ? "Playing..." : "Play Current"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isRecording && !recordedBlob && (
            <Button variant="outline" size="sm" onClick={startRecording}>
              <Mic className="w-4 h-4 mr-1" />
              {activeMessage ? "Record New" : "Record Message"}
            </Button>
          )}

          {isRecording && (
            <Button variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="w-4 h-4 mr-1" />
              Stop Recording
            </Button>
          )}

          {recordedBlob && (
            <>
              <Button variant="outline" size="sm" onClick={playPreview} disabled={isPlaying}>
                <Play className="w-4 h-4 mr-1" />
                {isPlaying ? "Playing..." : "Preview"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={discardRecording}>
                Discard
              </Button>
            </>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            Recording...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
