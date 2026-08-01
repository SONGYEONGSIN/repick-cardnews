"use client";

import { X } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LAYOUT_LABEL, type SampleCard } from "../lab/wb/data";

/**
 * 편집 인스펙터.
 *
 * 컨트롤을 평평하게 늘어놓지 않고 **글 / 레이아웃 / 사진** 세 덩어리로 나눴다. 지금
 * 인스펙터가 답답한 이유는 컨트롤이 적어서가 아니라 성격이 다른 것들이 한 줄로 이어져
 * 있어서다. 사진 조절과 헤드라인 수정은 다른 작업이다.
 *
 * **세트 단위 설정(테마·서체·핸들)은 여기 두지 않는다** — 카드마다 다르면 세트가 흩어진다.
 * 그건 화면 상단 세트 바에 둔다.
 */

const INPUT =
  "w-full rounded-lg border border-hair bg-surface px-3.5 py-3 text-[15px] transition-colors duration-200 focus:border-ink focus:outline-none motion-reduce:transition-none";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-hair pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-bold text-ink-2">{label}</p>
      <div className="inline-flex rounded-lg border border-hair p-1">
        {options.map((o) => (
          <span
            key={o.value}
            className={`h-10 rounded px-3.5 text-[14px] font-bold leading-10 ${
              o.value === value ? "bg-ink text-surface" : "text-ink-2"
            }`}
          >
            {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-[92px] flex-none text-[14px] text-ink-2">{label}</span>
      <input type="range" min={0} max={100} defaultValue={value} className={`h-1 w-full accent-ink ${FOCUS_RING}`} />
      <span className="w-12 flex-none text-right text-[13px] tabular-nums text-ink-2">
        {value}
        {unit}
      </span>
    </label>
  );
}

function Counter({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[13px] font-bold tabular-nums ${over ? "bg-ink text-surface" : "text-ink-2"}`}
    >
      {len}/{max}
    </span>
  );
}

export function Inspector({ card }: { card: SampleCard }) {
  // 하이라이트는 brand-voice.md 가 요구하는 요소인데 지금 도구에 지정 UI 가 없다.
  const highlights = card.role === "problem" ? ["손해"] : ["전기세"];

  return (
    <div className="flex flex-col gap-5">
      <Group title="글">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="hd" className="text-[14px] font-bold text-ink-2">
              헤드라인
            </label>
            <Counter len={card.heading.length} max={40} />
          </div>
          <textarea id="hd" rows={2} defaultValue={card.heading} className={INPUT} />
          <p className="text-[13px] text-ink-2">줄을 바꾸고 싶은 자리에서 Enter 를 누르면 그대로 렌더돼요.</p>
        </div>

        {/* brand-voice.md: "핵심 키워드 1~2개를 형광 하이라이트 대상으로 지정" */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-bold text-ink-2">형광 강조</p>
            <span className="text-[13px] text-ink-2">최대 2개</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {highlights.map((w) => (
              <span
                key={w}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-ink pl-3 pr-2 text-[14px] font-bold text-surface"
              >
                {w}
                <X size={13} aria-hidden="true" />
              </span>
            ))}
            <button
              type="button"
              className={`h-9 rounded-lg border border-dashed border-hair px-3 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
            >
              단어 추가
            </button>
          </div>
          <p className="text-[13px] text-ink-2">헤드라인 안의 단어를 골라요. 형광색은 테마가 정해요.</p>
        </div>

        {card.body !== undefined && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="bd" className="text-[14px] font-bold text-ink-2">
                본문
              </label>
              <Counter len={card.body.length} max={120} />
            </div>
            <textarea id="bd" rows={4} defaultValue={card.body} className={INPUT} />
          </div>
        )}

        <Segmented
          label="글자 크기"
          value="보통"
          options={[
            { value: "작게", label: "작게" },
            { value: "보통", label: "보통" },
            { value: "크게", label: "크게" },
          ]}
        />

        <Segmented
          label="정렬"
          value="왼쪽"
          options={[
            { value: "왼쪽", label: "왼쪽" },
            { value: "가운데", label: "가운데" },
          ]}
        />
      </Group>

      <Group title="레이아웃">
        <Segmented
          label="구성"
          value={card.layout}
          options={[
            { value: "full-bleed", label: LAYOUT_LABEL["full-bleed"] },
            { value: "split", label: LAYOUT_LABEL.split },
            { value: "text-only", label: LAYOUT_LABEL["text-only"] },
          ]}
        />
        <Segmented
          label="글 위치"
          value="아래"
          options={[
            { value: "위", label: "위" },
            { value: "가운데", label: "가운데" },
            { value: "아래", label: "아래" },
          ]}
        />
      </Group>

      {card.layout !== "text-only" && (
        <Group title="사진">
          <div className="flex flex-col gap-3.5">
            <Slider label="가로 초점" value={50} />
            <Slider label="세로 초점" value={40} />
            <Slider label="배율" value={100} unit="%" />
            {card.layout === "full-bleed" && <Slider label="글 배경" value={70} />}
            {card.layout === "split" && <Slider label="사진 높이" value={42} />}
          </div>
          <button
            type="button"
            className={`h-11 rounded-lg border border-hair text-[15px] font-bold transition-colors duration-200 hover:border-ink ${FOCUS_RING} motion-reduce:transition-none`}
          >
            다른 사진으로 바꾸기
          </button>
        </Group>
      )}

      <Group title="이 카드만">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`h-11 rounded-lg border border-hair text-[15px] font-bold transition-colors duration-200 hover:border-ink ${FOCUS_RING} motion-reduce:transition-none`}
          >
            카피 다시 생성
          </button>
          <p className="text-[13px] leading-relaxed text-ink-2">
            이 카드의 글만 다시 써요. 손으로 고친 내용은 사라지니 되돌리기로 복구할 수 있어요.
          </p>
        </div>
      </Group>
    </div>
  );
}
