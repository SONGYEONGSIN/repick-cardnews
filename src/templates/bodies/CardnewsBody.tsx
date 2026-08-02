import type { CardnewsCard } from "@/lib/schema";
import type { Theme } from "@/templates/themes";
import { isBlankText } from "@/templates/layout-utils";

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
}: {
  card: CardnewsCard;
  theme: Theme;
  onPhoto?: boolean;
  /** split 레이아웃처럼 글 영역이 좁을 때 타이포를 줄여 클리핑을 막는다 */
  compact?: boolean;
}) {
  const fg = onPhoto ? t.onPhoto : t.fg;
  // cta 알약(아래 action 배지)에서만 쓰인다 — 역할 배지(RoleTag)는 지웠다
  const tagBg = onPhoto ? t.onPhoto : t.accent;
  const tagFg = onPhoto ? "#111111" : t.bg;

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h1
      style={{
        fontFamily: t.displayFont,
        fontSize: compact ? 56 : 72,
        lineHeight: 1.22,
        margin: 0,
        color: fg,
      }}
    >
      {children}
    </h1>
  );
  const Body = ({ children }: { children: React.ReactNode }) => (
    <p
      style={{
        fontSize: compact ? 30 : 34,
        lineHeight: 1.5,
        marginTop: compact ? 20 : 28,
        opacity: 0.92,
        color: fg,
      }}
    >
      {children}
    </p>
  );
  if (card.role === "hook") {
    return (
      <>
        {hasText(card.heading) && <Heading>{card.heading}</Heading>}
        {hasText(card.sub) && <Body>{card.sub}</Body>}
      </>
    );
  }
  if (card.role === "problem" || card.role === "evidence") {
    return (
      <>
        {hasText(card.heading) && <Heading>{card.heading}</Heading>}
        {hasText(card.body) && <Body>{card.body}</Body>}
      </>
    );
  }
  if (card.role === "solution") {
    // 개별 단계도 같은 규칙을 적용한다 — 빈 단계는 목록에서 빠지고, 남은 단계만 1번부터 다시 매긴다.
    const steps = (card.steps ?? []).filter(hasText);
    return (
      <>
        {hasText(card.heading) && <Heading>{card.heading}</Heading>}
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
                  fontSize: compact ? 26 : 30,
                  color: fg,
                }}
              >
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
    <div style={{ textAlign: "center" }}>
      {hasText(card.heading) && <Heading>{card.heading}</Heading>}
      {hasText(card.action) && (
        <div
          style={{
            marginTop: 40,
            display: "inline-block",
            fontFamily: t.displayFont,
            fontSize: compact ? 34 : 40,
            color: tagFg,
            background: tagBg,
            padding: compact ? "14px 32px" : "18px 40px",
            borderRadius: 20,
          }}
        >
          {card.action}
        </div>
      )}
      {hasText(card.handle) && <p style={{ marginTop: 28, fontSize: 30, opacity: 0.8, color: fg }}>{card.handle}</p>}
    </div>
  );
}
