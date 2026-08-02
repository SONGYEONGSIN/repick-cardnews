import { textYSpacers } from "@/templates/layout-utils";

export function TextOnlyCard({
  textY,
  badge,
  accent,
  children,
}: {
  textY: number;
  badge: string;
  accent: string;
  children: React.ReactNode;
}) {
  const spacers = textYSpacers(textY);
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: 72,
        paddingBottom: 96,
      }}
    >
      {badge && (
        <div style={{ position: "absolute", top: 72, right: 72, fontSize: 26, color: accent }}>{badge}</div>
      )}
      <div style={{ flexGrow: spacers.top, flexShrink: 0, flexBasis: 0, minHeight: 0 }} />
      {children}
      <div style={{ flexGrow: spacers.bottom, flexShrink: 0, flexBasis: 0, minHeight: 0 }} />
    </div>
  );
}
