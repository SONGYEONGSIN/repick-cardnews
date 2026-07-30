import type { InfographicSpec } from "@/lib/schema";
import type { Theme } from "@/templates/themes";

export function InfographicBody({ spec, theme: t }: { spec: InfographicSpec; theme: Theme }) {
  return (
    <>
      <h1 style={{ fontFamily: t.displayFont, fontSize: 66, lineHeight: 1.2, margin: 0 }}>{spec.title}</h1>
      {spec.subtitle && (
        <p style={{ fontSize: 32, marginTop: 16, marginBottom: 8, opacity: 0.85 }}>{spec.subtitle}</p>
      )}
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
        {spec.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: 52,
                height: 52,
                borderRadius: 999,
                background: t.accent,
                color: t.bg,
                fontFamily: t.displayFont,
                fontSize: 30,
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
                  fontSize: 34,
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
              <p style={{ fontSize: 27, lineHeight: 1.45, marginTop: 10, marginBottom: 0, opacity: 0.9 }}>
                {it.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      {spec.tip && (
        <div style={{ marginTop: 20, padding: 22, borderRadius: 18, border: `2px solid ${t.accent}` }}>
          <span style={{ fontFamily: t.displayFont, fontSize: 30, color: t.accent }}>TIP </span>
          <span style={{ fontSize: 27 }}>{spec.tip}</span>
        </div>
      )}
    </>
  );
}
