"use client";

import { Move } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import type { Photo } from "@/lib/photos";
import { objectPosition, type Focal } from "@/templates/layout-utils";
import type { CardDraft } from "../reducer";
import type { EditTarget } from "./EditToolbar";

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
 * 출력(`src/templates`)과 **같은 식을 쓴다**: 크롭 기준점은 `objectPosition(focal)`, full-bleed
 * 는 어두운 가림막 위 밝은 글(템플릿의 `onPhoto` 반전). 캔버스가 결과와 다르게 보이면 편집
 * 표면으로서 쓸모가 없다.
 *
 * 인라인 `style` 은 **네 곳뿐**이다. 넷 다 0~1 연속값이라 Tailwind 클래스로 표현할 수 없다
 * (JIT 은 런타임 값으로 클래스를 만들지 못한다):
 *   1. 초점 핸들 위치 — `card.focal`
 *   2. 사진 크롭 기준점 — `card.focal`
 *   3. 글 배경 진하기 — `card.scrim`
 *   4. split 사진 높이 — `card.band`
 * 색은 전부 토큰 클래스에서 오고, 인라인으로는 숫자(위치·불투명도·높이)만 넘긴다.
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
 */
function EditableText({
  value,
  editing,
  ringClass,
  label,
  className,
  onCommit,
  onActivate,
}: {
  value: string;
  editing: boolean;
  ringClass: string;
  label: string;
  className: string;
  onCommit: (text: string) => void;
  onActivate?: () => void;
}) {
  return (
    <div
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
      className={`pointer-events-auto cursor-text rounded outline-none ${ringClass} ${className}`}
    >
      {value}
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
      // 인라인 style 1/4 — 초점은 0~1 연속값이라 자리를 Tailwind 클래스로 표현할 수 없다
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
      // 인라인 style 4/4 — split 사진 높이는 card.band(0~1 연속값) 라 클래스로 표현할 수 없다
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
            // 인라인 style 2/4 — 크롭 기준점. 출력 템플릿과 같은 objectPosition(focal) 을 쓴다
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
  onSelect,
  onPatch,
}: {
  card: CardDraft;
  photo: Photo | undefined;
  target: EditTarget;
  onSelect: (t: EditTarget) => void;
  onPatch: (patch: Partial<Omit<CardDraft, "id" | "photoId">>) => void;
}) {
  const copy = card.copy;

  // full-bleed 만 글이 가림막 위에 놓인다. 출력 템플릿의 `onPhoto` 와 같은 반전을 쓴다 —
  // 어두운 가림막 + 밝은 글. 반대로 두면 글 배경을 낮췄을 때 검정 글이 사진에 묻힌다.
  const onPhoto = card.layout === "full-bleed";
  const headingClass = `text-[26px] font-black leading-tight tracking-tight sm:text-[36px] ${
    onPhoto ? "text-surface" : ""
  }`;
  const bodyClass = `text-[16px] leading-relaxed sm:text-[18px] ${onPhoto ? "text-surface" : "text-ink-2"}`;
  // 버튼 문구는 늘 편집 가능하므로 선택 링 대신 포커스 링으로 지금 어디 있는지 알린다
  const actionClass = `self-start rounded-full px-4 py-2 text-[15px] font-bold focus:ring-2 focus:ring-offset-2 ${
    onPhoto
      ? "bg-surface text-ink focus:ring-surface focus:ring-offset-ink"
      : "bg-ink text-surface focus:ring-ink focus:ring-offset-surface"
  }`;

  // heading 은 다섯 역할 전부에 있어 유니온을 그대로 펼쳐도 된다.
  const commitHeading = (text: string) => onPatch({ copy: { ...copy, heading: text } });

  // body 는 problem·evidence·solution 에만 있다. 좁힌 **안쪽에서** 패치를 만들어야 유니온에
  // 없는 필드가 섞이지 않는다 — 바깥에서 `{ ...copy, body }` 를 만들면 hook·cta 에 body 가 생긴다.
  const bodyEdit =
    "body" in copy
      ? { value: copy.body, commit: (text: string) => onPatch({ copy: { ...copy, body: text } }) }
      : undefined;

  // 버튼 문구(cta 전용, 상한 40자)도 같은 방식으로 좁힌 안쪽에서 패치한다. 스키마가 마지막
  // 카드를 cta 로 강제하므로 모든 세트에 하나씩 있다 — 여기서 못 고치면 어디서도 못 고친다.
  const actionEdit =
    "action" in copy
      ? { value: copy.action, commit: (text: string) => onPatch({ copy: { ...copy, action: text } }) }
      : undefined;

  const textLayer = (containerClass: string, scrim?: number) => (
    <div className={containerClass}>
      {scrim !== undefined && (
        <span
          aria-hidden="true"
          // 인라인 style 3/4 — 글 배경 진하기는 card.scrim(0~1 연속값). 색 자체는 토큰 클래스에서 온다
          style={{ opacity: scrim }}
          className="absolute inset-0 bg-ink"
        />
      )}
      <div className="relative flex flex-col gap-3">
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
          />
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
          />
        )}
      </div>
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
    <div className="relative flex aspect-[4/5] h-[min(70vh,760px)] max-w-full flex-col overflow-hidden rounded-2xl border border-hair bg-surface">
      {card.layout === "full-bleed" && (
        <>
          {photoSurface("absolute inset-0")}
          {textLayer("pointer-events-none relative mt-auto p-7", card.scrim)}
        </>
      )}

      {card.layout === "split" && (
        <>
          {photoSurface("relative w-full flex-none", card.band)}
          {textLayer("pointer-events-none relative flex flex-1 flex-col p-7")}
        </>
      )}

      {card.layout === "text-only" &&
        textLayer("pointer-events-none relative flex flex-1 flex-col justify-center p-7")}
    </div>
  );
}
