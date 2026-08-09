"use client";

import { useEffect, useRef } from "react";
import { Move } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import type { Photo } from "@/lib/photos";
import {
  isBlankText,
  objectPosition,
  scrimGradient,
  scrimTint,
  splitHighlight,
  textScaleStepOf,
  textYSpacers,
  type Focal,
  type TextScaleStep,
} from "@/templates/layout-utils";
import { AD_BADGE_TEXT, adBadgeColor } from "@/templates/ad-badge";
import { boxBackground } from "@/lib/text-box";
import { THEMES, type ThemeId } from "@/templates/themes";
import type { CardDraft } from "../reducer";
import type { EditTarget } from "./EditToolbar";
import type { TextBounds } from "./text-drag";
import { TextYHandle } from "./TextYHandle";

/**
 * 캔버스 — 카드 자체가 편집 표면이다.
 *
 * 글은 별도 입력칸이 아니라 **여기서 직접** 고친다(선택하면 그 자리가 편집 가능해진다).
 * 사진을 고르면 초점 핸들이 뜨고 끌어서 옮긴다 — 가로·세로 슬라이더 두 개가 사라진다.
 *
 * 겹치는 영역을 각각 고르게 하려면 버튼을 중첩할 수 없다(HTML 규칙). 그래서 사진 면은 자리를
 * 잡는 껍데기 안에 **사진 버튼과 초점 핸들을 형제로** 두고, 글 블록은 그 위에 `pointer-events`
 * 를 되살린 층으로 얹는다.
 *
 * 출력(`src/templates`)과 **같은 식을 쓴다**: 크롭 기준점은 `objectPosition(focal)`, 글 자리는
 * `textYSpacers(textY)` 로 만든 신축 여백 비율, 글 배경은 `scrimGradient(scrim, textY)`,
 * full-bleed 는 어두운 가림막 위 밝은 글(템플릿의 `onPhoto` 반전), 색·글꼴은 `themeId` 로 받은
 * `THEMES[themeId]` — `CardnewsBody`·`CardFrame`·`layouts/*` 가 각 값을 쓰는 자리를 그대로
 * 따라간다(카드 바탕 `bg`, 글 색 `fg`/`onPhoto`, cta 알약과 split 구분선의 `accent`, 헤드라인·
 * cta 알약의 `displayFont`). 캔버스가 결과와 다르게 보이면 편집 표면으로서 쓸모가 없다.
 *
 * 인라인 `style` 은 **열세 곳**이다. 앞 여섯은 0~1 연속값이라 Tailwind 클래스로 표현할 수 없고
 * (JIT 은 런타임 값으로 클래스를 만들지 못한다), 뒤 여섯은 `themeId` 로 고른 테마 값이라 같은
 * 이유로 클래스가 될 수 없다(어느 테마가 골렸는지는 실행 중에만 안다):
 *   1. 초점 핸들 위치 — `card.focal`
 *   2. 사진 크롭 기준점 — `card.focal`
 *   3. 글 배경 그라디언트 — `card.scrim` + `card.textY`
 *   4. split 사진 높이 — `card.band`
 *   5. 글 위 신축 여백 몫 — `card.textY`
 *   6. 글 아래 신축 여백 몫 — `card.textY`
 *   7. 카드 바탕색 + 표시 글꼴 변수 — `theme.bg`, `theme.displayFont`(CSS 커스텀 프로퍼티로
 *      내려 `font-[family-name:var(--card-display-font)]` 유틸이 상속해 쓴다)
 *   8. 헤드라인 색 — `onPhoto ? theme.onPhoto : theme.fg`
 *   9. 본문 색 — 8과 같은 값(불투명도만 `opacity-[0.92]` 클래스로 따로 준다)
 *  10. cta 알약 배경·글자색 — `onPhoto ? theme.onPhoto : theme.accent` / `onPhoto ? 없음 : theme.bg`.
 *      `CardnewsBody`는 onPhoto 일 때 글자색으로 테마 밖 리터럴("#111111")을 쓰는데, 이 파일은
 *      테마 값만 인라인으로 허용되므로 그 리터럴을 옮기지 않는다 — 대신 색을 비워 전역 ink
 *      토큰(항상 어두움)을 상속시켜 같은 대비를 얻는다. 세 테마 모두 `onPhoto` 가 흰색이라
 *      결과는 사실상 같다.
 *  11. split 구분선 색 — `theme.accent`(두께 `border-t-[6px]`는 고정값이라 클래스로 둔다)
 *  12. 형광 강조 배경·글자색 — `theme.highlight`/`theme.fg`(`card.highlight` 가 있고 편집 중이
 *      아닐 때만 그려지는 `<mark>`). `CardnewsBody`와 같은 조합 — onPhoto 라도 `theme.fg`를 쓴다
 *      (그 파일 주석 참고, 대비 확보가 이유다)
 *  13. 순서 번호 원의 배경·글자색 — 12와 **같은 조합**(`theme.highlight`/`theme.fg`). 해법 카드의
 *      `steps` 앞에 붙는 동그라미로, `CardnewsBody` 가 쓰는 값과 같다
 * 색 리터럴은 컴포넌트에 없다 — 전부 토큰 클래스이거나 `layout-utils`/`THEMES` 가 만든 값이고,
 * 인라인으로는 그 값만 그대로 넘긴다.
 *
 * 크기: `xl` 미만은 뷰포트 비율(`h-[min(70vh,760px)]`)로 정한다. `xl` 이상은 높이·폭 **둘 다**
 * `auto`(`xl:h-auto`, 폭은 원래도 `auto` — 이 컴포넌트는 어느 폭에서도 `w-*` 클래스를 두지
 * 않는다) 로 두고 `aspect-[4/5]` 와 `max-w-full`(모든 폭에서 상시)· `xl:max-h-full` 두 상한이
 * 동시에 작용하게 한다 — 브라우저가 "세로 비율을 지키며 두 상한(부모가 준 남는 높이, 남는 폭)
 * 중 더 좁은 쪽에 맞춰 최대 크기"를 스스로 계산한다(비대체 요소의 `aspect-ratio` + 양쪽
 * `auto` + `max-*` 조합 — `<img>` 의 `max-width/max-height` 축소와 같은 원리). 옛 `xl:h-full`
 * 은 높이만 확정값으로 못박아 폭이 `max-w-full` 에 걸리면 세로 비율이 깨졌다(`WorkbenchScreen`
 * 이 오른쪽 칸에 상한을 두면 이 폭 부족이 실제로 일어난다) — 이번엔 두 축을 함께 `auto` 로
 * 둬서 그 결함을 구조적으로 막는다. 이 자동 축소가 실제로 동작하려면 부모(`WorkbenchScreen`
 * 의 카드 상자)가 `stretch` 대신 `items-center` 로 이 요소를 누르지 않아야 한다(그쪽 주석
 * 참고) — 아니면 flex 기본값(`stretch`)이 높이를 다시 확정값으로 만들어 버린다.
 *
 * 빈 글(헤드라인·본문·버튼 문구): 저장 이미지(`CardnewsBody`)는 비면 요소를 통째로 안 그리지만,
 * 캔버스는 다시 입력할 자리가 남아야 하므로 흐린 자리 표시("헤드라인 없음 — 눌러서 입력")를
 * 보인다 — 캔버스와 출력이 여기서만 의도적으로 갈린다(초점 핸들·`TextYHandle` 과 같은 이유,
 * 편집을 위한 표시는 저장 이미지에 없다). `textY` 배치(`textYSpacers`)는 `blockRef` 가 잰
 * 실제 높이로 계산하므로, 자리 표시가 헤드라인·본문의 실제 글꼴 크기(56~72px·30~34px)로 뜨면
 * 글 덩어리가 부풀어 출력과 어긋난다 — 그래서 자리 표시는 실제 글꼴 크기를 쓰지 않고 작은
 * 고정 크기(`text-[13px]`)로만 그린다. 자리 표시 글자는 또한 `position:absolute`(`EditableText`
 * 의 오버레이)로 편집칸 위에 얹을 뿐 제 몫의 높이를 요구하지 않는다 — 작은 글꼴이 `contentEditable`
 * 특유의 빈 줄 높이(브라우저가 빈 편집 영역에도 커서를 위해 남기는 한 줄)까지 줄이고, absolute
 * 배치가 그 위에 얹힌 자리 표시 글자를 부모 높이 계산에서 뺀다 — 두 방어가 함께 작동한다.
 */

