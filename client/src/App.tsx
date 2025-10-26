import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import NotFound from "./pages/not-found";
import Dashboard from "./pages/dashboard";
import Chores from "./pages/chores";
import Rewards from "./pages/rewards";
import Messages from "./pages/messages";
import Punishments from "./pages/punishments";
import Family from "./pages/family";
import History from "./pages/history";
import Login from "./pages/Login";
import Header from "./components/header";
import Navigation from "./components/navigation";

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
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/chores">
        {() => <ProtectedRoute component={Chores} />}
      </Route>
      <Route path="/rewards">
        {() => <ProtectedRoute component={Rewards} />}
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
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [location] = useLocation();
  
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

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const isLoginPage = location === "/login";
  const showNavigation = !isLoginPage && user;

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
