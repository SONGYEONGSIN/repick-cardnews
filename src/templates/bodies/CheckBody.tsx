import type { InfographicSpec } from "@/lib/schema";
import { DEFAULT_FIT, sizeWith, type Fit } from "@/templates/fit";
import type { Theme } from "@/templates/themes";
import { InfoFrame } from "./InfoFrame";

/**
 * 체크리스트 형식 — **설명 없이 목록만.**
 *
 * 항목이 많고(4~8개) 각 항목은 한 줄이다. 목록형처럼 설명을 붙이면 8개가 카드에 안 들어간다.
 * 네모 상자를 앞에 두어 "하나씩 확인하는 것" 임을 보인다.
 */
export function CheckBody({
  spec,
  theme: t,
  onPhoto = false,
  compact = false,
  hideTitle = false,
  fit = DEFAULT_FIT,
}: {
  spec: Extract<InfographicSpec, { format: "check" }>;
  theme: Theme;
  onPhoto?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  fit?: Fit;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  const px = (base: number) => sizeWith(base, fit.text);
  const gap = (base: number) => sizeWith(base, fit.gap);
  const box = compact ? 34 : 40;

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
      <div style={{ display: "flex", flexDirection: "column", gap: gap(compact ? 14 : 20) }}>
        {spec.items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: gap(compact ? 14 : 18), alignItems: "center" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: box,
                height: box,
                borderRadius: 8,
                border: `3px solid ${onPhoto ? t.onPhoto : t.accent}`,
              }}
            />
            <div style={{ flex: 1, fontSize: px(compact ? 28 : 33), color: fg, lineHeight: 1.35 }}>{item.text}</div>
          </div>
        ))}
      </div>
    </InfoFrame>
  );
}
