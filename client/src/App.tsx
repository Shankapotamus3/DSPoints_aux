import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import NotFound from "./pages/not-found";
import Chores from "./pages/chores";
import Rewards from "./pages/rewards";
import Yahtzee from "./pages/yahtzee";
import Messages from "./pages/messages";
import Punishments from "./pages/punishments";
import Family from "./pages/family";
import History from "./pages/history";
import Login from "./pages/Login";
import PushTest from "./pages/push-test";
import Header from "./components/header";
import Navigation from "./components/navigation";
import { subscribeToPushNotifications, isPushNotificationSupported } from "./lib/pushNotifications";

// Protected route wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    }
  }, [isLoading, error, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Chores} />}
      </Route>
      <Route path="/chores">
        {() => <ProtectedRoute component={Chores} />}
      </Route>
      <Route path="/rewards">
        {() => <ProtectedRoute component={Rewards} />}
      </Route>
      <Route path="/yahtzee">
        {() => <ProtectedRoute component={Yahtzee} />}
      </Route>
      <Route path="/messages">
        {() => <ProtectedRoute component={Messages} />}
      </Route>
      <Route path="/punishments">
        {() => <ProtectedRoute component={Punishments} />}
      </Route>
      <Route path="/family">
        {() => <ProtectedRoute component={Family} />}
      </Route>
      <Route path="/history">
        {() => <ProtectedRoute component={History} />}
      </Route>
      <Route path="/push-test">
        {() => <ProtectedRoute component={PushTest} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [location, setLocation] = useLocation();
  
  // Check if user is authenticated
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.className = theme;
  }, [theme]);

  // Subscribe to push notifications when user logs in
  useEffect(() => {
    if (user) {
      const pushSupported = isPushNotificationSupported();
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasPushManager = 'PushManager' in window;
      const hasNotification = 'Notification' in window;
      
      console.log('Push notification support check:', pushSupported);
      console.log('ServiceWorker:', hasServiceWorker);
      console.log('PushManager:', hasPushManager);
      console.log('Notification:', hasNotification);
      
      // Report to server for debugging
      fetch('/api/debug/push-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supported: pushSupported,
          serviceWorker: hasServiceWorker,
          pushManager: hasPushManager,
          notification: hasNotification,
          userAgent: navigator.userAgent,
          notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable',
        }),
      }).catch(console.error);
      
      if (pushSupported) {
        // Delay subscription slightly to avoid blocking UI
        const timer = setTimeout(() => {
          console.log('Attempting to subscribe to push notifications...');
          subscribeToPushNotifications().catch(console.error);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        console.log('Push notifications not supported on this browser');
      }
    }
  }, [user]);

  // Listen for navigation messages from service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          setLocation(event.data.url);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [setLocation]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const isLoginPage = location === "/login";
  const showNavigation = !isLoginPage;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showNavigation && <Header theme={theme} onToggleTheme={toggleTheme} />}
      {showNavigation && <Navigation />}
      <Router />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
