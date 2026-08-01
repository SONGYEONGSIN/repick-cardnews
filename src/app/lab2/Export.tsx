"use client";

import { Check, Download, FolderOpen } from "lucide-react";
import { Frame, LineButton, SectionHead, SolidButton } from "./Frame";
import { SAMPLE_CARDS, TONE_CLASS } from "../lab/wb/data";

/**
 * 화면 3 — 내보내기.
 *
 * 기존 ExportStep 은 저장 버튼과 결과 목록이 전부였다. 여기서는 **저장 직전에 다섯 장이
 * 한 덩어리로 읽히는지 마지막으로 확인**하는 화면으로 성격을 바꿨다 — 카드뉴스는 장마다
 * 예쁜 것보다 세트로 읽히는 게 중요한데, 지금 흐름에는 그걸 보는 자리가 없다.
 */

export function Export() {
  return (
    <Frame
      step={2}
      context="에어컨 전기세 · 카드뉴스"
      action={
        <>
          <LineButton>
            <FolderOpen size={14} aria-hidden="true" />
            폴더 열기
          </LineButton>
          <SolidButton>
            <Download size={15} aria-hidden="true" />
            5장 저장
          </SolidButton>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-8 py-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-[36px] font-black leading-tight tracking-tight">이대로 저장할까요</h1>
          <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
            넘겨 보는 순서대로 늘어놓았어요. 한 덩어리로 읽히는지 마지막으로 확인해 보세요.
          </p>
        </div>

        {/* 세트 전체를 실제 순서대로 — 이 화면의 존재 이유 */}
        <section className="flex flex-col gap-3">
          <SectionHead title="다섯 장 이어 보기" aside="1080 × 1350 · PNG" />
          <ol className="flex gap-3 overflow-x-auto pb-2">
            {SAMPLE_CARDS.map((c, i) => (
              <li key={c.id} className="flex w-[188px] flex-none flex-col gap-2">
                <div className="flex aspect-[4/5] w-full flex-col overflow-hidden rounded-xl border border-hair bg-surface">
                  {c.layout === "split" && <span className={`block h-[42%] w-full ${TONE_CLASS[c.tone]}`} />}
                  {c.layout === "full-bleed" && (
                    <span className={`relative flex flex-1 flex-col justify-end ${TONE_CLASS[c.tone]}`}>
                      <span className="flex flex-col gap-1 bg-surface/85 p-2.5">
                        <span className="text-[12px] font-black leading-tight tracking-tight">{c.heading}</span>
                        {c.action && (
                          <span className="self-start rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-surface">
                            {c.action}
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                  {c.layout !== "full-bleed" && (
                    <span
                      className={`flex flex-1 flex-col gap-1.5 p-2.5 ${
                        c.layout === "text-only" ? "justify-center" : ""
                      }`}
                    >
                      <span className="text-[12px] font-black leading-tight tracking-tight">{c.heading}</span>
                      {c.body && <span className="text-[10px] leading-relaxed text-ink-2">{c.body}</span>}
                    </span>
                  )}
                </div>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold tabular-nums text-ink-2">{i + 1}</span>
                  <span className="text-[11px] font-bold">{c.roleLabel}</span>
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead title="저장 위치" />
          <div className="flex flex-col gap-3 rounded-xl border border-hair p-5">
            <p className="text-[15px] font-bold tracking-tight">cardnews/에어컨-전기세-0801/</p>
            <ul className="flex flex-col gap-1.5">
              {SAMPLE_CARDS.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2 text-[13px] text-ink-2">
                  <Check size={13} aria-hidden="true" className="flex-none" />
                  <span className="tabular-nums">{i + 1}.png</span>
                  <span className="text-ink-3">·</span>
                  <span className="truncate">{c.heading}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-hair-soft pt-3 text-[13px] leading-relaxed text-ink-2">
              같은 주제로 오늘 다시 저장하면 이 폴더를 덮어써요. 이전 회차를 남기려면 폴더 이름을 바꿔 주세요.
            </p>
          </div>
        </section>
      </div>
    </Frame>
  );
}
