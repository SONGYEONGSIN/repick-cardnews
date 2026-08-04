import type { InfographicSpec } from "@/lib/schema";
import { DEFAULT_FIT, sizeWith, type Fit } from "@/templates/fit";
import type { Theme } from "@/templates/themes";
import { InfoFrame } from "./InfoFrame";

/**
 * 숫자 형식 — **수치 자체가 메시지다.**
 *
 * "1도만 올려도 7% 줄어요" 를 목록 설명에 넣으면 숫자가 문장에 묻힌다. 여기서는 숫자를
 * 문장에서 꺼내 가장 크게 그린다.
 *
 * 개수에 따라 크기를 달리한다 — 둘이면 넉넉하고 셋이면 줄여야 한 화면에 들어간다.
 */
export function StatBody({
  spec,
  theme: t,
  onPhoto = false,
  compact = false,
  hideTitle = false,
  fit = DEFAULT_FIT,
}: {
  spec: Extract<InfographicSpec, { format: "stat" }>;
  theme: Theme;
  onPhoto?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  fit?: Fit;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  const px = (base: number) => sizeWith(base, fit.text);
  const gap = (base: number) => sizeWith(base, fit.gap);
  const many = spec.items.length >= 3;

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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: gap(many ? 24 : 40),
          justifyContent: "center",
          flex: 1,
        }}
      >
        {spec.items.map((stat, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                fontFamily: t.displayFont,
                // 숫자는 카드에서 가장 큰 글자다 — 제목(66)보다 크게 잡아야 "수치가 메시지" 가 된다.
                fontSize: px(many ? 96 : 124),
                lineHeight: 1,
                color: onPhoto ? t.onPhoto : t.accent,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: px(many ? 27 : 32), color: fg, lineHeight: 1.4, whiteSpace: "pre-line" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </InfoFrame>
  );
}
