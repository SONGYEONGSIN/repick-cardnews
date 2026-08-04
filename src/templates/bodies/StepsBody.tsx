import type { InfographicSpec } from "@/lib/schema";
import { DEFAULT_FIT, sizeWith, type Fit } from "@/templates/fit";
import type { Theme } from "@/templates/themes";
import { InfoFrame } from "./InfoFrame";

/**
 * 순서 형식 — **앞을 해야 다음이 된다.**
 *
 * 목록형과 항목 모양은 같지만(`{keyword, desc}`) 뜻이 다르다: 목록은 순서를 바꿔도 되고
 * 순서형은 안 된다. 그 차이를 **번호를 잇는 선**으로 보인다 — 번호만 붙이면 목록과 구분이
 * 안 된다.
 */
export function StepsBody({
  spec,
  theme: t,
  onPhoto = false,
  compact = false,
  hideTitle = false,
  fit = DEFAULT_FIT,
}: {
  spec: Extract<InfographicSpec, { format: "steps" }>;
  theme: Theme;
  onPhoto?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  fit?: Fit;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  const px = (base: number) => sizeWith(base, fit.text);
  const gap = (base: number) => sizeWith(base, fit.gap);
  const dot = compact ? 44 : 52;

  return (
    <InfoFrame
      title={spec.title}
      subtitle={spec.subtitle}
      tip={spec.tip}
      theme={t}
      onPhoto={onPhoto}
      compact={compact}
      fit={fit}
      hideTitle={hideTitle}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: gap(compact ? 16 : 22) }}>
        {spec.items.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: gap(compact ? 16 : 20), alignItems: "flex-start" }}>
            {/* 번호와 그 아래로 잇는 선. 마지막 단계에는 선을 그리지 않는다 — 다음이 없다. */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
              <div
                style={{
                  flex: "0 0 auto",
                  width: dot,
                  height: dot,
                  borderRadius: "50%",
                  background: t.highlight,
                  color: t.fg,
                  fontSize: px(compact ? 26 : 30),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: t.displayFont,
                }}
              >
                {i + 1}
              </div>
              {i < spec.items.length - 1 && (
                <div style={{ flex: 1, width: 4, background: `${t.accent}33`, marginTop: 6, borderRadius: 2 }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: px(compact ? 28 : 34), fontWeight: 700, color: fg, lineHeight: 1.3 }}>
                {step.keyword}
              </div>
              <p
                style={{
                  fontSize: px(compact ? 23 : 27),
                  color: fg,
                  lineHeight: 1.45,
                  marginTop: 10,
                  marginBottom: 0,
                  whiteSpace: "pre-line",
                }}
              >
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </InfoFrame>
  );
}
