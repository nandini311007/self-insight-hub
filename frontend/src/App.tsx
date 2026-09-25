import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import RequireAuth from "@/components/RequireAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Journal from "@/pages/Journal";
import Mood from "@/pages/Mood";
import Values from "@/pages/Values";
import Decisions from "@/pages/Decisions";
import Community from "@/pages/Community";
import CheckIn from "@/pages/CheckIn";
import Timeline from "@/pages/Timeline";
import Settings from "@/pages/Settings";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  const location = useLocation();

  // Emergent Auth lands on {origin}/#session_id=... — handle it during render, before
  // RequireAuth can run its /auth/me check and bounce to /login.
  if (location.hash.includes("session_id=")) {
    return (
      <>
        <AuthCallback />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/mood" element={<Mood />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/values" element={<Values />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/community" element={<Community />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
