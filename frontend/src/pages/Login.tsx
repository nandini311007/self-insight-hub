import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Feather, ShieldCheck, Sparkles } from "lucide-react";
import { apiPost, errorMessage } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { useMe } from "@/lib/useMe";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BANNER_IMAGE =
  "https://images.unsplash.com/photo-1761322572550-967ea8c0bfd9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwyfHxqb3VybmFsJTIwd3JpdGluZyUyMGRlc2slMjBtb3JuaW5nJTIwc3VubGlnaHR8ZW58MHx8fHwxNzkwMzU4ODUwfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const navigate = useNavigate();
  const { data: meData } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const finish = (user: User, message: string) => {
    beginSession();
    toast.success(message, { description: `Signed in as ${user.email}` });
    navigate("/", { replace: true });
  };

  const login = useMutation({
    mutationFn: (creds: { email: string; password: string }) => apiPost<User>("/auth/login", creds),
    onSuccess: (user) => finish(user, "Welcome back to your sanctuary"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const signup = useMutation({
    mutationFn: (payload: { email: string; password: string; name: string }) =>
      apiPost<User>("/auth/signup", payload),
    onSuccess: (user) => finish(user, "Your sanctuary is ready"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const demo = useMutation({
    mutationFn: () => apiPost<User>("/auth/login", { email: "demo@insighthub.app", password: "demo1234" }),
    onSuccess: (user) => finish(user, "Welcome to the demo sanctuary"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pending = login.isPending || signup.isPending || demo.isPending;
  if (meData?.user) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-svh lg:grid-cols-2" data-testid="login-page">
      {/* Left editorial banner */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={BANNER_IMAGE} alt="Warm morning journal desk in soft window light" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,24,20,0.55)_0%,rgba(28,24,20,0.92)_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-[#FAF7F2]">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#A65B32]">
              <Feather className="size-4" />
            </span>
            <span className="font-serif text-xl">Self Insight Hub</span>
          </div>
          <div className="space-y-6">
            <p className="max-w-md font-serif text-3xl leading-snug">
              “Knowing yourself is the beginning of all wisdom.”
            </p>
            <div className="flex flex-wrap gap-2">
              {["Daily reflection prompts", "Values compass", "AI reflection assistant"].map((pillar) => (
                <span key={pillar} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                  {pillar}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Feather className="size-4" />
              </span>
              <span className="font-serif text-lg">Self Insight Hub</span>
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight" data-testid="auth-heading">
              Enter your private sanctuary
            </h1>
            <p className="text-sm text-muted-foreground">
              A quiet place to reflect, notice patterns, and grow — one day at a time.
            </p>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="w-full" data-testid="auth-tabs">
              <TabsTrigger value="login" className="flex-1" data-testid="auth-tab-login">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1" data-testid="auth-tab-signup">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  autoComplete="current-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => login.mutate({ email, password })}
                disabled={pending || !email.trim() || !password}
                data-testid="login-submit-button"
              >
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Name</Label>
                <Input
                  id="signup-name"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="signup-name-input"
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="signup-email-input"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="signup-password-input"
                  autoComplete="new-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => signup.mutate({ email, password, name })}
                disabled={pending || !email.trim() || password.length < 6}
                data-testid="signup-submit-button"
              >
                {signup.isPending ? "Creating…" : "Create account"}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => demo.mutate()} disabled={pending} data-testid="demo-login-button">
              <Sparkles className="size-4" /> {demo.isPending ? "Opening…" : "Explore with the demo account"}
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              Your journal is private and only yours. Community posts use pen names — never your email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
