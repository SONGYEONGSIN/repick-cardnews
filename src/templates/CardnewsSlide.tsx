import type { CardnewsCard } from "@/lib/schema";
import { THEMES, type ThemeId } from "@/templates/themes";
import { CardFrame } from "@/templates/CardFrame";

export function CardnewsSlide({ card, themeId, badge }: { card: CardnewsCard; themeId: ThemeId; badge: string }) {
  const t = THEMES[themeId];
  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h1 style={{ fontFamily: t.displayFont, fontSize: 72, lineHeight: 1.22, margin: 0 }}>{children}</h1>
  );
  const Body = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 34, lineHeight: 1.5, marginTop: 28, opacity: 0.92 }}>{children}</p>
  );
  const RoleTag = ({ label }: { label: string }) => (
    <span style={{ display: "inline-block", fontFamily: t.displayFont, fontSize: 30, color: t.bg, background: t.accent, padding: "6px 20px", borderRadius: 999, marginBottom: 28 }}>{label}</span>
  );

  return (
    <CardFrame theme={t}>
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 26, color: t.accent }}>{badge}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {card.role === "hook" && (
          <>
            {card.badge && <RoleTag label={card.badge} />}
            <Heading>{card.heading}</Heading>
            {card.sub && <Body>{card.sub}</Body>}
          </>
        )}
        {card.role === "problem" && (<><RoleTag label="문제" /><Heading>{card.heading}</Heading><Body>{card.body}</Body></>)}
        {card.role === "evidence" && (<><RoleTag label="증거" /><Heading>{card.heading}</Heading><Body>{card.body}</Body></>)}
        {card.role === "solution" && (
          <>
            <RoleTag label="해결책" />
            <Heading>{card.heading}</Heading>
            <Body>{card.body}</Body>
            {card.steps && (
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                {card.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 30 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 999, background: t.highlight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.displayFont }}>{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {card.role === "cta" && (
          <div style={{ textAlign: "center" }}>
            <Heading>{card.heading}</Heading>
            <div style={{ marginTop: 40, display: "inline-block", fontFamily: t.displayFont, fontSize: 40, color: t.bg, background: t.accent, padding: "18px 40px", borderRadius: 20 }}>{card.action}</div>
            {card.handle && <p style={{ marginTop: 28, fontSize: 30, opacity: 0.8 }}>{card.handle}</p>}
          </div>
        )}
      </div>
    </CardFrame>
  );
}
