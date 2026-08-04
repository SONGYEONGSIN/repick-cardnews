import { sizeWith, type Fit } from "@/templates/fit";
import type { Theme } from "@/templates/themes";

/**
 * 정보전달 본문의 **공통 뼈대** — 제목·부제·(가운데 내용)·팁.
 *
 * 다섯 형식은 가운데만 다르다. 제목 글꼴·부제 여백·팁 상자는 전부 같다 — 형식마다 복제하면
 * 한 곳을 고칠 때 다섯 곳을 고쳐야 하고, 그러다 한 곳이 빠지면 형식마다 다른 카드가 된다.
 *
 * `compact`(항목이 많을 때 자동으로 줄이는 규칙)와 `fit`(사용자 배수)도 여기서 한 번만 푼다.
 */
export function InfoFrame({
  title,
  subtitle,
  tip,
  theme: t,
  onPhoto,
  compact,
  fit,
  hideTitle,
  children,
}: {
  title: string;
  subtitle?: string;
  tip?: string;
  theme: Theme;
  onPhoto: boolean;
  compact: boolean;
  fit: Fit;
  /** 제목이 위쪽 띠로 갔으면 여기서는 그리지 않는다(`titleInBand`). */
  hideTitle: boolean;
  children: React.ReactNode;
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
          {title}
        </h1>
      )}
      {subtitle && (
        <p
          style={{
            fontSize: px(compact ? 27 : 32),
            marginTop: 16,
            marginBottom: 8,
            opacity: 0.85,
            color: fg,
            whiteSpace: "pre-line",
          }}
        >
          {subtitle}
        </p>
      )}

      {/* 가운데가 형식마다 다른 부분. 남는 높이를 전부 가져간다(flex:1). */}
      <div style={{ marginTop: gap(compact ? 20 : 28), display: "flex", flexDirection: "column", flex: 1 }}>
        {children}
      </div>

      {tip && (
        <div style={{ marginTop: 20, padding: compact ? 16 : 22, borderRadius: 18, border: `2px solid ${t.accent}` }}>
          {/* ✅ 는 brand-voice.md 가 TIP 앞자리에 명시 승인한 이모지다. 하네스의 이모지 금지는
              UI 크롬에 대한 것이고 카드는 산출물이므로 여기서는 유지한다. */}
          {/* 사진 위에서는 accent 가 스크림에 묻히므로 onPhoto 색으로 바꾼다. */}
          <span style={{ fontFamily: t.displayFont, fontSize: px(compact ? 26 : 30), color: onPhoto ? t.onPhoto : t.accent }}>
            ✅ TIP{" "}
          </span>
          <span style={{ fontSize: px(compact ? 23 : 27), color: fg, whiteSpace: "pre-line" }}>{tip}</span>
        </div>
      )}
    </>
  );
}
