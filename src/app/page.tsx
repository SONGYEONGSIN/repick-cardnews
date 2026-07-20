import { CardRenderer } from "@/templates/CardRenderer";
import { infographicFixture } from "@/lib/fixtures";

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <div style={{ transform: "scale(0.4)", transformOrigin: "top left" }}>
        <CardRenderer spec={infographicFixture} themeId="mint-clean" index={0} />
      </div>
    </main>
  );
}
