import { Link, useLocation } from "wouter";
import { CheckSquare, Gift, History, Users, MessageCircle, Dices, Trophy, Spade, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/chores", label: "Chores", icon: CheckSquare },
  { path: "/rewards", label: "Rewards", icon: Gift },
  { path: "/yahtzee", label: "Yahtzee", icon: Trophy },
  { path: "/poker", label: "Poker", icon: Spade },
  { path: "/messages", label: "Messages", icon: MessageCircle },
  { path: "/lines", label: "Lines", icon: PenLine },
  { path: "/family", label: "Family", icon: Users },
  { path: "/history", label: "History", icon: History },
];

export default function Navigation() {
  const [location] = useLocation();

  return (
    <>
      {/* Desktop Navigation - horizontal tabs */}
      <nav className="hidden md:block border-b border-border bg-card">
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

      {/* Mobile Navigation - bottom bar with horizontal scroll */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm pb-safe">
        <div className="overflow-x-auto">
          <div className="flex items-center px-2 py-2 min-w-max">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link key={path} href={path}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-4 min-w-[64px] rounded-lg transition-all whitespace-nowrap",
                    location === path
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground active:bg-muted"
                  )}
                  data-testid={`nav-mobile-${label.toLowerCase()}`}
                >
                  <Icon size={22} className="mb-1" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
