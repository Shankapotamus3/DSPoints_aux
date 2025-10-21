import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, Delete } from "lucide-react";

interface LoginUser {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string;
  avatarType: string;
  avatarUrl: string | null;
  hasPin: boolean;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState("");
  const [showError, setShowError] = useState(false);

  // Fetch all users for login selection
  const { data: users, isLoading } = useQuery<LoginUser[]>({
    queryKey: ["/api/auth/users"],
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ userId, pin }: { userId: string; pin: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", { userId, pin });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome back! 🎉",
        description: "You've successfully logged in!",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      setShowError(true);
      setPin("");
      setTimeout(() => setShowError(false), 500);
      toast({
        title: "Incorrect PIN",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle PIN number press
  const handleNumberPress = (num: string) => {
    if (pin.length < 6) {
      setPin(pin + num);
    }
  };

  // Handle delete/backspace
  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  // Auto-submit when PIN reaches 4-6 digits
  useEffect(() => {
    if (pin.length >= 4 && pin.length <= 6 && selectedUser) {
      loginMutation.mutate({ userId: selectedUser.id, pin });
    }
  }, [pin, selectedUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(220,15%,97%)] to-[hsl(260,85%,98%)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[hsl(220,15%,97%)] to-[hsl(260,85%,98%)] relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-[hsl(145,70%,55%)] rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[hsl(35,95%,65%)] rounded-full blur-3xl opacity-20" />
      <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-[hsl(260,85%,65%)] rounded-full blur-3xl opacity-15" />

      <Card className="w-full max-w-2xl p-8 md:p-12 rounded-3xl shadow-2xl bg-white relative z-10">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex justify-center">
            <Star className="w-12 h-12 text-[hsl(35,95%,65%)] fill-current" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(230,25%,20%)]" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            {selectedUser ? `Hi, ${selectedUser.displayName || selectedUser.username}!` : "Who's Ready to Help?"}
          </h1>
          <p className="text-base text-[hsl(230,15%,45%)]">
            {selectedUser ? "Enter your PIN to continue" : "Select your profile to get started"}
          </p>
        </div>

        {!selectedUser ? (
          /* Profile Selection Grid */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {users?.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  if (!user.hasPin) {
                    toast({
                      title: "PIN Not Set",
                      description: "This user hasn't set up a PIN yet. Please ask an admin to set one up.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setSelectedUser(user);
                }}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-[hsl(220,15%,97%)] transition-all hover:scale-105 active:scale-95"
                data-testid={`button-select-user-${user.id}`}
              >
                <div className={`rounded-full ${!user.hasPin ? 'opacity-50' : ''}`}>
                  <Avatar className="w-20 h-20 md:w-24 md:h-24 text-3xl border-4 border-transparent">
                    {user.avatarType === "image" && user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />
                    ) : (
                      <AvatarFallback>{user.avatar}</AvatarFallback>
                    )}
                  </Avatar>
                </div>
                <span className="text-lg font-semibold text-[hsl(230,25%,20%)]" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  {user.displayName || user.username}
                </span>
                {!user.hasPin && (
                  <span className="text-xs text-[hsl(0,75%,60%)]">No PIN set</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* PIN Entry Section */
          <div className="space-y-8">
            {/* Selected User Display */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-24 h-24 text-4xl border-4 border-[hsl(260,85%,65%)]">
                {selectedUser.avatarType === "image" && selectedUser.avatarUrl ? (
                  <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.username} className="object-cover" />
                ) : (
                  <AvatarFallback>{selectedUser.avatar}</AvatarFallback>
                )}
              </Avatar>
            </div>

            {/* PIN Display */}
            <div className={`h-16 rounded-2xl bg-[hsl(220,15%,97%)] border-2 flex items-center justify-center ${
              showError ? 'border-[hsl(0,75%,60%)] animate-shake' : 'border-[hsl(220,15%,90%)]'
            }`}>
              <div className="flex gap-3 text-3xl tracking-widest" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {[...Array(6)].map((_, i) => (
                  <span key={i} className="w-3 h-3">
                    {pin[i] ? '●' : '○'}
                  </span>
                ))}
              </div>
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  onClick={() => handleNumberPress(num.toString())}
                  disabled={loginMutation.isPending}
                  className="h-16 md:h-18 text-2xl md:text-3xl font-bold rounded-2xl bg-[hsl(220,20%,95%)] hover:bg-[hsl(260,85%,65%)] hover:text-white text-[hsl(230,25%,20%)] transition-all active:scale-95"
                  data-testid={`button-pin-${num}`}
                >
                  {num}
                </Button>
              ))}
              
              {/* Empty space */}
              <div />
              
              {/* Zero button */}
              <Button
                onClick={() => handleNumberPress("0")}
                disabled={loginMutation.isPending}
                className="h-16 md:h-18 text-2xl md:text-3xl font-bold rounded-2xl bg-[hsl(220,20%,95%)] hover:bg-[hsl(260,85%,65%)] hover:text-white text-[hsl(230,25%,20%)] transition-all active:scale-95"
                data-testid="button-pin-0"
              >
                0
              </Button>
              
              {/* Delete button */}
              <Button
                onClick={handleDelete}
                disabled={loginMutation.isPending}
                className="h-16 md:h-18 rounded-2xl bg-[hsl(220,20%,95%)] hover:bg-[hsl(0,75%,60%)] hover:text-white text-[hsl(230,25%,20%)] transition-all active:scale-95"
                data-testid="button-pin-delete"
              >
                <Delete className="w-6 h-6" />
              </Button>
            </div>

            {/* Back button */}
            <div className="text-center pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedUser(null);
                  setPin("");
                }}
                disabled={loginMutation.isPending}
                className="text-[hsl(230,15%,45%)]"
                data-testid="button-back-to-profiles"
              >
                ← Back to profiles
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 mt-6 border-t border-[hsl(220,15%,90%)]">
          <p className="text-sm text-[hsl(230,15%,45%)]">
            Forgot your PIN? Ask a parent or admin for help!
          </p>
        </div>
      </Card>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
