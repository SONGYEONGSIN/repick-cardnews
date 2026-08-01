"use client";

import { useState } from "react";
import { Check, Copy, Download, FolderOpen, Link2, Send, Smartphone } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { Frame, LineButton, SectionHead, SolidButton } from "./Frame";
import { SAMPLE_CARDS, TONE_CLASS } from "../lab/wb/data";

/**
 * 화면 3 — 내보내기.
 *
 * 저장 버튼 하나였던 화면을 셋으로 나눴다 — **세트 확인 · 캡션 · 올리기**.
 *
 * 인스타 업로드에는 실제 제약이 있다. Instagram Graph API 는 로컬 파일을 직접 받지 않고
 * **공개 HTTPS URL** 을 요구한다(컨테이너 생성 → 캐러셀 묶음 → 게시). 즉 바로 올리려면
 * 사진이 어딘가에 공개로 올라가야 하는데, 이 도구는 "사진은 이 기기를 벗어나지 않아요"를
 * 약속하고 있다. 그래서 방법을 하나로 강요하지 않고 둘로 나눠 두고 대가를 화면에 적었다.
 */

const CAPTION = `에어컨 껐다 켰다 하면 오히려 손해예요.

재가동할 때 전력이 크게 들어서, 잠깐 나갈 땐 끄지 말고 온도만 높여두는 게 더 이득이에요. 설정 온도는 24~26도, 필터는 2주에 한 번. 이것만 지켜도 체감이 달라요.

저장해두고 이번 여름에 써먹어 보세요.`;

const TAGS = ["여름살림", "전기세절약", "에어컨관리", "자취팁", "살림꿀팁", "리픽"];

const METHODS = [
  {
    id: "account",
    icon: Link2,
    title: "계정 연결해서 바로 올리기",
    line: "예약 시각까지 정해서 여기서 게시해요.",
    caveat:
      "인스타 API 는 로컬 파일을 직접 받지 않아 사진이 임시 공개 주소를 거쳐요. 사진을 기기 밖으로 내보내지 않으려면 아래 방법을 쓰세요.",
    need: "비즈니스·크리에이터 계정 연결 필요",
  },
  {
    id: "phone",
    icon: Smartphone,
    title: "폰으로 보내서 올리기",
    line: "같은 와이파이에서 폰으로 받아 인스타 앱으로 올려요.",
    caveat: "사진이 기기와 집 안 네트워크를 벗어나지 않아요. 대신 올리는 건 폰에서 직접 해야 해요.",
    need: "같은 와이파이",
  },
] as const;

type MethodId = (typeof METHODS)[number]["id"];

