import type { InfographicSpec } from "@/lib/schema";
import type { Theme } from "@/templates/themes";
import { DEFAULT_FIT, sizeWith, type Fit } from "@/templates/fit";

export function InfographicBody({
  spec,
  theme: t,
  onPhoto = false,
  compact = false,
  hideTitle = false,
  fit = DEFAULT_FIT,
}: {
  spec: InfographicSpec;
  theme: Theme;
  onPhoto?: boolean;
  /** 항목 5개 이상일 때 CardRenderer가 켠다 — 타이포를 줄여 CardFrame의 하드 클리핑을 막는다 */
  compact?: boolean;
  /**
   * 제목이 위쪽 **띠**로 갔으면 여기서는 그리지 않는다(`titleInBand`). 각자 판단하면 제목이
   * 두 번 나오거나 하나도 안 나온다 — 그래서 `CardRenderer` 가 한 함수로 정해 내려 준다.
   */
  hideTitle?: boolean;
  /**
   * 글자 크기·간격 **배수**. 자동 규칙(`compact`)이 정한 기준값 위에 곱한다 — 1 이면
   * 지금까지와 똑같다(`@/templates/fit`).
   */
  fit?: Fit;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  const px = (base: number) => sizeWith(base, fit.text);
  const gap = (base: number) => sizeWith(base, fit.gap);
  return (
    <>
      {!hideTitle && (
      <h1
        style={{
          fontFamily: t.displayFont,
          fontSize: px(compact ? 52 : 66),
          lineHeight: 1.2,
          margin: 0,
          color: fg,
        }}
      >
        {spec.title}
      </h1>
      )}
      {spec.subtitle && (
        <p
          style={{ fontSize: px(compact ? 27 : 32), marginTop: 16, marginBottom: 8, opacity: 0.85, color: fg, whiteSpace: "pre-line" }}
        >
          {spec.subtitle}
        </p>
      )}
      <div
        style={{
          marginTop: gap(compact ? 20 : 28),
          display: "flex",
          flexDirection: "column",
          gap: gap(compact ? 16 : 22),
          flex: 1,
        }}
      >
        {spec.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: compact ? 16 : 20, alignItems: "flex-start" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: compact ? 44 : 52,
                height: compact ? 44 : 52,
                borderRadius: 999,
                background: t.accent,
                color: t.bg,
                fontFamily: t.displayFont,
                fontSize: px(compact ? 26 : 30),
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
                  fontSize: px(compact ? 28 : 34),
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
              <p
                style={{
                  fontSize: px(compact ? 23 : 27),
                  whiteSpace: "pre-line",
                  lineHeight: 1.45,
                  marginTop: 10,
                  marginBottom: 0,
                  opacity: 0.9,
                  color: fg,
                }}
              >
                {it.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      {spec.tip && (
        <div
          style={{
            marginTop: 20,
            padding: compact ? 16 : 22,
            borderRadius: 18,
            border: `2px solid ${t.accent}`,
          }}
        >
          {/* ✅ 는 brand-voice.md 가 TIP 앞자리에 명시 승인한 이모지다. 하네스의 이모지 금지는
              UI 크롬에 대한 것이고 카드는 산출물이므로 여기서는 유지한다. */}
          {/* 사진 위에서는 accent가 스크림에 묻히므로 onPhoto 색으로 바꾼다. 사진이 없으면 accent 유지 */}
          <span
            style={{ fontFamily: t.displayFont, fontSize: px(compact ? 26 : 30), color: onPhoto ? t.onPhoto : t.accent }}
          >
            ✅ TIP{" "}
          </span>
          <span style={{ fontSize: px(compact ? 23 : 27), color: fg, whiteSpace: "pre-line" }}>{spec.tip}</span>
        </div>
      )}
    </>
  );
}
