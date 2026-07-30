export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hair bg-surface shadow-sm ${className}`}>{children}</div>
  );
}
