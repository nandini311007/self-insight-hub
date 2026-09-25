import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, KeyRound, Mail, Send, User as UserIcon, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, errorMessage } from "@/lib/api";
import { loadAmbientPreference, toggleAmbient } from "@/lib/ambient";
import { useMe } from "@/lib/useMe";
import { REMINDER_HOURS, type User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const browserTz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useMe();
  const user = data?.user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [remOn, setRemOn] = useState(false);
  const [remHour, setRemHour] = useState("20");
  const [soundOn, setSoundOn] = useState(false);

  // Seed the forms once the profile arrives.
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setRemOn(user.reminder_enabled);
    setRemHour(String(user.reminder_hour));
  }, [user]);

  useEffect(() => {
    setSoundOn(loadAmbientPreference());
  }, []);

  const onSaved = (message: string) => {
    toast.success(message);
    void qc.invalidateQueries({ queryKey: ["me"] });
  };

  const saveName = useMutation({
    mutationFn: () => apiPatch<User>("/auth/profile", { name: name.trim() }),
    onSuccess: () => onSaved("Name updated"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const saveEmail = useMutation({
    mutationFn: () => apiPatch<User>("/auth/email", { email: email.trim(), current_password: emailPassword }),
    onSuccess: () => {
      setEmailPassword("");
      onSaved("Email updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const savePassword = useMutation({
    mutationFn: () =>
      apiPatch<User>("/auth/password", { current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      onSaved(user?.has_password ? "Password changed" : "Password set — you can now sign in with email too");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const saveReminders = useMutation({
    mutationFn: () =>
      apiPatch<User>("/auth/reminders", {
        reminder_enabled: remOn,
        reminder_hour: Number(remHour),
        reminder_tz: browserTz(),
      }),
    onSuccess: () => onSaved(remOn ? "Reminders on — see you at that hour" : "Reminders switched off"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const testEmail = useMutation({
    mutationFn: () => apiPost<{ ok: boolean; sent_to: string }>("/auth/reminders/test"),
    onSuccess: (r) => toast.success("Test reminder sent", { description: `Check ${r.sent_to}` }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="settings-heading">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account, your reminders, your atmosphere.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Name */}
        <Card data-testid="profile-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <UserIcon className="size-5 text-primary" /> Your name
            </CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading your profile…"
                : user?.auth_provider === "google"
                  ? "Signed in with Google"
                  : "Signed in with email"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Display name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                data-testid="settings-name-input"
              />
            </div>
            <Button
              onClick={() => saveName.mutate()}
              disabled={!name.trim() || name.trim() === user?.name || saveName.isPending}
              data-testid="save-name-button"
            >
              {saveName.isPending ? "Saving…" : "Save name"}
            </Button>
          </CardContent>
        </Card>

        {/* Email */}
        <Card data-testid="email-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Mail className="size-5 text-primary" /> Email address
            </CardTitle>
            <CardDescription>Reminders and sign-in both use this address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="settings-email-input"
              />
            </div>
            {user?.has_password && (
              <div className="space-y-2">
                <Label htmlFor="settings-email-password">Confirm with your current password</Label>
                <Input
                  id="settings-email-password"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="settings-email-password-input"
                />
              </div>
            )}
            <Button
              onClick={() => saveEmail.mutate()}
              disabled={
                !email.trim() ||
                email.trim() === user?.email ||
                (user?.has_password === true && !emailPassword) ||
                saveEmail.isPending
              }
              data-testid="save-email-button"
            >
              {saveEmail.isPending ? "Saving…" : "Update email"}
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card data-testid="password-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <KeyRound className="size-5 text-primary" /> {user?.has_password ? "Change password" : "Set a password"}
            </CardTitle>
            <CardDescription>
              {user?.has_password
                ? "Use at least 6 characters."
                : "Your account uses Google sign-in. Set a password to also sign in with email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user?.has_password && (
              <div className="space-y-2">
                <Label htmlFor="settings-current-password">Current password</Label>
                <Input
                  id="settings-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="settings-current-password-input"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="settings-new-password">New password</Label>
              <Input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                data-testid="settings-new-password-input"
              />
            </div>
            <Button
              onClick={() => savePassword.mutate()}
              disabled={
                newPassword.length < 6 || (user?.has_password === true && !currentPassword) || savePassword.isPending
              }
              data-testid="save-password-button"
            >
              {savePassword.isPending ? "Saving…" : user?.has_password ? "Change password" : "Set password"}
            </Button>
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card data-testid="reminders-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <BellRing className="size-5 text-primary" /> Reflection reminders
            </CardTitle>
            <CardDescription>A gentle daily email so your streak survives busy weeks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={remOn}
                onCheckedChange={(checked) => setRemOn(checked === true)}
                data-testid="reminder-toggle"
                aria-label="Enable daily reminders"
              />
              <span className="text-sm">
                Email me a daily nudge with today's reflection question
                <span className="block text-xs text-muted-foreground">Sent to {user?.email ?? "your address"}</span>
              </span>
            </label>

            <div className="space-y-2">
              <Label>Reminder time ({browserTz()})</Label>
              <Select value={remHour} onValueChange={(value) => setRemHour(value)}>
                <SelectTrigger className="w-full sm:w-48" data-testid="reminder-hour-select">
                  <SelectValue>{REMINDER_HOURS.find((h) => h.value === remHour)?.label ?? "8:00 pm"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveReminders.mutate()} disabled={saveReminders.isPending} data-testid="save-reminders-button">
                {saveReminders.isPending ? "Saving…" : "Save reminder settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => testEmail.mutate()}
                disabled={testEmail.isPending}
                data-testid="send-test-reminder-button"
              >
                <Send className="size-4" /> {testEmail.isPending ? "Sending…" : "Send me a test"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ambient sound */}
        <Card className="lg:col-span-2" data-testid="sound-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Volume2 className="size-5 text-primary" /> Meditative ambience
            </CardTitle>
            <CardDescription>
              An optional low drone and airy wash to write to — generated live, nothing to download. It keeps playing
              as you move between pages, and stays off until you ask for it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant={soundOn ? "default" : "outline"}
              onClick={() => {
                void (async () => {
                  const on = await toggleAmbient();
                  setSoundOn(on);
                  toast.success(on ? "Ambience on — breathe out" : "Ambience off");
                })();
              }}
              data-testid="settings-sound-toggle"
            >
              <Volume2 className="size-4" /> {soundOn ? "Turn ambience off" : "Turn ambience on"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
