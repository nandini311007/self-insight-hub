import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Feather } from "lucide-react";
import { toast } from "sonner";
import { apiPost, errorMessage } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";

// Exchanges the one-time #session_id from Emergent Auth for our own cookie session.
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const processed = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // useRef, set synchronously: StrictMode double-invokes effects and the session_id is single-use.
    if (processed.current) return;
    processed.current = true;

    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }

    void (async () => {
      try {
        const user = await apiPost<User>("/auth/google/session", { session_id: sessionId });
        window.history.replaceState(null, "", window.location.pathname);
        beginSession();
        toast.success("Signed in with Google", { description: user.email });
        navigate("/", { replace: true });
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [location.hash, navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center" data-testid="auth-callback">
      <Feather className={error ? "size-6 text-muted-foreground" : "size-6 animate-pulse text-primary"} />
      {error ? (
        <>
          <p className="font-serif text-xl">Sign-in didn't complete</p>
          <p className="max-w-sm text-sm text-muted-foreground" data-testid="auth-callback-error">
            {error}
          </p>
          <Button variant="outline" onClick={() => navigate("/login", { replace: true })} data-testid="auth-callback-retry">
            Back to sign in
          </Button>
        </>
      ) : (
        <p className="font-serif text-xl">Opening your sanctuary…</p>
      )}
    </div>
  );
}
