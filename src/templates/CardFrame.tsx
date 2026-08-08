import { AD_BADGE_FONT_SIZE, AD_BADGE_TEXT, adBadgeColor } from "@/templates/ad-badge";
import type { Theme } from "@/templates/themes";

/** 1080×1350 캔버스. 패딩은 레이아웃이 각자 잡는다 (full-bleed는 0이어야 하므로). */
export function CardFrame({
  theme,
  handle,
  ad,
  onPhoto,
  children,
}: {
  theme: Theme;
  handle: string;
  /** 협찬·광고 표기를 우측 상단에 넣는다. 세트 전체에 같이 적용된다. */
  ad: boolean;
  /** 사진 위에 얹히는 카드인가 — 표기 색이 갈린다. */
  onPhoto: boolean;
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
      {ad && (
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 44,
            fontSize: AD_BADGE_FONT_SIZE,
            color: adBadgeColor(theme, onPhoto),
            fontFamily: theme.displayFont,
            opacity: 0.9,
            zIndex: 2,
          }}
        >
          {AD_BADGE_TEXT}
        </div>
      )}
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
