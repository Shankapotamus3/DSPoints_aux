import { Link, useLocation } from "wouter";
import { Home, CheckSquare, Gift, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/chores", label: "Chores", icon: CheckSquare },
  { path: "/rewards", label: "Rewards", icon: Gift },
  { path: "/family", label: "Family", icon: Users },
  { path: "/history", label: "History", icon: History },
];

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex space-x-8">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} href={path}>
              <button
                className={cn(
                  "py-4 px-2 border-b-2 transition-colors flex items-center space-x-2",
                  location === path
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`nav-${label.toLowerCase()}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
