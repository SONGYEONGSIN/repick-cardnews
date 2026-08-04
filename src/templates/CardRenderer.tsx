import type { CardnewsCard, InfographicSpec } from "@/lib/schema";
import type { CardLayout } from "@/lib/layout-assign";
import { THEMES, type ThemeId } from "@/templates/themes";
import { titleInBand } from "@/templates/infographic-band";
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
  /**
   * 헤드라인에서 형광으로 강조할 문자열(CardnewsBody 전용, InfographicBody 경로에서는 쓰이지
   * 않는다). 위치가 아니라 글자 자체 — layout-utils의 splitHighlight 참고. 빈 문자열이면 강조 없음.
   */
  highlight: string;
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
  // 제목을 위쪽 띠로 올릴지 **한 곳에서** 정한다 — 띠를 그리는 쪽(SplitPhotoCard)과 제목을
  // 건너뛰는 쪽(InfographicBody)이 각자 판단하면 어긋난다(`@/templates/infographic-band`).
  const bandTitle = isInfographicCopy(card.copy) && titleInBand(card.photoUrl, card.layout);
  const body = isInfographicCopy(card.copy) ? (
    <InfographicBody
      spec={card.copy}
      theme={theme}
      onPhoto={onPhoto}
      compact={card.copy.items.length >= 5}
      hideTitle={bandTitle}
    />
  ) : (
    <CardnewsBody
      card={card.copy}
      theme={theme}
      onPhoto={onPhoto}
      compact={card.layout === "split"}
      textScale={card.textScale}
      textAlign={card.textAlign}
      highlight={card.highlight}
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
          titleBand={
            bandTitle && isInfographicCopy(card.copy)
              ? { text: card.copy.title, bg: theme.accent, fg: theme.onPhoto, font: theme.displayFont }
              : undefined
          }
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
