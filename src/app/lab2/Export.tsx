"use client";

import { Check, Download, FolderOpen } from "lucide-react";
import { Frame, LineButton, SectionHead, SolidButton } from "./Frame";
import { SAMPLE_CARDS, TONE_CLASS } from "../lab/wb/data";

/**
 * 화면 3 — 내보내기.
 *
 * 기존 ExportStep 은 저장 버튼과 파일 목록이 전부였다. 여기서는 **저장 직전에 다섯 장이
 * 한 덩어리로 읽히는지 마지막으로 확인**하는 자리로 성격을 바꿨다 — 카드뉴스는 장마다
 * 예쁜 것보다 세트로 읽히는 게 중요한데, 지금 흐름에는 그걸 보는 자리가 없다.
 *
 * 그래서 이 화면의 주인공은 저장 버튼이 아니라 가로로 이어 놓은 다섯 장이다.
 */

export function Export() {
  return (
    <Frame
      step={2}
      title="에어컨 전기세"
      summary={[
        { label: "형태", value: "카드뉴스 5장" },
        { label: "크기", value: "1080 × 1350 PNG" },
        { label: "저장 위치", value: "cardnews/에어컨-전기세-0801" },
      ]}
      action={
        <>
          <LineButton>
            <FolderOpen size={15} aria-hidden="true" />
            폴더 열기
          </LineButton>
          <SolidButton>
            <Download size={16} aria-hidden="true" />
            5장 저장
          </SolidButton>
        </>
      }
    >
      <div className="flex flex-col gap-10 px-10 py-12">
        <div className="flex flex-col gap-3">
          <h2 className="text-[44px] font-black leading-[1.06] tracking-tight">이대로 저장할까요</h2>
          <p className="max-w-[54ch] text-[17px] leading-relaxed text-ink-2">
            넘겨 보는 순서대로 늘어놓았어요. 한 덩어리로 읽히는지 마지막으로 확인해 보세요.
          </p>
        </div>

        <section className="flex flex-col gap-4">
          <SectionHead title="다섯 장 이어 보기" aside="인스타에서 넘어가는 순서 그대로예요" />
          <ol className="flex gap-4 overflow-x-auto pb-3">
            {SAMPLE_CARDS.map((c, i) => (
              <li key={c.id} className="flex w-[248px] flex-none flex-col gap-2.5">
                <div className="flex aspect-[4/5] w-full flex-col overflow-hidden rounded-xl border border-hair bg-surface">
                  {c.layout === "split" && <span className={`block h-[42%] w-full ${TONE_CLASS[c.tone]}`} />}
                  {c.layout === "full-bleed" && (
                    <span className={`relative flex flex-1 flex-col justify-end ${TONE_CLASS[c.tone]}`}>
                      <span className="flex flex-col gap-1.5 bg-surface/85 p-3.5">
                        <span className="text-[16px] font-black leading-tight tracking-tight">{c.heading}</span>
                        {c.action && (
                          <span className="self-start rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-surface">
                            {c.action}
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                  {c.layout !== "full-bleed" && (
                    <span
                      className={`flex flex-1 flex-col gap-2 p-3.5 ${c.layout === "text-only" ? "justify-center" : ""}`}
                    >
                      <span className="text-[16px] font-black leading-tight tracking-tight">{c.heading}</span>
                      {c.body && <span className="text-[13px] leading-relaxed text-ink-2">{c.body}</span>}
                    </span>
                  )}
                </div>
                <p className="flex items-baseline gap-2">
                  <span className="text-[13px] font-bold tabular-nums text-ink-2">{i + 1}</span>
                  <span className="text-[14px] font-bold">{c.roleLabel}</span>
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex max-w-[640px] flex-col gap-4">
          <SectionHead title="저장될 파일" />
          <div className="flex flex-col gap-4 rounded-xl border border-hair p-6">
            <p className="text-[17px] font-bold tracking-tight">cardnews/에어컨-전기세-0801/</p>
            <ul className="flex flex-col gap-2">
              {SAMPLE_CARDS.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2.5 text-[14px] text-ink-2">
                  <Check size={14} aria-hidden="true" className="flex-none" />
                  <span className="tabular-nums">{i + 1}.png</span>
                  <span className="text-ink-3">·</span>
                  <span className="truncate">{c.heading}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-hair pt-4 text-[14px] leading-relaxed text-ink-2">
              같은 주제로 오늘 다시 저장하면 이 폴더를 덮어써요. 이전 회차를 남기려면 폴더 이름을 바꿔 주세요.
            </p>
          </div>
        </section>
      </div>
    </Frame>
  );
}
