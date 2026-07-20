import type { ContentSpec } from "@/lib/schema";
import type { ThemeId } from "@/templates/themes";
import { InfographicCard } from "@/templates/InfographicCard";
import { CardnewsSlide } from "@/templates/CardnewsSlide";

export function CardRenderer({ spec, themeId, index }: { spec: ContentSpec; themeId: ThemeId; index: number }) {
  if (spec.type === "informationsend") {
    return <InfographicCard spec={spec} themeId={themeId} />;
  }
  const card = spec.cards[index];
  return <CardnewsSlide card={card} themeId={themeId} badge={`${index + 1} / ${spec.cards.length}`} />;
}
