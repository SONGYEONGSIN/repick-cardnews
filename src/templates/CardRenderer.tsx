import type { CardnewsCard, InfographicSpec } from "@/lib/schema";
import type { CardLayout } from "@/lib/layout-assign";
import { THEMES, type Theme, type ThemeId } from "@/templates/themes";
import { titleInBand } from "@/templates/infographic-band";
import { CardFrame } from "@/templates/CardFrame";
import { InfographicBody } from "@/templates/bodies/InfographicBody";
import { CompareBody } from "@/templates/bodies/CompareBody";
import { StepsBody } from "@/templates/bodies/StepsBody";
import { StatBody } from "@/templates/bodies/StatBody";
import { CheckBody } from "@/templates/bodies/CheckBody";
import { CardnewsBody } from "@/templates/bodies/CardnewsBody";
import { boxBackground } from "@/lib/text-box";
import { FullBleedCard } from "@/templates/layouts/FullBleedCard";
import { SplitPhotoCard } from "@/templates/layouts/SplitPhotoCard";
import { TextOnlyCard } from "@/templates/layouts/TextOnlyCard";
import { textYSpacers, type Focal, type TextAlign, type TextYSpacers } from "@/templates/layout-utils";
import type { Fit } from "@/templates/fit";

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
  /** 글 뒤 상자(CardnewsBody 전용). `null` 이면 안 그린다. */
  textBox?: { color: string; opacity: number } | null;
  /** 글자 색(CardnewsBody 전용). `null` 이면 테마 색을 쓴다. */
  textColor?: string | null;
  /** "1 / 5" 형태. 빈 문자열이면 렌더하지 않는다 */
  badge: string;
  /**
   * 카드 안 글자 크기·간격·여백 **배수**(정보전달 전용, 카드뉴스 경로에서는 쓰이지 않는다).
   * 없으면 기본값 — 지금까지와 똑같다(`@/templates/fit`).
   */
  fit?: Fit;
  copy: CardnewsCard | InfographicSpec;
};

/** 정보전달 본문을 형식으로 고른다. `compact` 기준은 형식마다 다르다 — 항목 수와 글의 양이 다르다. */
function infoBodyFor(
  spec: Extract<RenderCard["copy"], { type: "informationsend" }>,
  opts: { theme: Theme; onPhoto: boolean; hideTitle: boolean; fit: RenderCard["fit"] },
) {
  const common = { theme: opts.theme, onPhoto: opts.onPhoto, hideTitle: opts.hideTitle, fit: opts.fit };
  switch (spec.format) {
    case "list":
      return <InfographicBody spec={spec} {...common} compact={spec.items.length >= 5} />;
    case "steps":
      return <StepsBody spec={spec} {...common} compact={spec.items.length >= 4} />;
    case "compare":
      return <CompareBody spec={spec} {...common} compact={spec.items.length >= 4} />;
    case "stat":
      return <StatBody spec={spec} {...common} compact={false} />;
    case "check":
      return <CheckBody spec={spec} {...common} compact={spec.items.length >= 6} />;
  }
}

/**
 * 글 덩어리를 상자로 두른다. 상자가 없으면 그대로 돌려준다 — 빈 `div` 를 끼우면 레이아웃이
 * 미세하게 달라져 "상자를 껐는데 글 위치가 바뀐다" 가 된다.
 *
 * `display: inline-block` 이 아니라 블록으로 둔다: 글 폭 전체를 덮어야 여러 줄이 고르게
 * 읽힌다(참고 사진들이 그 모양이었다).
 */
function boxedBody(body: React.ReactNode, box: { color: string; opacity: number } | null): React.ReactNode {
  const background = box ? boxBackground(box.color, box.opacity) : null;
  if (!background) return body;
  return (
    <div style={{ background, borderRadius: 14, padding: "18px 22px" }}>{body}</div>
  );
}

export function CardRenderer({
  card,
  themeId,
  handle,
  ad = false,
}: {
  card: RenderCard;
  themeId: ThemeId;
  handle: string;
  /** 협찬·광고 표기(우측 상단). 세트 전체에 같이 적용된다. */
  ad?: boolean;
}) {
  const theme = THEMES[themeId];
  const onPhoto = card.layout === "full-bleed" && card.photoUrl !== null;
  // 제목을 위쪽 띠로 올릴지 **한 곳에서** 정한다 — 띠를 그리는 쪽(SplitPhotoCard)과 제목을
  // 건너뛰는 쪽(InfographicBody)이 각자 판단하면 어긋난다(`@/templates/infographic-band`).
  const bandTitle = isInfographicCopy(card.copy) && titleInBand(card.photoUrl, card.layout);
  // 형식마다 본문이 다르다(`@/lib/schema` 의 INFO_FORMATS). 다섯을 여기서 한 번에 고른다 —
  // 각 본문이 스스로 판단하면 형식이 늘 때마다 다섯 곳을 고쳐야 한다.
  const body = isInfographicCopy(card.copy) ? (
    infoBodyFor(card.copy, { theme, onPhoto, hideTitle: bandTitle, fit: card.fit })
  ) : (
    <CardnewsBody
      card={card.copy}
      theme={theme}
      onPhoto={onPhoto}
      compact={card.layout === "split"}
      textScale={card.textScale}
      textAlign={card.textAlign}
      highlight={card.highlight}
      textColor={card.textColor ?? null}
    />
  );
  // 글 뒤 상자는 **본문을 감싸서** 그린다 — 세 레이아웃(full-bleed·split·text-only) 어디서든
  // 같은 결과가 나오도록 여기 한 곳에서만 두른다.
  const boxed = boxedBody(body, card.textBox ?? null);
  // InfographicBody는 아이템 목록에 스스로 flex:1을 걸어 남는 공간을 요구한다 — 스페이서가
  // 그 공간을 나눠 가지면 자연 높이를 전제하는 스페이서 모델이 깨진다. 0/0은 "여기서는
  // 스페이서가 자리를 요구하지 않는다"는 뜻이라, InfographicBody 는 지금처럼 남는 공간을 전부
  // 가져간다 — 오늘과 정확히 같은 모습이다.
  const spacers: TextYSpacers = isInfographicCopy(card.copy) ? { top: 0, bottom: 0 } : textYSpacers(card.textY);

  return (
    <CardFrame theme={theme} handle={handle} ad={ad} onPhoto={onPhoto}>
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
          {boxed}
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
          fit={card.fit}
        >
          {boxed}
        </SplitPhotoCard>
      )}
      {card.layout === "text-only" && (
        <TextOnlyCard spacers={spacers} badge={card.badge} accent={theme.accent}>
          {boxed}
        </TextOnlyCard>
      )}
    </CardFrame>
  );
}
