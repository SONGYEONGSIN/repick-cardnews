"use client";

import { Move } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import type { Photo } from "@/lib/photos";
import type { Focal } from "@/templates/layout-utils";
import type { CardDraft } from "../reducer";
import type { EditTarget } from "./EditToolbar";

/**
 * 캔버스 — 카드 자체가 편집 표면이다.
 *
 * 글은 별도 입력칸이 아니라 **여기서 직접** 고친다(선택하면 그 자리가 편집 가능해진다).
 * 사진을 고르면 초점 핸들이 뜨고 끌어서 옮긴다 — 가로·세로 슬라이더 두 개가 사라진다.
 *
 * 겹치는 영역을 각각 고르게 하려면 버튼을 중첩할 수 없다(HTML 규칙). 그래서 사진은 절대배치
 * 버튼으로 뒤에 깔고, 글 블록은 그 위에 `pointer-events` 를 되살린 층으로 얹는다.
 *
 * 이 캔버스는 **편집 표면이지 최종 렌더가 아니다.** 실제 출력은 `src/templates` 가 1080×1350
 * 으로 그린다. 여기서는 글 배경 진하기(`scrim`)와 사진 높이(`band`) 를 고정 비율로 잡아 둔다 —
 * 연속값을 화면에 반영하려면 인라인 style 이 하나 더 필요한데, 그 예외는 초점 핸들 한 곳에만
 * 쓴다(아래 주석 참고).
 */

function ring(on: boolean) {
  return on ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "";
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function EditableText({
  value,
  target,
  current,
  onSelect,
  onCommit,
  label,
  className,
}: {
  value: string;
  target: EditTarget;
  current: EditTarget;
  onSelect: (t: EditTarget) => void;
  onCommit: (text: string) => void;
  label: string;
  className: string;
}) {
  const on = current === target;
  return (
    <div
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      tabIndex={0}
      contentEditable={on}
      suppressContentEditableWarning
      onClick={() => onSelect(target)}
      onFocus={() => onSelect(target)}
      // 편집 중에는 DOM 이 진실이다. 빠져나갈 때 한 번만 상태로 올린다 —
      // 글자마다 올리면 카드 전체가 다시 그려져 커서가 튄다.
      onBlur={(e) => onCommit(e.currentTarget.textContent ?? "")}
      className={`pointer-events-auto cursor-text rounded outline-none ${ring(on)} ${className}`}
    >
      {value}
    </div>
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
  className,
  onSelect,
  onFocal,
}: {
  photo: Photo | undefined;
  focal: Focal;
  on: boolean;
  className: string;
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
      className={`${className} overflow-hidden bg-hair-soft ${FOCUS_RING} ${on ? "cursor-move touch-none" : "cursor-pointer"}`}
    >
      {/* 로컬 blob/dataURL 프리뷰 — next/image 는 이 URL 을 최적화할 수 없다.
          draggable={false} 가 없으면 브라우저의 이미지 끌어놓기가 먼저 발동해 초점 드래그가
          pointercancel 로 끊긴다 — 포인터 캡처는 네이티브 드래그를 막지 못한다. */}
      {photo && (
        <img src={photo.thumbUrl} alt={photo.name} draggable={false} className="h-full w-full object-cover" />
      )}
      {on && (
        <span
          // 초점은 0~1 연속값이라 자리를 Tailwind 클래스로 표현할 수 없다 — 인라인 style 예외.
          // (dnd-kit transform 을 같은 이유로 인라인으로 두는 SortableSlot.tsx 와 같은 선례)
          style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
          className="pointer-events-none absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-surface"
        >
          <Move size={17} aria-hidden="true" />
        </span>
      )}
    </button>
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
  onPatch: (patch: Partial<Omit<CardDraft, "id">>) => void;
}) {
  const copy = card.copy;
  const headingClass = "text-[26px] font-black leading-tight tracking-tight sm:text-[36px]";
  const bodyClass = "text-[16px] leading-relaxed text-ink-2 sm:text-[18px]";

  // heading 은 다섯 역할 전부에 있어 유니온을 그대로 펼쳐도 된다.
  const commitHeading = (text: string) => onPatch({ copy: { ...copy, heading: text } });

  // body 는 problem·evidence·solution 에만 있다. 좁힌 **안쪽에서** 패치를 만들어야 유니온에
  // 없는 필드가 섞이지 않는다 — 바깥에서 `{ ...copy, body }` 를 만들면 hook·cta 에 body 가 생긴다.
  const bodyEdit =
    "body" in copy
      ? { value: copy.body, commit: (text: string) => onPatch({ copy: { ...copy, body: text } }) }
      : undefined;

  // 버튼 문구는 cta 에만 있다. 캔버스에서는 읽기 전용으로 보여 준다 — 편집 대상 네 가지에
  // 자리가 없다(툴바 `EditTarget` 참고).
  const action = copy.role === "cta" ? copy.action : undefined;

  const textLayer = (containerClass: string) => (
    <div className={containerClass}>
      <EditableText
        // 값을 key 에 넣어 카피가 밖에서 바뀌면(다시 만들기 등) 새로 마운트한다 —
        // contentEditable 은 값이 DOM 에 남아 갱신되지 않는다. 편집 중에는 value 가 그대로라
        // key 도 그대로다(타이핑 도중 마운트가 끊기지 않는다).
        key={`${card.id}-heading-${copy.heading}`}
        value={copy.heading}
        target="heading"
        current={target}
        onSelect={onSelect}
        onCommit={commitHeading}
        label="헤드라인"
        className={headingClass}
      />
      {bodyEdit && (
        <EditableText
          key={`${card.id}-body-${bodyEdit.value}`}
          value={bodyEdit.value}
          target="body"
          current={target}
          onSelect={onSelect}
          onCommit={bodyEdit.commit}
          label="본문"
          className={bodyClass}
        />
      )}
      {action && (
        <span className="pointer-events-none self-start rounded-full bg-ink px-4 py-2 text-[15px] font-bold text-surface">
          {action}
        </span>
      )}
    </div>
  );

  const photoSurface = (className: string) => (
    <PhotoSurface
      photo={photo}
      focal={card.focal}
      on={target === "photo"}
      className={className}
      onSelect={() => onSelect("photo")}
      onFocal={(focal) => onPatch({ focal })}
    />
  );

  return (
    <div className="relative flex aspect-[4/5] h-[min(70vh,760px)] max-w-full flex-col overflow-hidden rounded-2xl border border-hair bg-surface">
      {card.layout === "full-bleed" && (
        <>
          {photoSurface("absolute inset-0")}
          {/* bg-surface/85 는 `card.scrim` 의 고정 대역이다 — 실제 진하기는 출력 템플릿이 적용한다 */}
          {textLayer("pointer-events-none relative mt-auto flex flex-col gap-3 bg-surface/85 p-7")}
        </>
      )}

      {card.layout === "split" && (
        <>
          {/* h-[45%] 는 `card.band` 기본값의 고정 대역 — 위 파일 주석 참고 */}
          {photoSurface("relative block h-[45%] w-full")}
          {textLayer("pointer-events-none flex flex-1 flex-col gap-3 p-7")}
        </>
      )}

      {card.layout === "text-only" && textLayer("pointer-events-none flex flex-1 flex-col justify-center gap-3 p-7")}
    </div>
  );
}
