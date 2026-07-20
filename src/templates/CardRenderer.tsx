import type { ContentSpec } from "@/lib/schema";
import type { ThemeId } from "@/templates/themes";
import { InfographicCard } from "@/templates/InfographicCard";

export function CardRenderer({ spec, themeId, index }: { spec: ContentSpec; themeId: ThemeId; index: number }) {
  if (spec.type === "informationsend") {
    return <InfographicCard spec={spec} themeId={themeId} />;
  }
  // cardnews 분기는 Task 13에서 CardnewsSlide로 확장
  return <div style={{ width: 1080, height: 1350 }} data-todo-cardnews={index} />;
}
