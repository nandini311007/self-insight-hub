import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Feather, Flame, LogOut, Menu, Settings as SettingsIcon, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { loadAmbientPreference, toggleAmbient } from "@/lib/ambient";
import { endSession } from "@/lib/session";
import { useMe } from "@/lib/useMe";
import type { StreakOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Today", end: true },
  { to: "/journal", label: "Journal", end: false },
  { to: "/mood", label: "Mood", end: false },
  { to: "/checkin", label: "Check-in", end: false },
  { to: "/timeline", label: "Timeline", end: false },
  { to: "/values", label: "Values", end: false },
  { to: "/decisions", label: "Decisions", end: false },
  { to: "/community", label: "Community", end: false },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
    isActive ? "bg-secondary text-accent-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const { data } = useMe();
  const user = data?.user;
  const streak = useQuery({
    queryKey: ["streak"],
    queryFn: () => apiGet<StreakOut>("/dashboard/streak"),
    retry: false,
  });

  // Reflect the saved preference; audio itself only starts from the click below.
  useEffect(() => {
    setSoundOn(loadAmbientPreference());
  }, []);

  const onToggleSound = () => {
    void (async () => {
      const on = await toggleAmbient();
      setSoundOn(on);
      toast.success(on ? "Ambience on — breathe out" : "Ambience off");
    })();
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="glass-header sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2" data-testid="nav-logo-link">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Feather className="size-4" />
            </span>
            <span className="hidden font-serif text-lg font-medium tracking-tight sm:inline">Self Insight Hub</span>
          </NavLink>

          <nav className="hidden items-center gap-0.5 lg:flex" data-testid="main-nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navClass}
                data-testid={`nav-${item.label.toLowerCase().replace("-", "")}-link`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSound}
              aria-label={soundOn ? "Turn ambient sound off" : "Turn ambient sound on"}
              title={soundOn ? "Ambience on" : "Ambient sound"}
              data-testid="ambient-sound-toggle"
              className={cn(soundOn && "text-primary")}
            >
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>

            {streak.data && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                data-testid="streak-pill"
                title="Current reflection streak"
              >
                <Flame className="size-4" />
                {streak.data.streak}
                <span className="hidden sm:inline">day{streak.data.streak === 1 ? "" : "s"}</span>
              </div>
            )}

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                data-testid="user-menu-button"
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Account menu">
                    {user?.picture ? (
                      <img src={user.picture} alt="" className="size-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {(user?.name ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                {/* base-ui's GroupLabel throws unless it sits inside a Menu.Group */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium" data-testid="user-menu-name">{user?.name}</div>
                    <div className="text-xs font-normal text-muted-foreground" data-testid="user-menu-email">{user?.email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="settings-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                >
                  <SettingsIcon className="size-4" /> Account settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="signout-item"
                  onClick={() => {
                    setMenuOpen(false);
                    void endSession();
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger
                data-testid="mobile-nav-button"
                render={
                  <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
                    <Menu className="size-5" />
                  </Button>
                }
              />
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle className="font-serif">Self Insight Hub</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-2" data-testid="mobile-nav">
                  {NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setNavOpen(false)}
                      className={({ isActive }) =>
                        cn("rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-secondary text-accent-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                      }
                      data-testid={`mobile-nav-${item.label.toLowerCase().replace("-", "")}-link`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  <NavLink
                    to="/settings"
                    onClick={() => setNavOpen(false)}
                    className={({ isActive }) =>
                      cn("rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-secondary text-accent-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                    }
                    data-testid="mobile-nav-settings-link"
                  >
                    Settings
                  </NavLink>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center sm:px-6">
          <p className="font-serif text-sm italic text-muted-foreground">
            “Knowing yourself is the beginning of all wisdom.” — Aristotle
          </p>
          <p className="text-xs text-muted-foreground/70">
            Your journal is private. Community posts use pen names only. If you are in crisis, please reach out to local support services.
          </p>
        </div>
      </footer>
    </div>
  );
}
