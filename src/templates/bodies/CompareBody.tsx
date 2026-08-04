import type { InfographicSpec } from "@/lib/schema";
import { DEFAULT_FIT, sizeWith, type Fit } from "@/templates/fit";
import type { Theme } from "@/templates/themes";
import { InfoFrame } from "./InfoFrame";

/**
 * 비교 형식 — **둘을 나란히 놓고 같은 기준으로 잰다.**
 *
 * 목록형으로는 "에어컨 vs 선풍기" 를 설명 안에 뭉개 넣을 수밖에 없었다. 여기서는 열 두 개가
 * 머리줄에 서고, 행마다 기준 하나와 양쪽 값이 마주 본다.
 *
 * **기준 칸을 왼쪽에 따로 둔다.** 두 열만 두고 기준을 값 안에 적으면 눈이 무엇을 비교하는지
 * 매번 다시 읽어야 한다. 기준이 한 줄로 서 있어야 아래로 훑을 수 있다.
 */
export function CompareBody({
  spec,
  theme: t,
  onPhoto = false,
  compact = false,
  hideTitle = false,
  fit = DEFAULT_FIT,
}: {
  spec: Extract<InfographicSpec, { format: "compare" }>;
  theme: Theme;
  onPhoto?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  fit?: Fit;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  const px = (base: number) => sizeWith(base, fit.text);
  const gap = (base: number) => sizeWith(base, fit.gap);
  const headFg = onPhoto ? t.onPhoto : t.fg;

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
      {/* 머리줄 — 무엇과 무엇을 비교하는지. 기준 칸 자리를 비워 아래 행과 열이 맞는다. */}
      <div style={{ display: "flex", gap: gap(12), alignItems: "stretch" }}>
        <div style={{ flex: "0 0 28%" }} />
        {[spec.columns.left, spec.columns.right].map((name, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: t.accent,
              color: t.onPhoto,
              borderRadius: 14,
              padding: `${compact ? 10 : 14}px ${compact ? 12 : 16}px`,
              fontFamily: t.displayFont,
              fontSize: px(compact ? 26 : 30),
              textAlign: "center",
            }}
          >
            {name}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: gap(compact ? 10 : 14), marginTop: gap(14) }}>
        {spec.items.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: gap(12),
              alignItems: "flex-start",
              // 행 사이 실선 하나. 표처럼 보이되 격자를 다 그리지는 않는다 — 카드에서 선이
              // 많으면 글보다 선이 먼저 보인다.
              // 강조색을 아주 옅게 — 테마마다 색이 달라도 카드 안에서 겉돌지 않는다.
              // (THEMES 의 accent 는 6자리 hex 라 알파 두 자리를 덧붙일 수 있다.)
              borderTop: i === 0 ? "none" : `2px solid ${t.accent}22`,
              paddingTop: i === 0 ? 0 : gap(compact ? 8 : 12),
            }}
          >
            <div
              style={{
                flex: "0 0 28%",
                fontSize: px(compact ? 24 : 28),
                fontWeight: 700,
                color: fg,
                lineHeight: 1.35,
              }}
            >
              {row.label}
            </div>
            {[row.left, row.right].map((value, j) => (
              <div
                key={j}
                style={{
                  flex: 1,
                  fontSize: px(compact ? 23 : 27),
                  color: headFg,
                  lineHeight: 1.4,
                  textAlign: "center",
                  whiteSpace: "pre-line",
                }}
              >
                {value}
              </div>
            ))}
          </div>
        ))}
      </div>
    </InfoFrame>
  );
}