export function Export() {
  const [method, setMethod] = useState<MethodId>("phone");
  const captionLen = CAPTION.length + TAGS.join(" #").length + 1;

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
      <div className="flex flex-col gap-9 px-5 py-8 sm:px-8 lg:gap-10 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-3">
          <h2 className="text-balance text-[30px] font-black leading-[1.08] tracking-tight sm:text-[36px] lg:text-[44px]">
            이대로 올릴까요
          </h2>
          <p className="max-w-[54ch] text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
            넘겨 보는 순서대로 늘어놓았어요. 한 덩어리로 읽히는지 마지막으로 확인해 보세요.
          </p>
        </div>

        <section className="flex flex-col gap-4">
          <SectionHead title="다섯 장 이어 보기" aside="인스타에서 넘어가는 순서 그대로예요" />
          <ol className="flex gap-4 overflow-x-auto pb-3">
            {SAMPLE_CARDS.map((c, i) => (
              <li key={c.id} className="flex w-[224px] flex-none flex-col gap-2.5">
                <div className="flex aspect-[4/5] w-full flex-col overflow-hidden rounded-xl border border-hair bg-surface">
                  {c.layout === "split" && <span className={`block h-[42%] w-full ${TONE_CLASS[c.tone]}`} />}
                  {c.layout === "full-bleed" && (
                    <span className={`relative flex flex-1 flex-col justify-end ${TONE_CLASS[c.tone]}`}>
                      <span className="flex flex-col gap-1.5 bg-surface/85 p-3.5">
                        <span className="text-[15px] font-black leading-tight tracking-tight">{c.heading}</span>
                      </span>
                    </span>
                  )}
                  {c.layout !== "full-bleed" && (
                    <span
                      className={`flex flex-1 flex-col gap-2 p-3.5 ${c.layout === "text-only" ? "justify-center" : ""}`}
                    >
                      <span className="text-[15px] font-black leading-tight tracking-tight">{c.heading}</span>
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

        <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* 캡션 — 카드 카피에서 뽑아 쓴다. 지금은 저장만 하고 캡션은 사람이 다시 쓰고 있다. */}
          <section className="flex flex-col gap-4">
            <SectionHead title="캡션" aside={<span className="tabular-nums">{captionLen}/2,200</span>} />

            <textarea
              rows={9}
              defaultValue={CAPTION}
              aria-label="인스타 캡션"
              className={`w-full rounded-xl border border-hair bg-surface p-4 text-[15px] leading-relaxed transition-colors duration-200 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`}
            />

            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[14px] font-bold text-ink-2">해시태그</p>
                <span className="text-[13px] text-ink-2">첫 댓글로 분리해서 올려요</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <span key={t} className="rounded-lg bg-hair-soft px-2.5 py-1.5 text-[14px] font-bold text-ink-2">
                    #{t}
                  </span>
                ))}
                <button
                  type="button"
                  className={`rounded-lg border border-dashed border-hair px-2.5 py-1.5 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink ${FOCUS_RING} motion-reduce:transition-none`}
                >
                  추가
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <LineButton>
                <Copy size={15} aria-hidden="true" />
                캡션 복사
              </LineButton>
              <LineButton>
                <Copy size={15} aria-hidden="true" />
                해시태그 복사
              </LineButton>
            </div>
          </section>

          {/* 올리기 */}
          <section className="flex flex-col gap-4">
            <SectionHead title="올리기" />

            <ul className="flex flex-col gap-2.5">
              {METHODS.map((m) => {
                const on = m.id === method;
                const Icon = m.icon;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setMethod(m.id)}
                      aria-pressed={on}
                      className={`flex w-full flex-col gap-2 rounded-xl border-2 p-4 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                        on ? "border-ink" : "border-hair hover:border-ink-3"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${
                            on ? "bg-ink text-surface" : "bg-hair-soft text-ink-2"
                          }`}
                        >
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <span className="text-[16px] font-bold tracking-tight">{m.title}</span>
                      </span>
                      <span className="text-[14px] leading-relaxed text-ink-2">{m.line}</span>
                      <span className="text-[13px] leading-relaxed text-ink-2">{m.caveat}</span>
                      <span className="rounded bg-hair-soft px-2 py-1 text-[13px] font-bold text-ink-2">{m.need}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {method === "account" ? (
              <div className="flex flex-col gap-3 rounded-xl border border-hair p-4">
                <p className="text-[14px] font-bold">연결된 계정 없음</p>
                <LineButton>
                  <Link2 size={15} aria-hidden="true" />
                  인스타 계정 연결
                </LineButton>
                <label className="flex flex-col gap-2">
                  <span className="text-[14px] font-bold text-ink-2">예약 시각</span>
                  <input
                    type="datetime-local"
                    className={`h-11 w-full rounded-lg border border-hair px-3 text-[15px] focus:border-ink focus:outline-none ${FOCUS_RING}`}
                  />
                </label>
                <SolidButton disabled>
                  <Send size={16} aria-hidden="true" />
                  게시하기
                </SolidButton>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-hair p-4">
                <p className="text-[14px] font-bold">폰에서 이 주소를 열어요</p>
                <p className="rounded-lg bg-hair-soft px-3 py-2.5 text-[15px] font-bold tabular-nums tracking-tight">
                  192.168.0.14:3500/보내기
                </p>
                <p className="text-[13px] leading-relaxed text-ink-2">
                  QR 로도 열 수 있어요. 폰에서 5장을 받아 인스타 앱에서 순서대로 올리면 돼요. 캡션은 위에서 복사해
                  가세요.
                </p>
              </div>
            )}
          </section>
        </div>

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
              <li className="flex items-center gap-2.5 text-[14px] text-ink-2">
                <Check size={14} aria-hidden="true" className="flex-none" />
                <span>caption.txt</span>
                <span className="text-ink-3">·</span>
                <span className="truncate">캡션과 해시태그</span>
              </li>
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
