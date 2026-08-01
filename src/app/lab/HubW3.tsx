import Link from "next/link";
import { Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { PageHead, Shell } from "./Shell";

/**
 * W3 — 히어로 스탯형. Cadence(r12 a)의 "KPI 4장 + 단일 지배 시각화" 골격이다.
 *
 * Cadence 는 14주×7일 배포 히트맵을 화면의 주인공으로 삼는다. 콘티에 대응시키면
 * "언제 얼마나 만들었나" — 인스타 콘텐츠는 꾸준함이 성과라 이 축이 의미가 있다.
 *
 * 정직하게 짚을 대가: **이 화면은 데이터가 쌓여야 성립한다.** 아래 히트맵은 결정론적
 * 샘플이고, 실제로는 처음 켠 사람에게 빈 격자가 보인다. 참고한 후보들도 전부 더미
 * 데이터로 심사받았지만, 그쪽은 심사용 화면이고 이건 실제 제품이다.
 */

const WEEKS = 12;
const DAYS = 7;

/** 결정론적 샘플 — Math.random 금지 규칙(캡처마다 결과가 달라지면 안 된다)을 지킨다. */
const SAMPLE = [0, 0, 1, 0, 2, 0, 0, 3, 1, 0, 0, 2, 4, 0, 1, 0, 0, 2, 0, 3, 0];
const countAt = (i: number) => SAMPLE[i % SAMPLE.length];

const LEVEL_CLASS = [
  "bg-hair-soft",
  "bg-plum/20",
  "bg-plum/40",
  "bg-plum/70",
  "bg-plum",
] as const;

function Sparkline({ points }: { points: readonly number[] }) {
  // SVG 좌표는 소수 2자리 — 하이드레이션 불일치 방지(참고 레포의 크래프트 규칙)
  const max = Math.max(...points, 1);
  const d = points
    .map((p, i) => {
      const x = ((i / (points.length - 1)) * 56).toFixed(2);
      const y = (20 - (p / max) * 18).toFixed(2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" fill="none" aria-hidden="true" className="flex-none">
      <path d={d} className="stroke-plum" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  unit,
  note,
  spark,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  spark: readonly number[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-hair bg-surface p-4">
      <p className="text-[11px] font-semibold text-ink-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="flex items-baseline gap-1">
          <span className="text-[26px] font-extrabold leading-none tabular-nums tracking-tight">{value}</span>
          {unit && <span className="text-[13px] text-ink-2">{unit}</span>}
        </p>
        <Sparkline points={spark} />
      </div>
      <p className="text-[13px] text-ink-2">{note}</p>
    </div>
  );
}

export function HubW3() {
  return (
    <Shell
      action={
        <Link
          href="/cardnews"
          className={`flex h-9 items-center gap-2 rounded-lg bg-plum px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-plum-hover active:bg-plum-active ${FOCUS_RING} motion-reduce:transition-none`}
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
          새로 만들기
        </Link>
      }
    >
      <PageHead title="제작 현황" meta="최근 12주 · 샘플 데이터" />

      <div className="flex flex-col gap-5 px-6 pb-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="주당 제작" value="2.4" unit="세트" note="지난 6주 대비 늘었어요" spark={[1, 2, 1, 3, 2, 4, 3]} />
          <KpiCard label="카드 장수" value="146" note="세트당 평균 5.2장" spark={[2, 3, 3, 4, 3, 5, 4]} />
          <KpiCard label="카드뉴스" value="21" unit="세트" note="전체의 72%" spark={[1, 1, 2, 2, 3, 3, 4]} />
          <KpiCard label="정보전달" value="8" unit="장" note="전체의 28%" spark={[0, 1, 1, 2, 1, 2, 2]} />
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-hair bg-surface p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-semibold tracking-tight">제작 달력</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">
              최근 12주 동안 하루에 몇 세트를 만들었는지예요. 칸마다 개수가 그대로 적혀 있어요.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-1.5">
              {Array.from({ length: WEEKS }, (_, w) => (
                <div key={w} className="flex flex-none flex-col gap-1.5">
                  {Array.from({ length: DAYS }, (_, d) => {
                    const n = countAt(w * DAYS + d);
                    return (
                      <span
                        key={d}
                        className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${
                          LEVEL_CLASS[n]
                        } ${n >= 3 ? "text-white" : "text-ink-2"}`}
                      >
                        {n > 0 ? n : ""}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair-soft pt-3">
            <span className="text-[11px] font-semibold text-ink-2">하루 제작 세트</span>
            <span className="flex items-center gap-1.5">
              {LEVEL_CLASS.map((c, i) => (
                <span key={c} className={`h-4 w-4 rounded ${c}`} aria-hidden="true" title={`${i}세트`} />
              ))}
              <span className="ml-1 text-[13px] text-ink-2">적음 → 많음</span>
            </span>
          </div>
        </section>

        <p className="rounded-xl border border-dashed border-hair px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          위 숫자는 화면 평가용 샘플이에요. 실제로는 처음 켰을 때 빈 격자가 보여요 — 이 시안을 고르면
          비어 있는 상태를 따로 설계해야 해요.
        </p>
      </div>
    </Shell>
  );
}
