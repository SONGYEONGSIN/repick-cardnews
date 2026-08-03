export function ContiMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="23" height="23" rx="3" stroke="currentColor" strokeWidth="2.2" opacity=".45" />
      <rect x="8" y="8" width="16" height="9.5" rx="1.5" fill="currentColor" />
      <rect x="8" y="20.3" width="16" height="2.4" rx="1.2" fill="currentColor" opacity=".55" />
    </svg>
  );
}
