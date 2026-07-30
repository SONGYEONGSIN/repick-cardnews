import type { CardnewsCard } from "@/lib/schema";
import type { Theme } from "@/templates/themes";

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
  const RoleTag = ({ label }: { label: string }) => (
    <span
      style={{
        display: "inline-block",
        fontFamily: t.displayFont,
        fontSize: compact ? 26 : 30,
        color: tagFg,
        background: tagBg,
        padding: "6px 20px",
        borderRadius: 999,
        marginBottom: compact ? 20 : 28,
      }}
    >
      {label}
    </span>
  );

  if (card.role === "hook") {
    return (
      <>
        {card.badge && <RoleTag label={card.badge} />}
        <Heading>{card.heading}</Heading>
        {card.sub && <Body>{card.sub}</Body>}
      </>
    );
  }
  if (card.role === "problem" || card.role === "evidence") {
    return (
      <>
        <RoleTag label={card.role === "problem" ? "문제" : "증거"} />
        <Heading>{card.heading}</Heading>
        <Body>{card.body}</Body>
      </>
    );
  }
  if (card.role === "solution") {
    return (
      <>
        <RoleTag label="해결책" />
        <Heading>{card.heading}</Heading>
        <Body>{card.body}</Body>
        {card.steps && (
          <div
            style={{
              marginTop: compact ? 18 : 24,
              display: "flex",
              flexDirection: "column",
              gap: compact ? 10 : 14,
            }}
          >
            {card.steps.map((s, i) => (
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
      <Heading>{card.heading}</Heading>
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
      {card.handle && <p style={{ marginTop: 28, fontSize: 30, opacity: 0.8, color: fg }}>{card.handle}</p>}
    </div>
  );
}
