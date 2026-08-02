import { objectPosition, textYSpacers, type Focal } from "@/templates/layout-utils";

export function SplitPhotoCard({
  photoUrl,
  focal,
  band,
  textY,
  badge,
  accent,
  children,
}: {
  photoUrl: string | null;
  focal: Focal;
  band: number;
  textY: number;
  badge: string;
  accent: string;
  children: React.ReactNode;
}) {
  const photoHeight = Math.round(1350 * band);
  const spacers = textYSpacers(textY);
  return (
    <>
      <div style={{ position: "relative", height: photoHeight, flex: "0 0 auto", overflow: "hidden" }}>
        {photoUrl && (
          // html-to-image 캡처를 위해 원시 img를 쓴다 (next/image는 dataURL 최적화 불가)
          <img
            src={photoUrl}
            alt=""
            style={{
              width: 1080,
              height: photoHeight,
              objectFit: "cover",
              objectPosition: objectPosition(focal),
              display: "block",
            }}
          />
        )}
        {badge && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 44,
              fontSize: 26,
              color: "#ffffff",
              background: "rgba(0,0,0,0.45)",
              padding: "6px 18px",
              borderRadius: 999,
            }}
          >
            {badge}
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 72,
          paddingBottom: 96,
          borderTop: `6px solid ${accent}`,
          minHeight: 0,
        }}
      >
        <div style={{ flexGrow: spacers.top, flexShrink: 0, flexBasis: 0, minHeight: 0 }} />
        {children}
        <div style={{ flexGrow: spacers.bottom, flexShrink: 0, flexBasis: 0, minHeight: 0 }} />
      </div>
    </>
  );
}
