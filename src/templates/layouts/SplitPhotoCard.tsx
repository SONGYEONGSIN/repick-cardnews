import { objectPosition, type Focal } from "@/templates/layout-utils";

export function SplitPhotoCard({
  photoUrl,
  focal,
  band,
  badge,
  accent,
  children,
}: {
  photoUrl: string | null;
  focal: Focal;
  band: number;
  badge: string;
  accent: string;
  children: React.ReactNode;
}) {
  const photoHeight = Math.round(1350 * band);
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
          justifyContent: "center",
          padding: 72,
          paddingBottom: 96,
          borderTop: `6px solid ${accent}`,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </>
  );
}
