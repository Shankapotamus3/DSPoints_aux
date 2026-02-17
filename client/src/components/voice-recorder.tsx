import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mic, Square, Play, Trash2, Upload, Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VoiceMessage } from "@shared/schema";

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState("");
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: voiceMessages = [] } = useQuery<VoiceMessage[]>({
    queryKey: ["/api/voice-messages"],
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

  const playAudio = (url: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setIsPlaying(id);
    audio.onended = () => setIsPlaying(null);
    audio.onerror = () => setIsPlaying(null);
    audio.play().catch(() => setIsPlaying(null));
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!recordedBlob) throw new Error("No recording to upload");
      if (!recordingName.trim()) throw new Error("Name is required");

      const urlRes = await apiRequest("GET", "/api/voice-message/upload-url");
      const { uploadURL, cloudinaryParams, storageType } = await urlRes.json();

      let saveBody: Record<string, string>;

      if (storageType === "cloudinary" && cloudinaryParams) {
        const formData = new FormData();
        formData.append("file", recordedBlob);
        formData.append("api_key", cloudinaryParams.apiKey);
        formData.append("timestamp", cloudinaryParams.timestamp.toString());
        formData.append("signature", cloudinaryParams.signature);
        formData.append("folder", cloudinaryParams.folder);

        const uploadRes = await fetch(uploadURL, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const result = await uploadRes.json();
        saveBody = { audioUrl: result.secure_url, name: recordingName.trim() };
      } else {
        const uploadRes = await fetch(uploadURL, {
          method: "PUT",
          body: recordedBlob,
          headers: { "Content-Type": "audio/webm" },
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const urlObj = new URL(uploadURL);
        const objectPath = urlObj.origin + urlObj.pathname;
        saveBody = { objectPath, name: recordingName.trim() };
      }

      const saveRes = await apiRequest("POST", "/api/voice-message", saveBody);
      return saveRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-messages"] });
      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setRecordingName("");
      toast({
        title: "Voice Message Saved",
        description: "The recording has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Could not save the voice message.",
        variant: "destructive",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/voice-message/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-messages"] });
      setEditingId(null);
      setEditName("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename the recording.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/voice-message/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Recording Removed",
        description: "The voice recording has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove the recording.",
        variant: "destructive",
      });
    },
  });

  const discardRecording = () => {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordingName("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="w-4 h-4" />
          Completion Voice Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Record voice messages that can play when family members complete chores.
          Assign them to individual chores in the chore settings.
        </p>

        {voiceMessages.length > 0 && (
          <div className="space-y-2">
            {voiceMessages.map((msg) => (
              <div key={msg.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                {editingId === msg.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => renameMutation.mutate({ id: msg.id, name: editName })}
                      disabled={!editName.trim() || renameMutation.isPending}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingId(null); setEditName(""); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium flex-1 truncate">{msg.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => playAudio(msg.audioUrl, msg.id)}
                      disabled={isPlaying === msg.id}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingId(msg.id); setEditName(msg.name); }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(msg.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {recordedBlob && (
          <div className="space-y-2 p-3 border rounded-lg">
            <Input
              placeholder="Name this recording..."
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => playAudio(recordedUrl!, "preview")}
                disabled={isPlaying === "preview"}
              >
                <Play className="w-4 h-4 mr-1" />
                {isPlaying === "preview" ? "Playing..." : "Preview"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !recordingName.trim()}
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
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isRecording && !recordedBlob && (
            <Button variant="outline" size="sm" onClick={startRecording}>
              <Mic className="w-4 h-4 mr-1" />
              Record New Message
            </Button>
          )}

          {isRecording && (
            <Button variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="w-4 h-4 mr-1" />
              Stop Recording
            </Button>
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
