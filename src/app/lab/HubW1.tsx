import Link from "next/link";
import { Images, LayoutTemplate, Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { PageHead, Shell, StatStrip } from "./Shell";

/**
 * W1 — 콘솔형. Palisade(r11 승자)의 문법을 직역했다.
 *
 * 셸 + 헤더 인라인 통계 + 본문 카드 + 우측 활동 레일. 지금 허브의 "선택지 2개가 빈 화면에
 * 떠 있는" 문제를 정보 밀도로 푼다 — 작업물이 0개여도 화면이 성립하도록, 무엇을 만들 수
 * 있는지와 그것이 어디에 저장되는지를 본문이 설명한다.
 */

function StartCard({
  href,
  icon,
  title,
  description,
  steps,
  outputPath,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  steps: readonly string[];
  outputPath: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-xl border border-hair bg-surface p-4 transition-colors duration-200 hover:border-plum ${FOCUS_RING} motion-reduce:transition-none`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-plum-soft text-plum">
          {icon}
        </span>
        <span className="text-[15px] font-semibold tracking-tight">{title}</span>
        <span className="ml-auto flex h-7 items-center gap-1.5 rounded-lg bg-hair-soft px-2.5 text-[13px] font-semibold text-ink-2 transition-colors duration-200 group-hover:bg-plum group-hover:text-white motion-reduce:transition-none">
          <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
          시작
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink-2">{description}</p>

      {/* 단계를 숨기지 않고 그대로 보여 준다 — 참고한 후보들의 "값은 hover 없이 항상 보인다" 원칙 */}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-3" aria-hidden="true">·</span>}
            <span className="text-[13px] text-ink-2">
              <span className="tabular-nums text-ink-3">{i + 1}</span> {s}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-auto border-t border-hair-soft pt-3 text-[13px] text-ink-2">
        저장 위치 <span className="font-semibold text-ink">{outputPath}</span>
      </p>
    </Link>
  );
}

export function HubW1() {
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
      <PageHead
        title="작업물"
        meta="로컬 저장 · 카드뉴스 5단계 · 정보전달 4단계"
        right={
          <StatStrip
            items={[
              { label: "만든 세트", value: "0" },
              { label: "카드 장수", value: "0" },
              { label: "이번 달", value: "0" },
            ]}
          />
        }
      />

      <div className="grid gap-5 px-6 pb-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between border-b border-hair pb-2">
            <h2 className="text-[13px] font-semibold">무엇을 만들까요</h2>
            <span className="text-[13px] text-ink-2">둘 다 사진 폴더에서 시작해요</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <StartCard
              href="/cardnews"
              icon={<Images size={16} aria-hidden="true" />}
              title="카드뉴스"
              description="사진 5~6장으로 넘겨 보는 설득 시퀀스를 만들어요."
              steps={["주제", "사진", "순서", "편집", "내보내기"]}
              outputPath="cardnews/"
            />
            <StartCard
              href="/info"
              icon={<LayoutTemplate size={16} aria-hidden="true" />}
              title="정보전달"
              description="사진 1장에 정보를 얹은 인포그래픽 한 장을 만들어요."
              steps={["주제", "사진", "편집", "내보내기"]}
              outputPath="informationsend/"
            />
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <div className="flex items-baseline justify-between border-b border-hair pb-2">
              <h2 className="text-[13px] font-semibold">만든 것</h2>
              <span className="text-[13px] tabular-nums text-ink-2">0개</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-hair px-4 py-6">
              <div className="flex items-end gap-2" aria-hidden="true">
                <div className="h-10 w-8 rounded border border-hair bg-surface" />
                <div className="h-12 w-8 rounded border border-hair bg-surface" />
                <div className="h-10 w-8 rounded border border-hair bg-surface" />
              </div>
              <p className="text-sm leading-relaxed text-ink-2">
                아직 만든 게 없어요. 위에서 하나 골라 시작하면 완성된 세트가 여기 쌓여요.
              </p>
            </div>
          </div>
        </section>

        {/* 우측 레일 — Palisade 의 Recent changes 자리. 로컬 도구라 '무슨 일이 일어나는지' 설명으로 채운다. */}
        <aside className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between border-b border-hair pb-2">
            <h2 className="text-[13px] font-semibold">어떻게 동작해요</h2>
          </div>
          <ol className="flex flex-col gap-3">
            {[
              ["사진 폴더를 올려요", "폴더째 끌어다 놓으면 순서까지 읽어요."],
              ["카피를 생성해요", "브랜드 보이스를 지켜 로컬 Claude 가 씁니다."],
              ["카드로 뽑아요", "PNG 로 저장되고 원장에 기록돼요."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-2.5">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-hair-soft text-[11px] font-semibold tabular-nums text-ink-2">
                  {i + 1}
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-2">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </Shell>
  );
}
