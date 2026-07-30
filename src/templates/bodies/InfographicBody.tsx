import type { InfographicSpec } from "@/lib/schema";
import type { Theme } from "@/templates/themes";

export function InfographicBody({
  spec,
  theme: t,
  onPhoto = false,
}: {
  spec: InfographicSpec;
  theme: Theme;
  onPhoto?: boolean;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  return (
    <>
      <h1 style={{ fontFamily: t.displayFont, fontSize: 66, lineHeight: 1.2, margin: 0, color: fg }}>
        {spec.title}
      </h1>
      {spec.subtitle && (
        <p style={{ fontSize: 32, marginTop: 16, marginBottom: 8, opacity: 0.85, color: fg }}>{spec.subtitle}</p>
      )}
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
        {spec.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: 52,
                height: 52,
                borderRadius: 999,
                background: t.accent,
                color: t.bg,
                fontFamily: t.displayFont,
                fontSize: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  background: t.highlight,
                  padding: "2px 8px",
                  borderRadius: 6,
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }}
              >
                {it.keyword}
              </span>
              <p style={{ fontSize: 27, lineHeight: 1.45, marginTop: 10, marginBottom: 0, opacity: 0.9, color: fg }}>
                {it.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      {spec.tip && (
        <div style={{ marginTop: 20, padding: 22, borderRadius: 18, border: `2px solid ${t.accent}` }}>
          {/* ✅ 는 brand-voice.md 가 TIP 앞자리에 명시 승인한 이모지다. 하네스의 이모지 금지는
              UI 크롬에 대한 것이고 카드는 산출물이므로 여기서는 유지한다. */}
          {/* 사진 위에서는 accent가 스크림에 묻히므로 onPhoto 색으로 바꾼다. 사진이 없으면 accent 유지 */}
          <span style={{ fontFamily: t.displayFont, fontSize: 30, color: onPhoto ? t.onPhoto : t.accent }}>
            ✅ TIP{" "}
          </span>
          <span style={{ fontSize: 27, color: fg }}>{spec.tip}</span>
        </div>
      )}
    </>
  );
}
