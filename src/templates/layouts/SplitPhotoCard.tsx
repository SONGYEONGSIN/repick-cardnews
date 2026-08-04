import { objectPosition, type Focal, type TextYSpacers } from "@/templates/layout-utils";

export function SplitPhotoCard({
  photoUrl,
  focal,
  band,
  spacers,
  badge,
  accent,
  titleBand,
  children,
}: {
  photoUrl: string | null;
  focal: Focal;
  band: number;
  spacers: TextYSpacers;
  badge: string;
  accent: string;
  /**
   * 사진이 없을 때 그 자리를 대신하는 **제목 띠**. 색·글꼴은 테마에서 온 값을 그대로 받는다 —
   * 이 파일은 테마를 모른다(`CardRenderer` 가 채운다).
   *
   * 높이는 `band` 가 아니라 **제목 길이에 맞춘다** — 사진이 없는데 화면의 40%를 빈 색으로
   * 두면 낭비다.
   */
  titleBand?: { text: string; bg: string; fg: string; font: string };
  children: React.ReactNode;
}) {
  const photoHeight = Math.round(1350 * band);
  return (
    <>
      {titleBand ? (
        <div
          style={{
            flex: "0 0 auto",
            background: titleBand.bg,
            padding: "72px 72px 64px",
          }}
        >
          <h1
            style={{
              fontFamily: titleBand.font,
              fontSize: 72,
              lineHeight: 1.2,
              margin: 0,
              color: titleBand.fg,
            }}
          >
            {titleBand.text}
          </h1>
        </div>
      ) : (
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
      )}
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