/** 방향키 한 번에 5%. 스무 번이면 끝에서 끝까지 가고, 한 칸이 눈에 보인다. */
const FOCAL_STEP = 0.05;

/** full-bleed 는 글이 어두운 가림막 위에 놓이므로 선택 링도 뒤집어야 보인다. */
function ring(on: boolean, onPhoto: boolean): string {
  if (!on) return "";
  return onPhoto
    ? "ring-2 ring-surface ring-offset-2 ring-offset-ink"
    : "ring-2 ring-ink ring-offset-2 ring-offset-surface";
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function pct(ratio: number): string {
  return `${ratio * 100}%`;
}

/**
 * 글자 크기 3단계 → 캔버스 전용 Tailwind 클래스. 값은 layout-utils.textScaleFor 의 배수
 * (작게 0.85·보통 1·크게 1.2)를 이 파일의 기존 캔버스 기준 크기(헤드라인 26/36px, 본문 16/18px,
 * 버튼 문구 15px)에 곱해 반올림한 것 — 출력(CardnewsBody)이 실제 글꼴 크기에 같은 배수를 곱하는
 * 것과 같은 계산이다(같은 배수, 같은 곱셈 — 캔버스와 출력이 절대 px 기준은 다르지만 배수의
 * 출처는 하나다). Tailwind JIT 는 런타임에 조립한 클래스명을 인식하지 못하므로(파일 상단
 * "인라인 style" 주석과 같은 이유) 세 단계 전부를 리터럴 문자열로 박아 두고 golden step 으로만
 * 고른다.
 */
const HEADING_SCALE_CLASS: Record<TextScaleStep, string> = {
  sm: "text-[22px] font-black leading-tight tracking-tight sm:text-[31px] font-[family-name:var(--card-display-font)]",
  md: "text-[26px] font-black leading-tight tracking-tight sm:text-[36px] font-[family-name:var(--card-display-font)]",
  lg: "text-[31px] font-black leading-tight tracking-tight sm:text-[43px] font-[family-name:var(--card-display-font)]",
};
const BODY_SCALE_CLASS: Record<TextScaleStep, string> = {
  sm: "text-[14px] leading-relaxed opacity-[0.92] sm:text-[15px]",
  md: "text-[16px] leading-relaxed opacity-[0.92] sm:text-[18px]",
  lg: "text-[19px] leading-relaxed opacity-[0.92] sm:text-[22px]",
};
/**
 * 순서 목록 글자 — 출력(`CardnewsBody`)의 26/30px 을 이 캔버스 비율(본문 30→16px, ≈0.53)로
 * 줄인 값이다. 본문보다 한 단계 작게 두는 관계도 출력과 같다.
 */
const STEP_SCALE_CLASS: Record<TextScaleStep, string> = {
  sm: "text-[12px] leading-snug sm:text-[14px]",
  md: "text-[14px] leading-snug sm:text-[16px]",
  lg: "text-[17px] leading-snug sm:text-[19px]",
};
const ACTION_SCALE_CLASS: Record<TextScaleStep, string> = {
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[18px]",
};

/**
 * 편집 결과를 한 줄 텍스트로 정규화한다.
 *
 * `innerText` 로 읽어 화면에 보이는 줄바꿈을 개행으로 받은 뒤 공백 하나로 접는다 — `textContent`
 * 는 `<br>` 을 빈 문자열로 읽어 Enter 로 나눈 두 줄이 **구분자 없이 붙는다**. 스키마의 heading·
 * body·action 은 한 줄 문자열이고 줄 나눔은 출력 템플릿이 하므로 여기서 개행을 보존할 이유가 없다.
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 그 자리에서 고치는 글.
 *
 * `contentEditable="plaintext-only"` 라 붙여넣기해도 마크업이 React 관리 노드로 들어오지 않는다.
 *
 * `editing`(고칠 수 있는가)과 `ringClass`(선택 표시)를 나눠 받는다 — 헤드라인·본문은 툴바에서
 * 고른 동안만 편집 가능하고 선택 링이 뜨지만, cta 의 버튼 문구는 툴바에 대응하는 대상이 없어
 * (다섯 번째 대상을 만들지 않는다) 늘 편집 가능하고 링 대신 포커스 표시만 쓴다.
 *
 * 비었으면(`isBlankText`) 실제 글 대신 `placeholderClassName`(작은 고정 크기)로 자리 표시를
 * 그린다 — 큰 실제 글꼴을 그대로 쓰면 글 덩어리가 부풀어 `textY` 배치가 출력과 어긋난다(파일
 * 상단 주석 참고). 자리 표시 글자 자체는 `position:absolute` 오버레이라 편집칸의 레이아웃
 * 높이에 더해지지 않는다.
 *
 * `displayNode`(형광 강조, 헤드라인 전용)는 **편집 중이 아닐 때만** 쓴다 — `editing` 이 참이면
 * `contentEditable="plaintext-only"` 라 반드시 순수 문자열(`value`)만 자식으로 둔다. 이 프로젝트가
 * 앞서 편집 영역에 마크업이 섞이는 문제를 겪고 `plaintext-only` + `innerText` 로 정리한 적이 있어
 * (이 파일 상단·`onBlur` 참고), 그 안에 `<mark>` 를 넣으면 같은 문제가 되살아난다.
 */
function EditableText({
  value,
  editing,
  ringClass,
  label,
  className,
  placeholderClassName,
  placeholder,
  style,
  onCommit,
  onActivate,
  elRef,
  displayNode,
  onSelectionChange,
}: {
  value: string;
  editing: boolean;
  ringClass: string;
  label: string;
  className: string;
  /** 비었을 때 쓰는 스타일 — 실제 글꼴보다 작게 둬서 자리 표시가 글 덩어리 높이를 부풀리지 않는다 */
  placeholderClassName: string;
  /** 비었을 때 보이는 안내 문구. 저장 이미지에는 나오지 않는다(캔버스 전용) */
  placeholder: string;
  /** 테마 색(헤드라인·본문·cta 알약) 전용 — 값은 항상 호출부에서 THEMES 로 채운다 */
  style?: React.CSSProperties;
  onCommit: (text: string) => void;
  onActivate?: () => void;
  /** 툴바의 "추가" 버튼이 이 칸에 포커스를 옮길 때만 쓴다(heading·body) */
  elRef?: React.RefObject<HTMLDivElement | null>;
  /** 편집 중이 아닐 때 `value` 대신 그릴 노드(헤드라인 형광 강조). 없으면 `value` 그대로 그린다. */
  displayNode?: React.ReactNode;
  /** 헤드라인 전용 — 드래그·키보드로 선택 범위가 바뀔 때마다 부른다(형광 지정 대상 포착) */
  onSelectionChange?: () => void;
}) {
  const blank = isBlankText(value);
  const editable = (
    <div
      ref={elRef}
      role="textbox"
      aria-label={label}
      aria-multiline="false"
      tabIndex={0}
      contentEditable={editing ? "plaintext-only" : false}
      suppressContentEditableWarning
      onClick={onActivate}
      onFocus={onActivate}
      // 편집 중에는 DOM 이 진실이다. 빠져나갈 때 한 번만 상태로 올린다 —
      // 글자마다 올리면 카드 전체가 다시 그려져 커서가 튄다.
      onBlur={(e) => onCommit(normalize(e.currentTarget.innerText))}
      onMouseUp={onSelectionChange}
      onKeyUp={onSelectionChange}
      style={blank ? undefined : style}
      className={`pointer-events-auto cursor-text rounded outline-none ${ringClass} ${blank ? placeholderClassName : className}`}
    >
      {blank ? "" : editing ? value : (displayNode ?? value)}
    </div>
  );
  if (!blank) return editable;
  return (
    <div className="relative">
      {editable}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center text-[13px] text-ink-2 italic"
      >
        {placeholder}
      </span>
    </div>
  );
}

/**
 * 초점 핸들. 끌어서도 옮기고 방향키로도 옮긴다.
 *
 * 사진 버튼의 **형제**다(버튼 안에 버튼을 넣을 수 없다). `pointer-events-none` 이라 핸들 위에서
 * 시작한 드래그도 밑의 사진 버튼이 받고, 키보드로는 Tab 으로 닿는다 — pointer-events 는 포인터
 * 히트 테스트만 끄지 탭 순서를 끄지 않는다.
 */
function FocalHandle({ focal, onFocal }: { focal: Focal; onFocal: (focal: Focal) => void }) {
  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dx = e.key === "ArrowLeft" ? -FOCAL_STEP : e.key === "ArrowRight" ? FOCAL_STEP : 0;
    const dy = e.key === "ArrowUp" ? -FOCAL_STEP : e.key === "ArrowDown" ? FOCAL_STEP : 0;
    if (dx === 0 && dy === 0) return;
    e.preventDefault(); // 방향키로 화면이 같이 스크롤되지 않게
    onFocal({ x: clamp01(focal.x + dx), y: clamp01(focal.y + dy) });
  }

  return (
    <button
      type="button"
      // 이름에 현재 값을 담는다 — 방향키로 값이 바뀌면 포커스된 요소의 이름이 다시 읽힌다
      aria-label={`사진 초점 — 가로 ${Math.round(focal.x * 100)}%, 세로 ${Math.round(focal.y * 100)}%. 방향키로 옮겨요`}
      onKeyDown={handleKey}
      // 인라인 style 1/13 — 초점은 0~1 연속값이라 자리를 Tailwind 클래스로 표현할 수 없다
      style={{ left: pct(focal.x), top: pct(focal.y) }}
      className={`pointer-events-none absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-surface ${FOCUS_RING}`}
    >
      <Move size={17} aria-hidden="true" />
    </button>
  );
}

