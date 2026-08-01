"use client";

import { Highlighter, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LAYOUT_LABEL, type SampleCard } from "../lab/wb/data";

/**
 * 툴바 — 이 화면의 유일한 컨트롤 표면.
 *
 * 옆 패널을 없애고 전부 여기로 올렸다. 그래서 캔버스가 전체 폭을 쓴다 — 사진을 고치는
 * 도구에서 가장 넓어야 할 것은 사진이다.
 *
 * 왼쪽 **요소 선택기**(헤드라인·본문·사진·카드)가 축이다. 무엇을 고르느냐에 따라 그 옆이
 * 통째로 바뀐다. 캔버스를 눌러도 같이 바뀐다 — 두 입구가 같은 상태를 가리킨다.
 *
 * 모든 컨트롤을 항상 보여 주지 않는 게 요점이다. 지금 고치는 것에 필요한 것만 손 닿는
 * 자리에 둔다.
 */

export type Target = "heading" | "body" | "photo" | "card";

function Group({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center rounded-lg border border-hair p-1">{children}</span>;
}

function Opt({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`h-9 rounded px-3 text-[14px] font-bold leading-9 ${on ? "bg-ink text-surface" : "text-ink-2"}`}>
      {label}
    </span>
  );
}

function Btn({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <button
      type="button"
      className={`flex h-11 items-center gap-2 rounded-lg border border-hair px-3.5 text-[14px] font-bold transition-colors duration-200 hover:border-ink ${FOCUS_RING} motion-reduce:transition-none ${
        muted ? "text-ink-2" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Dial({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="flex-none text-[14px] text-ink-2">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        defaultValue={value}
        className={`h-1 w-[104px] flex-none accent-ink ${FOCUS_RING}`}
      />
      <span className="w-10 flex-none text-right text-[13px] tabular-nums text-ink-2">
        {value}
        {unit}
      </span>
    </label>
  );
}

function Divider() {
  return <span className="h-7 w-px flex-none bg-hair" aria-hidden="true" />;
}

export function Toolbar({
  target,
  onSelect,
  card,
}: {
  target: Target;
  onSelect: (t: Target) => void;
  card: SampleCard;
}) {
  const picks: { id: Target; label: string }[] = [
    { id: "heading", label: "헤드라인" },
    ...(card.body !== undefined ? [{ id: "body" as Target, label: "본문" }] : []),
    ...(card.layout !== "text-only" ? [{ id: "photo" as Target, label: "사진" }] : []),
    { id: "card", label: "카드" },
  ];

  const isText = target === "heading" || target === "body";
  const len = target === "heading" ? card.heading.length : (card.body?.length ?? 0);
  const max = target === "heading" ? 40 : 120;

  return (
    <div className="flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-hair px-3 py-2.5">
      <Group>
        {picks.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-pressed={target === p.id}
            className={`h-9 rounded px-3 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
              target === p.id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </Group>

      <Divider />

      {isText && (
        <>
          <Group>
            <Opt label="작게" on={false} />
            <Opt label="보통" on />
            <Opt label="크게" on={false} />
          </Group>
          <Group>
            <Opt label="왼쪽" on />
            <Opt label="가운데" on={false} />
          </Group>
          {target === "heading" && (
            <>
              <Btn>
                <Highlighter size={15} aria-hidden="true" />
                형광
              </Btn>
              <span className="flex items-center gap-1.5">
                <span className="rounded bg-ink px-2 py-1 text-[13px] font-bold text-surface">손해</span>
              </span>
            </>
          )}
          <span className="ml-auto text-[13px] font-bold tabular-nums text-ink-2">
            {len}/{max}
          </span>
        </>
      )}

      {target === "photo" && (
        <>
          <span className="text-[14px] text-ink-2">사진 위를 끌어 초점을 옮겨요</span>
          <Divider />
          <Dial label="배율" value={100} unit="%" />
          {card.layout === "full-bleed" && <Dial label="글 배경" value={70} />}
          {card.layout === "split" && <Dial label="사진 높이" value={42} />}
          <span className="ml-auto">
            <Btn muted>
              <ImageIcon size={15} aria-hidden="true" />
              사진 바꾸기
            </Btn>
          </span>
        </>
      )}

      {target === "card" && (
        <>
          <span className="flex items-center gap-2.5">
            <span className="text-[14px] text-ink-2">구성</span>
            <Group>
              {(["full-bleed", "split", "text-only"] as const).map((l) => (
                <Opt key={l} label={LAYOUT_LABEL[l]} on={l === card.layout} />
              ))}
            </Group>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="text-[14px] text-ink-2">글 위치</span>
            <Group>
              {["위", "가운데", "아래"].map((p, i) => (
                <Opt key={p} label={p} on={i === 2} />
              ))}
            </Group>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Btn>
              <RefreshCw size={15} aria-hidden="true" />
              다시 쓰기
            </Btn>
            <Btn muted>
              <Trash2 size={15} aria-hidden="true" />
              빼기
            </Btn>
          </span>
        </>
      )}
    </div>
  );
}
