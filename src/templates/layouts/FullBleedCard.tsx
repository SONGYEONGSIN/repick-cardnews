import type { Theme } from "@/templates/themes";
import { objectPosition, scrimGradient, textYSpacers, type Focal } from "@/templates/layout-utils";

export function FullBleedCard({
  theme,
  photoUrl,
  focal,
  scrim,
  textY,
  badge,
  children,
}: {
  theme: Theme;
  photoUrl: string | null;
  focal: Focal;
  scrim: number;
  textY: number;
  badge: string;
  children: React.ReactNode;
}) {
  const spacers = textYSpacers(textY);
  return (
    <>
      {photoUrl && (
        // html-to-image가 캡처하려면 dataURL을 품은 원시 img여야 한다 (next/image는 dataURL 최적화 불가)
        <img
          src={photoUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: 1080,
            height: 1350,
            objectFit: "cover",
            objectPosition: objectPosition(focal),
          }}
        />
      )}
      {photoUrl && <div style={{ position: "absolute", inset: 0, background: scrimGradient(scrim, textY) }} />}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 72,
          paddingBottom: 96,
        }}
      >
        {badge && (
          <div
            style={{
              position: "absolute",
              top: 72,
              right: 72,
              fontSize: 26,
              color: photoUrl ? theme.onPhoto : theme.fg,
              background: photoUrl ? "rgba(0,0,0,0.45)" : "transparent",
              padding: photoUrl ? "6px 18px" : 0,
              borderRadius: 999,
            }}
          >
            {badge}
          </div>
        )}
        <div style={{ flexGrow: spacers.top, flexShrink: 0, flexBasis: 0, minHeight: 0 }} />
        {children}
        <div style={{ flexGrow: spacers.bottom, flexShrink: 0, flexBasis: 0, minHeight: 0 }} />
      </div>
    </>
  );
}
