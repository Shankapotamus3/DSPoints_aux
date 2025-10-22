import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Image as ImageIcon, Loader2, X } from "lucide-react";
import { format } from "date-fns";

interface User {
  id: string;
  displayName: string;
  username: string;
  avatar: string;
  avatarType: string;
  avatarUrl: string | null;
}

interface Message {
  id: string;
  senderId: string;
  recipientId: string | null;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Messages() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Get all users
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Get conversation with selected user
  const { data: conversation = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages/conversation", selectedUserId],
    enabled: !!selectedUserId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { recipientId: string; content: string; imageUrl?: string | null }) => {
      const response = await apiRequest("POST", "/api/messages", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversation", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      setMessageInput("");
      setUploadedImageUrl(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Get upload URL for message image
      const uploadResponse = await apiRequest("GET", "/api/messages/image-upload");
      const { uploadURL } = await uploadResponse.json();

      // Upload file to object storage using PUT method
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      // Extract the object path from the signed URL (remove query parameters)
      const urlObj = new URL(uploadURL);
      const objectPath = urlObj.origin + urlObj.pathname;

      // Finalize the upload to get the public URL
      const finalizeResponse = await apiRequest("POST", "/api/messages/image-finalize", {
        objectPath,
      });
      const { imageUrl } = await finalizeResponse.json();

      setUploadedImageUrl(imageUrl);
      
      toast({
        title: "Image uploaded",
        description: "Your image is ready to send",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!selectedUserId) return;
    if (!messageInput.trim() && !uploadedImageUrl) return;

    sendMessageMutation.mutate({
      recipientId: selectedUserId,
      content: messageInput.trim() || "(Image message)",
      imageUrl: uploadedImageUrl,
    });
  };

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const otherUsers = users?.filter(u => u.id !== currentUser?.id);

  // Auto-scroll to bottom when conversation changes or user selects a conversation
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, selectedUserId]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 pb-24 md:pb-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">Messages</h1>

      <Card className="h-[calc(100vh-16rem)] md:h-[calc(100vh-12rem)] flex flex-col md:flex-row overflow-hidden">
        {/* User List - Sidebar */}
        <div className="w-full md:w-80 border-b md:border-r border-border bg-muted/20">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg">Family Members</h2>
          </div>
          <ScrollArea className="h-[200px] md:h-[calc(100vh-16rem)]">
            <div className="p-2">
              {otherUsers?.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted ${
                    selectedUserId === user.id ? "bg-primary/10 border border-primary/20" : ""
                  }`}
                  data-testid={`button-select-user-${user.id}`}
                >
                  <Avatar className="w-10 h-10">
                    {user.avatarType === "image" && user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                    ) : (
                      <AvatarFallback className="text-2xl">{user.avatar}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="text-left flex-1">
                    <div className="font-medium">{user.displayName || user.username}</div>
                    <div className="text-xs text-muted-foreground">@{user.username}</div>
                  </div>
                </button>
              ))}
              {(!otherUsers || otherUsers.length === 0) && (
                <div className="text-center text-muted-foreground p-4">
                  No family members to message
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 flex flex-col">
          {selectedUserId && selectedUser ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {selectedUser.avatarType === "image" && selectedUser.avatarUrl ? (
                    <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.displayName} />
                  ) : (
                    <AvatarFallback className="text-2xl">{selectedUser.avatar}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <div className="font-semibold">{selectedUser.displayName || selectedUser.username}</div>
                  <div className="text-xs text-muted-foreground">@{selectedUser.username}</div>
                </div>
              </div>

              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 min-h-0"
              >
                <div className="space-y-4">
                  {conversation.map((message) => {
                    const isSent = message.senderId === currentUser?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] md:max-w-md rounded-2xl px-4 py-2 ${
                            isSent
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="Message attachment"
                              className="rounded-lg mb-2 max-w-full"
                            />
                          )}
                          <div className="break-words">{message.content}</div>
                          <div className={`text-xs mt-1 ${isSent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {format(new Date(message.createdAt), "h:mm a")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {conversation.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                </div>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-muted/20">
                {uploadedImageUrl && (
                  <div className="mb-2 relative inline-block">
                    <img src={uploadedImageUrl} alt="Preview" className="max-h-20 rounded-lg" />
                    <button
                      onClick={() => setUploadedImageUrl(null)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      disabled={isUploading}
                      data-testid="input-image-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isUploading}
                      asChild
                    >
                      <span>
                        {isUploading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <ImageIcon size={18} />
                        )}
                      </span>
                    </Button>
                  </label>
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || (!messageInput.trim() && !uploadedImageUrl)}
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a family member to start messaging
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
