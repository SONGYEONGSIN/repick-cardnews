export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}
