import "server-only";

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/**
 * Limit zapytań na endpointach AI (README §10): najwyżej `limit` zapytań na minutę z jednego IP.
 * Licznik w pamięci procesu — na Vercelu to limit na instancję, co wystarcza na demo.
 * Zwraca gotową odpowiedź 429 albo null, gdy można obsłużyć zapytanie.
 */
export function rateLimit(request: Request, bucket: string, limit: number): Response | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "lokalnie";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    return Response.json(
      { error: `Za dużo zapytań z tego urządzenia (limit odnowi się za ${retryAfter} s)` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  recent.push(now);
  hits.set(key, recent);

  // Sprzątanie, żeby mapa nie rosła bez końca.
  if (hits.size > 5_000) {
    for (const [k, times] of hits) if (now - times[times.length - 1] >= WINDOW_MS) hits.delete(k);
  }
  return null;
}
