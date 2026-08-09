"use client";

import { CardRenderer, type RenderCard } from "@/templates/CardRenderer";
import { showAdBadge } from "@/templates/ad-badge";
import type { ThemeId } from "@/templates/themes";

/**
 * 화면 밖에 transform 없는 1080×1350 원본 카드를 렌더한다.
 * 편집 화면의 미리보기는 scale()로 축소해 보여주는데, 그 축소된 노드를 그대로
 * 캡처하면 해상도가 깨진다. 그래서 캡처 전용 노드를 이 컴포넌트로 따로 둔다.
 * `left: -100000px`로 화면 밖에 배치한다 — display:none/visibility:hidden을 쓰면
 * html-to-image가 노드 크기를 0으로 읽어 빈 PNG가 나온다.
 */
export function CaptureStage({
  cards,
  themeId,
  handle,
  ad,
  registerRef,
}: {
  cards: readonly RenderCard[];
  themeId: ThemeId;
  handle: string;
  /** 협찬·광고 표기. **미리보기와 반드시 같은 값**이어야 한다 — 화면엔 있고 올라간
   * 사진엔 없으면 표기를 안 한 것이 된다. */
  ad: boolean;
  registerRef: (index: number, node: HTMLDivElement | null) => void;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed left-[-100000px] top-0 opacity-0">
      {cards.map((card, i) => (
        <div
          key={card.badge + i}
          ref={(node) => {
            registerRef(i, node);
          }}
        >
          <CardRenderer card={card} themeId={themeId} handle={handle} ad={showAdBadge(ad, i, cards.length)} />
        </div>
      ))}
    </div>
  );
}