/**
 * 사진 면. 누르면 골라지고, 누른 채 끌면 초점이 따라온다.
 *
 * 포인터 캡처를 잡아 두면 사진 밖으로 나가도 드래그가 이어진다 — 초점을 가장자리(0 또는 1)로
 * 밀 때 필요하다. 캡처 보유 여부가 곧 "지금 끄는 중"이라 별도 상태를 두지 않는다.
 */
function PhotoSurface({
  photo,
  focal,
  on,
  wrapperClass,
  bandRatio,
  onSelect,
  onFocal,
}: {
  photo: Photo | undefined;
  focal: Focal;
  on: boolean;
  wrapperClass: string;
  /** split 에서만 준다 — 카드 높이 대비 사진 영역 비율(`card.band`) */
  bandRatio?: number;
  onSelect: () => void;
  onFocal: (focal: Focal) => void;
}) {
  function handleDown(e: React.PointerEvent<HTMLButtonElement>) {
    onSelect();
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onFocal({
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    });
  }

  function handleUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      // 인라인 style 4/13 — split 사진 높이는 card.band(0~1 연속값) 라 클래스로 표현할 수 없다
      style={bandRatio === undefined ? undefined : { height: pct(bandRatio) }}
      className={`${wrapperClass} overflow-hidden bg-hair-soft`}
    >
      <button
        type="button"
        aria-label="사진 — 눌러 고르고 끌어서 초점을 옮겨요"
        aria-pressed={on}
        onClick={onSelect}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        // 고른 뒤에만 터치 제스처를 가져온다 — 안 고른 사진 위에서는 화면이 그대로 스크롤돼야 한다
        className={`absolute inset-0 ${FOCUS_RING} ${on ? "cursor-move touch-none" : "cursor-pointer"}`}
      >
        {/* 로컬 blob/dataURL 프리뷰 — next/image 는 이 URL 을 최적화할 수 없다.
            draggable={false} 가 없으면 브라우저의 이미지 끌어놓기가 먼저 발동해 초점 드래그가
            pointercancel 로 끊긴다 — 포인터 캡처는 네이티브 드래그를 막지 못한다. */}
        {photo && (
          <img
            src={photo.thumbUrl}
            alt={photo.name}
            draggable={false}
            // 인라인 style 2/13 — 크롭 기준점. 출력 템플릿과 같은 objectPosition(focal) 을 쓴다
            style={{ objectPosition: objectPosition(focal) }}
            className="h-full w-full object-cover"
          />
        )}
      </button>
      {on && <FocalHandle focal={focal} onFocal={onFocal} />}
    </div>
  );
}

