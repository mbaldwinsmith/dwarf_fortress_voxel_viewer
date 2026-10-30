export function levelDirection(e: {
  key?: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}) {
  if (e.ctrlKey || e.altKey || e.metaKey) return 0;
  if (e.key === "<" || (e.shiftKey && e.code === "Comma")) return 1;
  if (e.key === ">" || (e.shiftKey && e.code === "Period")) return -1;
  return 0;
}
