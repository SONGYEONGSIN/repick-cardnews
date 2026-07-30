export function TextOnlyCard({
  badge,
  accent,
  children,
}: {
  badge: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 72,
        paddingBottom: 96,
      }}
    >
      {badge && (
        <div style={{ position: "absolute", top: 72, right: 72, fontSize: 26, color: accent }}>{badge}</div>
      )}
      {children}
    </div>
  );
}
