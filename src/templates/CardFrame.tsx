import type { Theme } from "@/templates/themes";

/** 1080×1350 캔버스. 패딩은 레이아웃이 각자 잡는다 (full-bleed는 0이어야 하므로). */
export function CardFrame({
  theme,
  handle,
  children,
}: {
  theme: Theme;
  handle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: theme.bg,
        color: theme.fg,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
      {handle.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 44,
            fontSize: 26,
            color: theme.accent,
            fontFamily: theme.displayFont,
            opacity: 0.85,
            zIndex: 2,
          }}
        >
          {handle}
        </div>
      )}
    </div>
  );
}