export function CardCanvas({
  card,
  photo,
  target,
  themeId,
  ad,
  focusToken,
  onSelect,
  onPatch,
  onHeadlineSelect,
}: {
  card: CardDraft;
  photo: Photo | undefined;
  target: EditTarget;
  themeId: ThemeId;
  /** 협찬·광고 표기 — 이 카드에 그릴지(`showAdBadge` 가 이미 판정한 결과). */
  ad: boolean;
  /**
   * 툴바의 "추가" 버튼을 누를 때마다 하나씩 늘어나는 신호. 값 자체엔 의미가 없다 — 이미 빈
   * 값이라 `onPatch` 만으로는 아무 변화가 없는데(EditToolbar 상단 주석: 눌러도 아무 일도
   * 안 나는 버튼을 두지 않는다), 그 자리에 포커스를 옮기는 게 실제 효과다. 0 은 "아직 요청
   * 없음"이라 첫 렌더에서는 포커스를 옮기지 않는다.
   */
  focusToken: number;
  onSelect: (t: EditTarget) => void;
  onPatch: (patch: Partial<Omit<CardDraft, "id" | "photoId">>) => void;
  /**
   * 헤드라인 안에서 드래그·키보드로 고른 글자를 올려보낸다(형광 지정용, `window.getSelection()`
   * 으로 읽는다 — `document.querySelector` 같은 직접 조회가 아니라 이 칸의 마우스/키 이벤트로만
   * 읽는다). 저장하지는 않는다 — 저장은 툴바의 [형광] 버튼을 눌러야 `card.highlight` 로 확정된다.
   */
  onHeadlineSelect: (text: string) => void;
}) {
  const theme = THEMES[themeId];
  const copy = card.copy;

  // 글 덩어리와 그 위아래 신축 여백. 끌 때 치수를 재려면 세 조각을 다 잡고 있어야 한다 —
  // 한 번에 한 레이아웃만 그리므로 ref 한 벌이면 된다.
  const blockRef = useRef<HTMLDivElement>(null);
  const topSpacerRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);
  // 추가 버튼이 포커스를 옮길 대상. body 는 역할에 따라 없을 수 있어 ref 만 미리 만들어 두고
  // 실제로 그 칸을 그릴 때만 EditableText 에 넘긴다(안 그리면 focus() 도 no-op).
  const headingRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusToken === 0) return;
    if (target === "heading") headingRef.current?.focus();
    else if (target === "body") bodyRef.current?.focus();
  }, [focusToken]);

  /**
   * 손잡이가 쓸 치수. **남는 공간은 두 여백이 실제로 차지한 높이의 합**이라 패딩을 따로 헤아릴
   * 필요가 없고, 위 여백의 위 끝이 곧 글 영역(패딩 안쪽)의 위 끝이다.
   * ref 로만 잰다 — `document` 조회를 쓰지 않는다.
   */
  const measureText = (): TextBounds | null => {
    const top = topSpacerRef.current;
    const bottom = bottomSpacerRef.current;
    const block = blockRef.current;
    if (!top || !bottom || !block) return null;
    const topRect = top.getBoundingClientRect();
    return {
      contentTop: topRect.top,
      freeSpace: topRect.height + bottom.getBoundingClientRect().height,
      blockHeight: block.getBoundingClientRect().height,
    };
  };

  // 글을 고르는 중일 때만 손잡이를 띄운다 — 사진 초점 핸들이 사진 대상일 때만 뜨는 것과 같은 규칙.
  const textSelected = target === "heading" || target === "body";
  const spacers = textYSpacers(card.textY);

  // full-bleed 만 글이 가림막 위에 놓인다. 출력 템플릿의 `onPhoto` 와 같은 반전을 쓴다 —
  // 어두운 가림막 + 밝은 글. 반대로 두면 글 배경을 낮췄을 때 검정 글이 사진에 묻힌다.
  const onPhoto = card.layout === "full-bleed";
  // 헤드라인·본문이 같이 쓰는 글 색. CardnewsBody 와 같은 규칙 — 사용자가 고른 색이 이긴다.
  const fg = card.textColor ?? (onPhoto ? theme.onPhoto : theme.fg);
  // 출력과 같은 함수로 만든다. 두 벌로 두면 화면과 저장 결과가 어긋난다.
  const textBoxBg = card.textBox ? boxBackground(card.textBox.color, card.textBox.opacity) : null;
  // 글자 크기 단계 — card.textScale(배수)을 textScaleStepOf 로 역산해 어느 클래스 세트를 쓸지 고른다.
  const scaleStep = textScaleStepOf(card.textScale);
  // 정렬 — CardnewsBody 가 헤드라인·본문·cta 알약·핸들에 같은 값을 곱씹는 것과 같다(card.textAlign).
  // text-left/text-center 는 Tailwind 기본 유틸이라 그대로 클래스로 쓴다(연속값이 아니다).
  const alignTextClass = card.textAlign === "center" ? "text-center" : "text-left";
  // cta 알약은 self-start(왼쪽 붙음)/self-center(가운데)로 자리를 잡는다 — CardnewsBody 가 cta
  // 알약을 textAlign:center 인 부모 안의 inline-block 으로 가운데 놓는 것과 같은 결과를
  // flex 자식의 cross-axis 정렬(self-*)로 낸다.
  const alignSelfClass = card.textAlign === "center" ? "self-center" : "self-start";
  const headingClass = `${HEADING_SCALE_CLASS[scaleStep]} ${alignTextClass}`;
  // opacity-[0.92] 는 CardnewsBody 의 Body 컴포넌트가 쓰는 고정 불투명도(테마 값이 아니라
  // 상수라 인라인이 아니라 클래스로 둔다)
  const bodyClass = `${BODY_SCALE_CLASS[scaleStep]} ${alignTextClass}`;
  // 순서 목록은 번호 원과 글이 한 줄이라 글 자체는 늘 왼쪽 정렬이고, **줄 묶음 전체**가
  // 가운데로 간다(출력의 `textAlign` 이 부모에 걸리는 것과 같은 결과).
  const stepClass = `${STEP_SCALE_CLASS[scaleStep]} text-left`;
  const alignStepsClass = card.textAlign === "center" ? "items-center" : "items-start";
  // 헤드라인·본문이 비었을 때 쓰는 자리 표시 크기 — headingClass·bodyClass(56~72px·30~34px)를
  // 그대로 쓰면 빈 칸이 실제 글만큼 커 보여 textY 배치가 출력과 어긋난다(파일 상단 주석 참고).
  // 자리 표시는 크기·정렬 조작 대상이 아니라 고정 크기로 둔다(위 이유와 같다 — 실제 스타일을
  // 반영하면 안 된다).
  const textPlaceholderClass = "text-[13px] italic";
  // cta 알약이 비었을 때 쓰는 자리 표시 — 테마 배경 대신 점선 테두리만 그려 "눌러도 안 나온
  // 채워진 버튼"처럼 보이지 않게 한다. actionClass 와 크기(px-4 py-2 text-[15px])는 맞춘다 —
  // 알약은 이미 작아 헤드라인·본문만큼 부풀지 않는다.
  const actionPlaceholderClass = `${alignSelfClass} rounded-full border border-dashed border-hair px-4 py-2 text-[13px] italic text-ink-2`;
  // 버튼 문구는 늘 편집 가능하므로 선택 링 대신 포커스 링으로 지금 어디 있는지 알린다.
  // 배경·글자색은 THEMES 값이라 클래스가 아니라 style(actionStyle)로 준다.
  const actionClass = `${alignSelfClass} rounded-full px-4 py-2 ${ACTION_SCALE_CLASS[scaleStep]} font-bold font-[family-name:var(--card-display-font)] focus:ring-2 focus:ring-offset-2 ${
    onPhoto ? "focus:ring-surface focus:ring-offset-ink" : "focus:ring-ink focus:ring-offset-surface"
  }`;
  const actionStyle: React.CSSProperties = {
    // cta 알약 배경 — CardnewsBody 의 tagBg 와 같다
    background: onPhoto ? theme.onPhoto : theme.accent,
    // cta 알약 글자색 — !onPhoto 는 tagBg 와 같은 tagFg(theme.bg). onPhoto 는 CardnewsBody 가
    // 테마 밖 리터럴("#111111")을 쓰므로 여기선 비워 전역 ink 토큰을 상속시킨다(위 파일 주석 10번).
    color: onPhoto ? undefined : theme.bg,
  };
  // 카드 바탕색 + 표시 글꼴 변수. `--card-display-font` 는 React.CSSProperties 에 없는 키라
  // 타입을 단언 없이 넓혀서 쓴다 — 헤드라인·cta 알약의 font-[family-name:var(--card-display-font)]
  // 유틸이 이 값을 상속해 읽는다.
  const containerStyle: React.CSSProperties & { "--card-display-font": string } = {
    background: theme.bg,
    "--card-display-font": theme.displayFont,
  };

  // heading 은 다섯 역할 전부에 있어 유니온을 그대로 펼쳐도 된다.
  const commitHeading = (text: string) => onPatch({ copy: { ...copy, heading: text } });

  // body 는 problem·evidence·solution 에만 있다. 좁힌 **안쪽에서** 패치를 만들어야 유니온에
  // 없는 필드가 섞이지 않는다 — 바깥에서 `{ ...copy, body }` 를 만들면 hook·cta 에 body 가 생긴다.
  const bodyEdit =
    "body" in copy
      ? { value: copy.body, commit: (text: string) => onPatch({ copy: { ...copy, body: text } }) }
      : undefined;

  /**
   * 순서 목록(해법 카드 전용). **출력에는 있는데 이 캔버스에 없던 값이다** — 편집 화면에서
   * 보이지도 고쳐지지도 않아 Claude 가 써 준 순서를 손댈 방법이 아예 없었다.
   *
   * 빈 단계를 걸러 내지 **않고** 그대로 그린다. 출력(`CardnewsBody`)은 빈 단계를 빼고 번호를
   * 다시 매기지만, 편집 중에는 빈 칸이 남아 있어야 거기에 글을 넣을 수 있다 — 자리 표시가
   * 그 사실을 말한다. 저장하면 출력 규칙대로 빠진다.
   */
  const stepsEdit =
    "steps" in copy
      ? {
          values: copy.steps ?? [],
          commit: (index: number, text: string) =>
            onPatch({
              copy: { ...copy, steps: (copy.steps ?? []).map((v, i) => (i === index ? text : v)) },
            }),
        }
      : undefined;

  // 버튼 문구(cta 전용, 상한 40자)도 같은 방식으로 좁힌 안쪽에서 패치한다. 스키마가 마지막
  // 카드를 cta 로 강제하므로 모든 세트에 하나씩 있다 — 여기서 못 고치면 어디서도 못 고친다.
  const actionEdit =
    "action" in copy
      ? { value: copy.action, commit: (text: string) => onPatch({ copy: { ...copy, action: text } }) }
      : undefined;

  // 헤드라인 형광 강조 — 편집 중이 아닐 때만 EditableText 의 displayNode 로 건넨다(그 컴포넌트
  // 상단 주석 참고: plaintext-only 편집 중엔 절대 마크업을 넣지 않는다). 저장 이미지(CardnewsBody)
  // 와 같은 splitHighlight 로 나누고, 같은 배경·글자색 조합(theme.highlight/theme.fg)을 쓴다.
  const headingSplit = splitHighlight(copy.heading, card.highlight);
  const headingHighlighted: React.ReactNode | undefined =
    headingSplit.match.length > 0 ? (
      <>
        {headingSplit.before}
        {/* 인라인 style 12/13 — 형광 배경·글자색(theme.highlight/theme.fg). CardnewsBody 와 같은
            조합 — onPhoto 라도 theme.fg 를 쓴다(그 파일 주석 참고, 대비 확보가 이유다) */}
        <mark style={{ background: theme.highlight, color: theme.fg }}>{headingSplit.match}</mark>
        {headingSplit.after}
      </>
    ) : undefined;

  /**
   * 글 층. 세 레이아웃이 **같은 구조**를 쓴다 — 출력 템플릿 셋이 그렇듯 글 덩어리 위아래에
   * 신축 여백을 두고 남는 공간만 `textY` 비율로 나눈다. 좌표로 자르는 게 아니라 남는 공간을
   * 나누므로 글이 길어져도 카드 밖으로 밀려나지 않는다.
   */
  const textLayer = (scrim?: number, splitDivider?: boolean) => (
    <div
      // 인라인 style 11/13 — split 구분선 색(theme.accent). 두께(border-t-[6px])는 고정값이라
      // 클래스로 둔다. splitDivider 가 아니면 스타일을 아예 안 준다(SplitPhotoCard 와 동일 조건).
      style={splitDivider ? { borderTopColor: theme.accent } : undefined}
      className={`pointer-events-none relative flex flex-1 flex-col p-7 ${splitDivider ? "border-t-[6px]" : ""}`}
    >
      {scrim !== undefined && (
        <span
          aria-hidden="true"
          // 인라인 style 3/13 — 글 배경. 진하기(card.scrim)도 앵커(card.textY)도 0~1 연속값이라
          // 클래스로 표현할 수 없다. 색 리터럴은 layout-utils 의 scrimGradient 가 만든다
          style={{ background: scrimGradient(scrim, card.textY, scrimTint(theme.accent)) }}
          className="absolute inset-0"
        />
      )}
      {/* 인라인 style 5/13 — 위 여백이 가져갈 몫(card.textY). 나머지 세 속성은 클래스로 둔다 */}
      <div ref={topSpacerRef} style={{ flexGrow: spacers.top }} className="min-h-0 shrink-0 basis-0" />
      {/* 인라인 style 12/13 — 글 뒤 상자(사용자가 고른 색·불투명도). 출력(`CardRenderer` 의
          boxedBody)과 **같은 함수**로 만든 값이라 화면과 저장 결과가 같다. 상자가 없으면
          배경도 안쪽 여백도 주지 않는다 — 껐는데 글 위치가 바뀌면 안 된다. */}
      <div
        ref={blockRef}
        style={textBoxBg ? { background: textBoxBg } : undefined}
        className={`relative flex flex-col gap-3 ${textBoxBg ? "rounded-xl px-4 py-3" : ""}`}
      >
        <EditableText
          // 값을 key 에 넣어 카피가 밖에서 바뀌면(다시 만들기 등) 새로 마운트한다 —
          // contentEditable 은 값이 DOM 에 남아 갱신되지 않는다. 편집 중에는 value 가 그대로라
          // key 도 그대로다(타이핑 도중 마운트가 끊기지 않는다).
          key={`${card.id}-heading-${copy.heading}`}
          value={copy.heading}
          editing={target === "heading"}
          ringClass={ring(target === "heading", onPhoto)}
          onActivate={() => onSelect("heading")}
          onCommit={commitHeading}
          label="헤드라인"
          className={headingClass}
          placeholderClassName={textPlaceholderClass}
          placeholder="헤드라인 없음 — 눌러서 입력"
          elRef={headingRef}
          // 인라인 style 8/13 — 헤드라인 색(onPhoto ? theme.onPhoto : theme.fg)
          style={{ color: fg }}
          displayNode={headingHighlighted}
          onSelectionChange={() => onHeadlineSelect(window.getSelection()?.toString() ?? "")}
        />
        {bodyEdit && (
          <EditableText
            key={`${card.id}-body-${bodyEdit.value}`}
            value={bodyEdit.value}
            editing={target === "body"}
            ringClass={ring(target === "body", onPhoto)}
            onActivate={() => onSelect("body")}
            onCommit={bodyEdit.commit}
            label="본문"
            className={bodyClass}
            placeholderClassName={textPlaceholderClass}
            placeholder="본문 없음 — 눌러서 입력"
            elRef={bodyRef}
            // 인라인 style 9/13 — 본문 색. 헤드라인과 같은 fg 값(불투명도는 opacity-[0.92] 클래스)
            style={{ color: fg }}
          />
        )}
        {stepsEdit && stepsEdit.values.length > 0 && (
          <div className={`mt-3 flex flex-col gap-1.5 ${alignStepsClass}`}>
            {stepsEdit.values.map((step, i) => (
              <span key={`${card.id}-step-${i}`} className="flex items-center gap-2">
                {/* 인라인 style 13/13 — 순서 번호 원(theme.highlight/theme.fg). CardnewsBody 와
                    같은 조합이다. 지름·글꼴은 클래스로 둔다(고정값이거나 CSS 변수 상속).
                    아래 단계 글자의 `color: fg` 는 9번(본문 색)과 **같은 값**이라 따로 세지 않는다. */}
                <span
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold tabular-nums font-[family-name:var(--card-display-font)] sm:h-[23px] sm:w-[23px] sm:text-[13px]"
                  style={{ background: theme.highlight, color: theme.fg }}
                >
                  {i + 1}
                </span>
                <EditableText
                  key={`${card.id}-step-${i}-${step}`}
                  value={step}
                  editing={target === "steps"}
                  ringClass={ring(target === "steps", onPhoto)}
                  onActivate={() => onSelect("steps")}
                  onCommit={(text) => stepsEdit.commit(i, text)}
                  label={`${i + 1}번째 순서`}
                  className={stepClass}
                  placeholderClassName={textPlaceholderClass}
                  placeholder="빈 순서 — 눌러서 입력"
                  style={{ color: fg }}
                />
              </span>
            ))}
          </div>
        )}
        {actionEdit && (
          <EditableText
            key={`${card.id}-action-${actionEdit.value}`}
            value={actionEdit.value}
            editing
            ringClass=""
            onCommit={actionEdit.commit}
            label="버튼 문구 (최대 40자)"
            className={actionClass}
            placeholderClassName={actionPlaceholderClass}
            placeholder="버튼 문구 없음 — 눌러서 입력"
            // 인라인 style 10/13 — cta 알약 배경·글자색(actionStyle, 위 선언부 주석 참고)
            style={actionStyle}
          />
        )}
        {textSelected && (
          <TextYHandle textY={card.textY} measure={measureText} onTextY={(textY) => onPatch({ textY })} />
        )}
      </div>
      {/* 인라인 style 6/13 — 아래 여백이 가져갈 몫(1 − card.textY). 두 몫의 합은 늘 1 이다 */}
      <div ref={bottomSpacerRef} style={{ flexGrow: spacers.bottom }} className="min-h-0 shrink-0 basis-0" />
    </div>
  );

  const photoSurface = (wrapperClass: string, bandRatio?: number) => (
    <PhotoSurface
      photo={photo}
      focal={card.focal}
      on={target === "photo"}
      wrapperClass={wrapperClass}
      bandRatio={bandRatio}
      onSelect={() => onSelect("photo")}
      onFocal={(focal) => onPatch({ focal })}
    />
  );

  return (
    <div
      // 인라인 style 7/13 — 카드 바탕색 + 표시 글꼴 변수(containerStyle, 위 선언부 주석 참고)
      style={containerStyle}
      className="relative flex aspect-[4/5] h-[min(70vh,760px)] max-w-full flex-col overflow-hidden rounded-2xl border border-hair xl:h-auto xl:max-h-full"
    >
      {card.layout === "full-bleed" && (
        <>
          {photoSurface("absolute inset-0")}
          {textLayer(card.scrim)}
        </>
      )}

      {card.layout === "split" && (
        <>
          {photoSurface("relative w-full flex-none", card.band)}
          {textLayer(undefined, true)}
        </>
      )}

      {card.layout === "text-only" && textLayer()}

      {/* **출력과 같은 자리·같은 판정**으로 그린다(`@/templates/ad-badge`). 편집 화면에 안
          그리면 스위치를 켜도 눈앞에서 아무 일이 안 일어나 "안 되는 것" 으로 읽힌다 —
          실제로 그렇게 보고받았다(2026-08-09). 이 저장소는 화면과 저장 결과가 어긋나면
          안 된다는 것을 규칙으로 두고 있다. */}
      {ad && (
        <div
          // 인라인 style 8/13 — 표기 색만. 글꼴은 다른 곳과 같이 `--card-display-font` 를
          // 유틸로 읽는다(이 화면들은 인라인 fontFamily 를 금지한다 — `design-gate.test.ts`).
          style={{ color: adBadgeColor(theme, onPhoto) }}
          className="pointer-events-none absolute right-[4%] top-[2.4%] text-[13px] font-[family-name:var(--card-display-font)] opacity-90 sm:text-[17px]"
        >
          {AD_BADGE_TEXT}
        </div>
      )}
    </div>
  );
}
