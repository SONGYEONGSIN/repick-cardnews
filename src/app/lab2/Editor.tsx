"use client";

import { useState } from "react";
import { Highlighter, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LAYOUT_LABEL, type SampleCard } from "../lab/wb/data";

/**
 * 에디터 표면 — 툴바와 옆 패널.
 *
 * 설정을 세로로 쌓은 폼에서 **에디터 문법**으로 바꿨다. 편집 도구는 고칠 대상을 고르면
 * 그것에 맞는 도구가 손 닿는 자리에 뜬다. 모든 컨트롤이 항상 다 보이지 않는다.
 *
 * - 글은 캔버스에서 직접 고친다 — 별도 입력칸으로 이동하지 않는다
 * - 서식은 **선택한 요소에 반응하는 툴바 한 줄**
 * - 초점은 슬라이더 둘이 아니라 **사진 위에서 끌어서** 잡는다 (컨트롤 두 개가 사라진다)
 * - 남는 것(레이아웃·사진 세부·카드)만 **탭**으로 접는다 — 스크롤 대신 전환
 */

export type Target = "heading" | "body" | "photo";

const TAB = ["레이아웃", "사진", "카드"] as const;
type Tab = (typeof TAB)[number];

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center rounded-lg border border-hair p-1">{children}</span>;
}

function ToolOption({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`h-9 rounded px-3 text-[14px] font-bold leading-9 ${on ? "bg-ink text-surface" : "text-ink-2"}`}
    >
      {label}
    </span>
  );
}

function ToolButton({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
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

/** 선택한 요소에 반응하는 한 줄 툴바. 캔버스 바로 위에 붙는다. */
export function Toolbar({ target, card }: { target: Target; card: SampleCard }) {
  const len = target === "heading" ? card.heading.length : (card.body?.length ?? 0);
  const max = target === "heading" ? 40 : 120;

  return (
    <div className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-hair px-3 py-2.5">
      <span className="flex h-11 items-center rounded-lg bg-hair-soft px-3 text-[14px] font-bold">
        {target === "heading" ? "헤드라인" : target === "body" ? "본문" : "사진"}
      </span>

      {target === "photo" ? (
        <>
          <span className="text-[14px] text-ink-2">사진 위를 끌어 초점을 옮겨요</span>
          <span className="ml-auto flex items-center gap-2">
            <ToolButton muted>
              <ImageIcon size={15} aria-hidden="true" />
              사진 바꾸기
            </ToolButton>
          </span>
        </>
      ) : (
        <>
          <ToolGroup>
            <ToolOption label="작게" on={false} />
            <ToolOption label="보통" on />
            <ToolOption label="크게" on={false} />
          </ToolGroup>

          <ToolGroup>
            <ToolOption label="왼쪽" on />
            <ToolOption label="가운데" on={false} />
          </ToolGroup>

          {target === "heading" && (
            <ToolButton>
              <Highlighter size={15} aria-hidden="true" />
              형광
            </ToolButton>
          )}

          <span className="ml-auto flex items-center gap-3">
            {target === "heading" && (
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] text-ink-2">강조</span>
                <span className="rounded bg-ink px-2 py-1 text-[13px] font-bold text-surface">손해</span>
              </span>
            )}
            <span className="text-[13px] font-bold tabular-nums text-ink-2">
              {len}/{max}
            </span>
          </span>
        </>
      )}
    </div>
  );
}

/** 옆 패널 — 탭 셋. 세로로 쌓지 않고 전환한다. */
export function SidePanel({ card }: { card: SampleCard }) {
  const [tab, setTab] = useState<Tab>("레이아웃");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-hair p-1" role="tablist" aria-label="편집 패널">
        {TAB.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            className={`h-10 flex-1 rounded text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
              t === tab ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "레이아웃" && (
        <div className="flex flex-col gap-5">
          <Field label="구성">
            <Row>
              {(["full-bleed", "split", "text-only"] as const).map((l) => (
                <ToolOption key={l} label={LAYOUT_LABEL[l]} on={l === card.layout} />
              ))}
            </Row>
          </Field>
          <Field label="글 위치">
            <Row>
              {["위", "가운데", "아래"].map((p, i) => (
                <ToolOption key={p} label={p} on={i === 2} />
              ))}
            </Row>
          </Field>
        </div>
      )}

      {tab === "사진" && (
        <div className="flex flex-col gap-5">
          <Slider label="배율" value={100} unit="%" />
          {card.layout === "full-bleed" && <Slider label="글 배경" value={70} />}
          {card.layout === "split" && <Slider label="사진 높이" value={42} />}
          <p className="text-[13px] leading-relaxed text-ink-2">
            초점은 캔버스에서 사진을 끌어 옮겨요. 여기서는 배율과 글 배경만 다뤄요.
          </p>
        </div>
      )}

      {tab === "카드" && (
        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <dt className="text-[14px] text-ink-2">역할</dt>
              <dd className="text-[15px] font-bold">{card.roleLabel}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-[14px] text-ink-2">파일</dt>
              <dd className="text-[15px] font-bold tabular-nums">2.png</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 border-t border-hair pt-4">
            <ToolButton>
              <RefreshCw size={15} aria-hidden="true" />
              이 카드 카피 다시 쓰기
            </ToolButton>
            <ToolButton muted>
              <Trash2 size={15} aria-hidden="true" />
              이 카드 빼기
            </ToolButton>
            <p className="text-[13px] leading-relaxed text-ink-2">
              다시 쓰면 손으로 고친 내용이 사라져요. 되돌리기로 복구할 수 있어요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-bold text-ink-2">{label}</p>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex rounded-lg border border-hair p-1">{children}</div>;
}

function Slider({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-[76px] flex-none text-[14px] text-ink-2">{label}</span>
      <input type="range" min={0} max={100} defaultValue={value} className={`h-1 w-full accent-ink ${FOCUS_RING}`} />
      <span className="w-12 flex-none text-right text-[13px] tabular-nums text-ink-2">
        {value}
        {unit}
      </span>
    </label>
  );
}
