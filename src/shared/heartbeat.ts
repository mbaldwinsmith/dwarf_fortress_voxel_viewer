export function isHeartbeat(
  value: unknown,
  type: "ping" | "pong",
): value is { type: "ping" | "pong"; nonce: number } {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    m.type === type && Number.isSafeInteger(m.nonce) && Number(m.nonce) >= 0
  );
}
