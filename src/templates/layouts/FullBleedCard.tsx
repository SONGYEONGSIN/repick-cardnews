import type { Theme } from "@/templates/themes";
import { objectPosition, scrimGradient, type Focal } from "@/templates/layout-utils";

export function FullBleedCard({
  theme,
  photoUrl,
  focal,
  scrim,
  badge,
  children,
}: {
  theme: Theme;
  photoUrl: string | null;
  focal: Focal;
  scrim: number;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {photoUrl && (
        // html-to-image가 캡처하려면 dataURL을 문 원시 img여야 한다 (next/image는 dataURL 최적화 불가)
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
      <div style={{ position: "absolute", inset: 0, background: scrimGradient(scrim) }} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 72,
          paddingBottom: 96,
        }}
      >
        {badge && (
          <div style={{ position: "absolute", top: 72, right: 72, fontSize: 26, color: theme.onPhoto, opacity: 0.9 }}>
            {badge}
          </div>
        )}
        {children}
      </div>
    </>
  );
}
