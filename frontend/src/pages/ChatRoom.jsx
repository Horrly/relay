import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dayKey, dayLabel, formatTime, startsNewGroup, typingText } from "../lib/format";
import { useChatSocket } from "../lib/useChatSocket";

const TYPING_SEND_INTERVAL_MS = 2000;
const TYPING_IDLE_MS = 3000;
const TYPING_EXPIRE_MS = 4000;
const MAX_LENGTH = 2000;

// Merge messages by id and keep them in chronological order.
function mergeMessages(existing, incoming) {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export default function ChatRoom() {
  const { slug } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [notices, setNotices] = useState([]); // join/leave toasts
  const [typers, setTypers] = useState({}); // username -> last seen timestamp
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");

  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const lastTypingSent = useRef(0);
  const idleTimer = useRef(null);
  const wasOpen = useRef(false);

  // --- load room + latest history --------------------------------------
  const loadLatest = useCallback(async () => {
    const data = await api(`/rooms/${slug}/messages/`);
    setMessages((prev) => mergeMessages(prev, data.results));
    return data;
  }, [slug]);

  useEffect(() => {
    setRoom(null);
    setNotFound(false);
    setMessages([]);
    setNotices([]);
    setTypers({});
    stickToBottom.current = true;
    wasOpen.current = false;

    api(`/rooms/${slug}/`)
      .then(setRoom)
      .catch((err) => err.status === 404 && setNotFound(true));
    loadLatest()
      .then((data) => setHasMore(data.has_more))
      .catch(() => {});
  }, [slug, loadLatest]);

  // --- live events -------------------------------------------------------
  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case "message":
        setMessages((prev) => mergeMessages(prev, [event.message]));
        setTypers((prev) => {
          const next = { ...prev };
          delete next[event.message.author];
          return next;
        });
        break;
      case "typing":
        setTypers((prev) => {
          const next = { ...prev };
          if (event.is_typing) next[event.user] = Date.now();
          else delete next[event.user];
          return next;
        });
        break;
      case "presence": {
        const id = `${event.user}-${Date.now()}`;
        setNotices((prev) => [...prev.slice(-2), { id, text: `${event.user} ${event.action} the room` }]);
        setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 4000);
        break;
      }
      case "error":
        setSendError(event.detail);
        break;
      default:
        break;
    }
  }, []);

  const { status, send } = useChatSocket(slug, handleEvent);

  // After a reconnect, fetch anything we missed while offline.
  useEffect(() => {
    if (status !== "open") return;
    if (wasOpen.current) loadLatest().catch(() => {});
    wasOpen.current = true;
  }, [status, loadLatest]);

  // Expire stale typing indicators (e.g. if someone closed their tab mid-sentence).
  useEffect(() => {
    const timer = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const fresh = Object.fromEntries(Object.entries(prev).filter(([, t]) => now - t < TYPING_EXPIRE_MS));
        return Object.keys(fresh).length === Object.keys(prev).length ? prev : fresh;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- scrolling ---------------------------------------------------------
  function handleScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!messages.length) return;
    const el = scrollRef.current;
    const prevHeight = el.scrollHeight;
    setLoadingOlder(true);
    try {
      const data = await api(`/rooms/${slug}/messages/?before=${messages[0].id}`);
      stickToBottom.current = false;
      setMessages((prev) => mergeMessages(prev, data.results));
      setHasMore(data.has_more);
      // Keep the viewport anchored on the message the user was looking at.
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  // --- composing ---------------------------------------------------------
  function handleDraftChange(e) {
    setDraft(e.target.value);
    setSendError("");
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_SEND_INTERVAL_MS) {
      send({ type: "typing", is_typing: true });
      lastTypingSent.current = now;
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      send({ type: "typing", is_typing: false });
      lastTypingSent.current = 0;
    }, TYPING_IDLE_MS);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    if (!send({ type: "message", content })) {
      setSendError("You're offline — reconnecting…");
      return;
    }
    clearTimeout(idleTimer.current);
    lastTypingSent.current = 0;
    stickToBottom.current = true;
    setDraft("");
  }

  function handleKeyDown(e) {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
  }

  if (notFound || status === "not_found") {
    return <EmptyState title="Room not found" body="It may have been renamed. Pick another room on the left." />;
  }

  const typingUsers = Object.keys(typers).filter((name) => name !== user.username);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <Link to="/" className="text-slate-400 hover:text-slate-600 md:hidden" aria-label="Back to rooms">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            <span className="text-slate-400"># </span>
            {room?.name ?? slug}
          </h2>
          {room?.description && <p className="truncate text-xs text-slate-500">{room.description}</p>}
        </div>
        <ConnectionBadge status={status} />
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {hasMore && (
          <div className="mb-4 text-center">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && !hasMore && (
          <p className="mt-10 text-center text-sm text-slate-400">No messages yet — say hello 👋</p>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const newGroup = newDay || startsNewGroup(prev, m);
          const mine = m.author === user.username;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  {dayLabel(m.created_at)}
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}
              <div className={`flex gap-3 ${newGroup ? "mt-3" : "mt-0.5"}`}>
                {newGroup ? <Avatar name={m.author} /> : <div className="w-9 shrink-0" />}
                <div className="min-w-0">
                  {newGroup && (
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-semibold ${mine ? "text-brand-600" : ""}`}>{m.author}</span>
                      <span className="text-xs text-slate-400">{formatTime(m.created_at)}</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</p>
                </div>
              </div>
            </div>
          );
        })}

        <div className="pointer-events-none sticky bottom-0 flex flex-col items-center gap-1">
          {notices.map((n) => (
            <span key={n.id} className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-white">
              {n.text}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:px-6">
        <p className="h-5 text-xs italic text-slate-400">{typingText(typingUsers)}</p>
        {sendError && <p className="mb-2 text-xs text-rose-600">{sendError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={`Message #${room?.name ?? slug}`}
            className="max-h-40 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={!draft.trim() || status !== "open"}
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </>
  );
}

function ConnectionBadge({ status }) {
  const styles = {
    open: ["bg-emerald-500", "Live"],
    connecting: ["bg-amber-400", "Connecting"],
    reconnecting: ["bg-amber-400", "Reconnecting"],
  };
  const [dot, label] = styles[status] ?? ["bg-slate-300", status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${dot} ${status !== "open" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
