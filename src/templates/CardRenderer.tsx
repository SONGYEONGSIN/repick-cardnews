import type { CardnewsCard, InfographicSpec } from "@/lib/schema";
import type { CardLayout } from "@/lib/layout-assign";
import { THEMES, type ThemeId } from "@/templates/themes";
import { CardFrame } from "@/templates/CardFrame";
import { InfographicBody } from "@/templates/bodies/InfographicBody";
import { CardnewsBody } from "@/templates/bodies/CardnewsBody";
import { FullBleedCard } from "@/templates/layouts/FullBleedCard";
import { SplitPhotoCard } from "@/templates/layouts/SplitPhotoCard";
import { TextOnlyCard } from "@/templates/layouts/TextOnlyCard";
import { textYSpacers, type Focal, type TextAlign, type TextYSpacers } from "@/templates/layout-utils";

function isInfographicCopy(copy: CardnewsCard | InfographicSpec): copy is InfographicSpec {
  return "type" in copy;
}

export type RenderCard = {
  layout: CardLayout;
  photoUrl: string | null;
  focal: Focal;
  scrim: number;
  band: number;
  /** 글 덩어리의 세로 위치(0~1). full-bleed 카드의 scrim 이 이 값에 앵커된다. */
  textY: number;
  /** 헤드라인·본문 글자 크기 배수(CardnewsBody 전용). InfographicBody 경로에서는 쓰이지 않는다. */
  textScale: number;
  /** 헤드라인·본문 정렬(CardnewsBody 전용). InfographicBody 경로에서는 쓰이지 않는다. */
  textAlign: TextAlign;
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
  const body = isInfographicCopy(card.copy) ? (
    <InfographicBody spec={card.copy} theme={theme} onPhoto={onPhoto} compact={card.copy.items.length >= 5} />
  ) : (
    <CardnewsBody
      card={card.copy}
      theme={theme}
      onPhoto={onPhoto}
      compact={card.layout === "split"}
      textScale={card.textScale}
      textAlign={card.textAlign}
    />
  );
  // InfographicBody는 아이템 목록에 스스로 flex:1을 걸어 남는 공간을 요구한다 — 스페이서가
  // 그 공간을 나눠 가지면 자연 높이를 전제하는 스페이서 모델이 깨진다. 0/0은 "여기서는
  // 스페이서가 자리를 요구하지 않는다"는 뜻이라, InfographicBody 는 지금처럼 남는 공간을 전부
  // 가져간다 — 오늘과 정확히 같은 모습이다.
  const spacers: TextYSpacers = isInfographicCopy(card.copy) ? { top: 0, bottom: 0 } : textYSpacers(card.textY);

  return (
    <CardFrame theme={theme} handle={handle}>
      {card.layout === "full-bleed" && (
        <FullBleedCard
          theme={theme}
          photoUrl={card.photoUrl}
          focal={card.focal}
          scrim={card.scrim}
          textY={card.textY}
          spacers={spacers}
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
          spacers={spacers}
          badge={card.badge}
          accent={theme.accent}
        >
          {body}
        </SplitPhotoCard>
      )}
      {card.layout === "text-only" && (
        <TextOnlyCard spacers={spacers} badge={card.badge} accent={theme.accent}>
          {body}
        </TextOnlyCard>
      )}
    </CardFrame>
  );
}
