"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/key";
import { channelName, NEW_MESSAGE_EVENT } from "@/lib/thread-types";

const FALLBACK_POLL_MS = 30_000;

/**
 * Na żywo: Supabase Realtime Broadcast na kanale wątku (serwer wysyła sam sygnał po zapisie).
 * Zapasowo co 30 s, gdy karta jest widoczna — na wypadek zablokowanego WebSocketu.
 */
export function useLiveThread(threadId: string | null, onNew: () => void) {
  const callback = useRef(onNew);
  useEffect(() => { callback.current = onNew; }, [onNew]);

  useEffect(() => {
    if (!threadId) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") callback.current();
    }, FALLBACK_POLL_MS);

    if (!SUPABASE_URL || !SUPABASE_KEY) return () => clearInterval(timer);
    const supabase = createClient();
    const channel = supabase
      .channel(channelName(threadId))
      .on("broadcast", { event: NEW_MESSAGE_EVENT }, () => callback.current())
      .subscribe();
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [threadId]);
}
