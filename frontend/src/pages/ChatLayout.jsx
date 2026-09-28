import { useEffect, useState } from "react";
import { NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ChatLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const inRoom = Boolean(useMatch("/rooms/:slug"));

  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/rooms/").then(setRooms).catch((err) => setError(err.message));
  }, []);

  async function createRoom(e) {
    e.preventDefault();
    setError("");
    try {
      const room = await api("/rooms/", { method: "POST", body: { name } });
      setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setCreating(false);
      navigate(`/rooms/${room.slug}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar: full width on mobile when no room is open, fixed column on desktop */}
      <aside
        className={`${inRoom ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-200 bg-white md:w-72`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h1 className="text-xl font-bold">
            Relay <span className="text-brand-500">·</span>
          </h1>
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-lg px-2.5 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50"
          >
            {creating ? "Cancel" : "+ New room"}
          </button>
        </div>

        {creating && (
          <form onSubmit={createRoom} className="px-5 pb-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name"
              maxLength={80}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </form>
        )}
        {error && <p className="mx-5 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {rooms.length === 0 && <p className="px-2 py-4 text-sm text-slate-400">No rooms yet. Create the first one.</p>}
          {rooms.map((room) => (
            <NavLink
              key={room.slug}
              to={`/rooms/${room.slug}`}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <span className="text-slate-400"># </span>
              {room.name}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-3">
          <Avatar name={user.username} size="h-8 w-8" />
          <span className="flex-1 truncate text-sm font-medium">{user.username}</span>
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-600">
            Log out
          </button>
        </div>
      </aside>

      <main className={`${inRoom ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        <Outlet context={{ rooms }} />
      </main>
    </div>
  );
}
