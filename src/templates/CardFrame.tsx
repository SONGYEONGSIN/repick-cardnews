import type { Theme } from "@/templates/themes";

export function CardFrame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: theme.bg,
        color: theme.fg,
        position: "relative",
        overflow: "hidden",
        padding: 72,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 44,
          fontSize: 26,
          color: theme.accent,
          fontFamily: theme.displayFont,
          opacity: 0.85,
        }}
      >
        {theme.watermark}
      </div>
    </div>
  );
}
