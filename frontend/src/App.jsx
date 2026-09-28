import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import AuthPage from "./pages/AuthPage";
import ChatLayout from "./pages/ChatLayout";
import ChatRoom from "./pages/ChatRoom";
import EmptyState from "./components/EmptyState";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-full place-items-center text-slate-400">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ChatLayout />
          </RequireAuth>
        }
      >
        <Route index element={<EmptyState title="Pick a room" body="Choose a room on the left, or create a new one." />} />
        <Route path="rooms/:slug" element={<ChatRoom />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
