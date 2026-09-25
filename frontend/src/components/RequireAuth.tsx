import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "@/lib/useMe";
import { Feather } from "lucide-react";

// Session gate: the /api/auth/me cookie check decides between the app and the login page.
export default function RequireAuth() {
  const { data, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Feather className="size-5 animate-pulse" />
          <span className="font-serif text-xl">Self Insight Hub</span>
        </div>
      </div>
    );
  }
  if (!data?.user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
