import type { CardnewsCard, InfographicSpec } from "@/lib/schema";
import type { CardLayout } from "@/lib/layout-assign";
import { THEMES, type ThemeId } from "@/templates/themes";
import { CardFrame } from "@/templates/CardFrame";
import { InfographicBody } from "@/templates/bodies/InfographicBody";
import { CardnewsBody } from "@/templates/bodies/CardnewsBody";
import { FullBleedCard } from "@/templates/layouts/FullBleedCard";
import { SplitPhotoCard } from "@/templates/layouts/SplitPhotoCard";
import { TextOnlyCard } from "@/templates/layouts/TextOnlyCard";
import type { Focal } from "@/templates/layout-utils";

export type RenderCard = {
  layout: CardLayout;
  photoUrl: string | null;
  focal: Focal;
  scrim: number;
  band: number;
  /**
   * 글 덩어리의 세로 위치(0~1). full-bleed 카드의 scrim 이 이 값에 앵커된다.
   * infosend(`src/features/infosend/render.ts`)는 split 레이아웃만 쓰고 이 값을 채우지 않으므로
   * 선택 필드로 둔다 — full-bleed 분기에서만 읽고, 그때는 fallback(아래 참조)으로 채운다.
   */
  textY?: number;
  /** "1 / 5" 형태. 빈 문자열이면 렌더하지 않는다 */
  badge: string;
  copy: CardnewsCard | InfographicSpec;
};

export function CardRenderer({
  card,
  themeId,
  handle,
}: {
  card: RenderCard;
  themeId: ThemeId;
  handle: string;
}) {
  const theme = THEMES[themeId];
  const onPhoto = card.layout === "full-bleed" && card.photoUrl !== null;
  const body =
    "type" in card.copy ? (
      <InfographicBody spec={card.copy} theme={theme} onPhoto={onPhoto} compact={card.copy.items.length >= 5} />
    ) : (
      <CardnewsBody
        card={card.copy}
        theme={theme}
        onPhoto={onPhoto}
        compact={card.layout === "split"}
      />
    );

  return (
    <CardFrame theme={theme} handle={handle}>
      {card.layout === "full-bleed" && (
        <FullBleedCard
          theme={theme}
          photoUrl={card.photoUrl}
          focal={card.focal}
          scrim={card.scrim}
          // full-bleed 기본 배치(justifyContent:flex-end)와 같은 1로 대체 — infosend 는 이 분기를 타지 않는다.
          textY={card.textY ?? 1}
          badge={card.badge}
        >
          {body}
        </FullBleedCard>
      )}
      {card.layout === "split" && (
        <SplitPhotoCard
          photoUrl={card.photoUrl}
          focal={card.focal}
          band={card.band}
          badge={card.badge}
          accent={theme.accent}
        >
          {body}
        </SplitPhotoCard>
      )}
      {card.layout === "text-only" && (
        <TextOnlyCard badge={card.badge} accent={theme.accent}>
          {body}
        </TextOnlyCard>
      )}
    </CardFrame>
  );
}
