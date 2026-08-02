import type { CardnewsCard } from "@/lib/schema";
import type { Theme } from "@/templates/themes";
import { isBlankText, splitHighlight, type TextAlign } from "@/templates/layout-utils";

/**
 * 편집으로 글을 지우면(값이 "" 또는 공백만) 저장 이미지에서 그 요소를 통째로 뺀다 —
 * 빈 태그를 남기면 여백만 남는다. 새 "숨김" 필드를 두지 않고 "글이 비면 안 그린다"만으로
 * 삭제를 표현한다(별도 플래그 없음 — CardCanvas.tsx 상단 주석 참고).
 */
function hasText(value: string | undefined): value is string {
  return value !== undefined && !isBlankText(value);
}

export function CardnewsBody({
  card,
  theme: t,
  onPhoto = false,
  compact = false,
  textScale,
  textAlign,
  highlight,
}: {
  card: CardnewsCard;
  theme: Theme;
  onPhoto?: boolean;
  /** split 레이아웃처럼 글 영역이 좁을 때 타이포를 줄여 클리핑을 막는다 */
  compact?: boolean;
  /**
   * 헤드라인·본문(및 단계·버튼 문구·핸들) 글자 크기 배수. 역할·레이아웃별로 이미 다른 실제
   * 글꼴 크기에 이 배수를 그대로 곱한다 — layout-utils의 textScaleFor(단계)가 만든 값만 온다.
   */
  textScale: number;
  /** 헤드라인·본문(및 cta 알약·핸들) 정렬. 카드 전체에 한 번에 적용된다. */
  textAlign: TextAlign;
  /** 헤드라인에서 형광으로 강조할 문자열. 빈 문자열이면 강조 없음 — splitHighlight 참고. */
  highlight: string;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  // cta 알약(아래 action 배지)에서만 쓰인다 — 역할 배지(RoleTag)는 지웠다
  const tagBg = onPhoto ? t.onPhoto : t.accent;
  const tagFg = onPhoto ? "#111111" : t.bg;

  // 헤드라인은 네 역할 분기(hook/problem·evidence/solution/cta) 모두에서 그려진다 — 강조 쪼개기를
  // 이 한 곳에만 두어 네 곳에 같은 splitHighlight 호출이 흩어지지 않게 한다.
  const Heading = ({ text }: { text: string }) => {
    const { before, match, after } = splitHighlight(text, highlight);
    return (
      <h1
        style={{
          fontFamily: t.displayFont,
          fontSize: Math.round((compact ? 56 : 72) * textScale),
          lineHeight: 1.22,
          margin: 0,
          color: fg,
          textAlign,
        }}
      >
        {before}
        {match.length > 0 && (
          // 형광 배경(theme.highlight)·글자색(theme.fg) — 아래 solution 단계 번호 배지와 같은
          // 배경·글자색 조합을 그대로 따른다. onPhoto 와 무관하게 항상 t.fg 를 쓴다 — onPhoto 의
          // 흰 글자(t.onPhoto)를 밝은 형광 배경 위에 얹으면 대비가 무너진다(mono-bold 를 제외한
          // 두 테마의 highlight 가 밝은 색이다).
          <mark style={{ background: t.highlight, color: t.fg }}>{match}</mark>
        )}
        {after}
      </h1>
    );
  };
  const Body = ({ children }: { children: React.ReactNode }) => (
    <p
      style={{
        fontSize: Math.round((compact ? 30 : 34) * textScale),
        lineHeight: 1.5,
        marginTop: compact ? 20 : 28,
        opacity: 0.92,
        color: fg,
        textAlign,
      }}
    >
      {children}
    </p>
  );
  if (card.role === "hook") {
    return (
      <>
        {hasText(card.heading) && <Heading text={card.heading} />}
        {hasText(card.sub) && <Body>{card.sub}</Body>}
      </>
    );
  }
  if (card.role === "problem" || card.role === "evidence") {
    return (
      <>
        {hasText(card.heading) && <Heading text={card.heading} />}
        {hasText(card.body) && <Body>{card.body}</Body>}
      </>
    );
  }
  if (card.role === "solution") {
    // 개별 단계도 같은 규칙을 적용한다 — 빈 단계는 목록에서 빠지고, 남은 단계만 1번부터 다시 매긴다.
    const steps = (card.steps ?? []).filter(hasText);
    return (
      <>
        {hasText(card.heading) && <Heading text={card.heading} />}
        {hasText(card.body) && <Body>{card.body}</Body>}
        {steps.length > 0 && (
          <div
            style={{
              marginTop: compact ? 18 : 24,
              display: "flex",
              flexDirection: "column",
              gap: compact ? 10 : 14,
            }}
          >
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  fontSize: Math.round((compact ? 26 : 30) * textScale),
                  color: fg,
                }}
              >
                {/* 원 지름은 글자 크기 배수를 곱하지 않는다 — 지금 지름·글자 비율(1.4~1.5배)이면
                    lg(1.2배)까지도 숫자가 원 밖으로 밀리지 않는다(위 fontSize 참고). */}
                <span
                  style={{
                    width: compact ? 38 : 44,
                    height: compact ? 38 : 44,
                    borderRadius: 999,
                    background: t.highlight,
                    color: t.fg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: t.displayFont,
                  }}
                >
                  {i + 1}
                </span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
  return (
    <div style={{ textAlign }}>
      {hasText(card.heading) && <Heading text={card.heading} />}
      {hasText(card.action) && (
        <div
          style={{
            marginTop: 40,
            display: "inline-block",
            fontFamily: t.displayFont,
            fontSize: Math.round((compact ? 34 : 40) * textScale),
            color: tagFg,
            background: tagBg,
            padding: compact ? "14px 32px" : "18px 40px",
            borderRadius: 20,
          }}
        >
          {card.action}
        </div>
      )}
      {hasText(card.handle) && (
        <p style={{ marginTop: 28, fontSize: Math.round(30 * textScale), opacity: 0.8, color: fg }}>{card.handle}</p>
      )}
    </div>
  );
}
