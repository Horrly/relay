import { useCallback, useEffect, useRef, useState } from "react";
import { freshAccessToken } from "./api";

const MAX_BACKOFF_MS = 10_000;

function socketUrl(slug, token) {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws/rooms/${slug}/?token=${encodeURIComponent(token)}`;
}

/**
 * Connects to a room's WebSocket and reconnects with exponential backoff.
 * `onEvent` receives every server event ({type: "message" | "typing" | "presence" | "error", ...}).
 * Returns { status, send } where status is "connecting" | "open" | "reconnecting" | "not_found".
 */
export function useChatSocket(slug, onEvent) {
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let retryTimer;

    async function open() {
      const token = await freshAccessToken();
      if (cancelled || !token) return;

      const ws = new WebSocket(socketUrl(slug, token));
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
      };
      ws.onmessage = (e) => onEventRef.current?.(JSON.parse(e.data));
      ws.onclose = (e) => {
        if (cancelled) return;
        if (e.code === 4404) {
          setStatus("not_found");
          return;
        }
        setStatus("reconnecting");
        const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt++);
        retryTimer = setTimeout(open, delay);
      };
    }

    setStatus("connecting");
    open();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [slug]);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  return { status, send };
}
