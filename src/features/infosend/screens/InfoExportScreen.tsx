"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, Check, CircleAlert, RotateCcw } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { CardRenderer } from "@/templates/CardRenderer";
import { THEMES } from "@/templates/themes";
import { outputDir } from "@/lib/paths";
import { mmdd } from "@/features/studio/useGenerate";
import { inKorean } from "@/features/cardnews/screens/errors";
import { FileSavePanel } from "@/features/cardnews/screens/FileSavePanel";
import { SharePanel, type ShareResult } from "@/features/cardnews/screens/SharePanel";
import { InstagramPublishPanel } from "@/features/cardnews/screens/InstagramPublishPanel";
import { toRenderCard } from "../render";
import { captionSourceLines, type InfoAction, type InfoState } from "../reducer";

/**
 * 화면 3 — 내보내기. **카드뉴스 `ExportScreen` 과 같은 구조**다: 미리보기 → 내보내는 방법 셋 중
 * 하나 고르기. 패널 세 개(`FileSavePanel`·`SharePanel`·`InstagramPublishPanel`)를 그대로
 * 재사용한다 — 이미지 배열에만 기대는 부품이라 1장짜리도 똑같이 받는다.
 *
 * **인스타는 한 장 경로로 나간다.** Graph API 는 2장 미만 캐러셀을 거부하므로, 서버가 장수를
 * 보고 갈라 준다(`publishKindFor` — `/api/publish` 와 예약 실행기가 같은 판정을 쓴다).
 * 화면은 그 갈림을 몰라도 된다.
 */

type ExportMethod = "file" | "phone" | "instagram";

const EXPORT_METHODS: readonly { id: ExportMethod; label: string; note: string }[] = [
  { id: "file", label: "파일로 저장", note: "이 컴퓨터 안에만 남아요" },
  { id: "phone", label: "폰으로 보내기", note: "같은 와이파이 안에서만 오가요" },
  { id: "instagram", label: "인스타그램에 올리기", note: "사진이 인터넷으로 나가요" },
];

export function InfoExportScreen({
  state,
  dispatch,
  onPrev,
  onDownload,
  onSave,
  onCaptureImages,
}: {
  state: InfoState;
  dispatch: Dispatch<InfoAction>;
  onPrev: () => void;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
  onCaptureImages: (count: number) => Promise<string[]>;
}) {
  // 이 화면을 보는 동안의 확인 표시들 — 저장할 값이 아니라 reducer 에 넣지 않는다.
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  const [share, setShare] = useState<ShareResult | null>(null);
  const [published, setPublished] = useState(false);
  const [publishToken, setPublishToken] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [method, setMethod] = useState<ExportMethod>("file");

  const card = toRenderCard(state);
  const dir = outputDir("informationsend", state.keyword, mmdd());

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
    } catch (e) {
      dispatch({
        type: "SET_ERROR",
        error: inKorean(e instanceof Error ? e.message : "", "내보내기에 실패했어요. 잠시 뒤 다시 시도해 주세요."),
      });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  function requestShare() {
    void run(async () => {
      const images = await onCaptureImages(1);
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: state.keyword, images }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "폰으로 보내지 못했어요");
      }
      setShare({ link: data.link, expiresAt: data.expiresAt });
    });
  }

  // 캡처 → `/api/share`(토큰 발급) → `/api/publish`. 카드뉴스와 **같은 순서·같은 요청**이다 —
  // 장수에 따른 갈림은 서버가 한다.
  async function publishToInstagram(caption: string, hashtags: string[]) {
    await run(async () => {
      const images = await onCaptureImages(1);
      const shareRes = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: state.keyword, images }),
      });
      const shareData = await shareRes.json();
      if (!shareRes.ok) {
        throw new Error(typeof shareData.error === "string" ? shareData.error : "공유 링크를 만들지 못했어요");
      }

      setPublishToken(shareData.token);
      try {
        const publishRes = await fetch("/api/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: shareData.token, caption, hashtags }),
        });
        const publishData = await publishRes.json();
        if (!publishRes.ok) {
          throw new Error(typeof publishData.error === "string" ? publishData.error : "인스타그램 게시에 실패했어요");
        }
        setPublished(true);
      } finally {
        setPublishToken(null);
      }
    });
  }

  return (
    <StudioFrame
      step={2}
      title={state.keyword}
      summary={[
        { label: "형태", value: "정보전달 1장" },
        { label: "테마", value: THEMES[state.themeId].label },
        { label: "크기", value: "1080 × 1350 PNG" },
        { label: "저장 위치", value: dir },
      ]}
      action={
        <>
          {/* 되돌릴 수 없는 조작은 헤더에 둔다(docs/ui-standards.md §4). */}
          {resetConfirm ? (
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] font-bold">지금까지 만든 내용이 모두 사라져요.</span>
              <LineButton disabled={state.busy} onClick={() => setResetConfirm(false)}>
                취소
              </LineButton>
              <SolidButton disabled={state.busy} onClick={() => dispatch({ type: "RESET" })}>
                처음부터 다시
              </SolidButton>
            </span>
          ) : (
            <LineButton disabled={state.busy} onClick={() => setResetConfirm(true)}>
              <RotateCcw size={15} aria-hidden="true" />
              처음부터 다시
            </LineButton>
          )}
          <LineButton disabled={state.busy} onClick={onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            만들기로 돌아가기
          </LineButton>
        </>
      }
    >
      <div className="flex flex-col gap-9 px-5 py-8 sm:px-8 lg:gap-10 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-3">
          <h2 className="text-balance text-[30px] font-black leading-[1.08] tracking-tight sm:text-[36px] lg:text-[44px]">
            이대로 내보낼까요
          </h2>
          <p className="max-w-[46rem] text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
            한 장으로 나가요. 인스타에 올릴 때 그대로 보이는 크기예요.
          </p>
          {state.busy && (
            <p role="status" className="text-[14px] text-ink-2">
              내보내는 중이에요. 잠시만 기다려 주세요.
            </p>
          )}
        </div>

        {state.error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface">
            <CircleAlert size={16} aria-hidden="true" className="flex-none" />
            {state.error}
          </p>
        )}

        <section className="flex flex-col gap-4">
          <SectionHead title="미리보기" aside="인스타에 올라가는 그대로예요" />
          {card ? (
            /* 순수 시각 미리보기 — 제목·항목은 아래 '저장될 파일'에 텍스트로 이미 있다. */
            <div className="overflow-hidden rounded-xl border border-hair bg-surface" style={{ width: 270 }} aria-hidden="true">
              <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                <span className="block origin-top-left scale-[0.25]">
                  <CardRenderer card={card} themeId={state.themeId} handle={state.handle} />
                </span>
              </span>
            </div>
          ) : (
            <p className="text-[14px] text-ink-2">먼저 카피를 만들어 주세요.</p>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-bold">내보내는 방법</h2>
            <p className="text-[13px] text-ink-2">하나를 골라요. 사진이 어디까지 나가는지는 방법마다 달라요.</p>
          </div>

          <div role="group" aria-label="내보내는 방법" className="flex flex-wrap gap-3">
            {EXPORT_METHODS.map((m) => {
              const on = m.id === method;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMethod(m.id)}
                  className={`flex min-w-[200px] flex-1 flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors duration-200 ${
                    on ? "border-ink" : "border-hair hover:border-ink-3"
                  } ${FOCUS_RING} motion-reduce:transition-none`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[17px] font-black tracking-tight">{m.label}</span>
                    {on && <span className="rounded bg-ink px-2 py-0.5 text-[12px] font-bold text-surface">선택</span>}
                  </span>
                  <span className="text-[13px] text-ink-2">{m.note}</span>
                </button>
              );
            })}
          </div>

          {/* 나란한 박스는 아래가 맞아야 한다 — `items-start` 를 쓰지 않고 박스가 칸 높이를
              채운다(docs/ui-standards.md §3). */}
          {method === "file" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <FileSavePanel
                busy={state.busy || !card}
                dir={dir}
                saved={saved}
                onDownload={() => void run(onDownload)}
                onSave={() =>
                  void run(async () => {
                    const res = await onSave();
                    setSaved({ dir: res.dir, count: res.paths.length });
                  })
                }
              />
              <div className="flex h-full flex-col gap-4">
                <SectionHead title="저장될 파일" />
                <div className="flex flex-1 flex-col gap-4 rounded-xl border border-hair p-6">
                  <p className="text-[17px] font-bold tracking-tight">{dir}/</p>
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-center gap-2.5 text-[14px] text-ink-2">
                      <Check size={14} aria-hidden="true" className="flex-none" />
                      <span className="tabular-nums">1.png</span>
                      <span className="text-ink-3">·</span>
                      <span className="truncate">{state.spec?.title ?? state.keyword}</span>
                    </li>
                  </ul>
                  <p className="border-t border-hair pt-4 text-[14px] leading-relaxed text-ink-2">
                    같은 주제로 오늘 다시 저장하면 이 폴더를 덮어써요. 이전 회차를 남기려면 폴더 이름을 바꿔 주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {method === "phone" && <SharePanel share={share} busy={state.busy || !card} onRequest={requestShare} />}

          {method === "instagram" && (
            <InstagramPublishPanel
              busy={state.busy || !card}
              published={published}
              onPublish={publishToInstagram}
              token={publishToken}
              imageCount={1}
              keyword={state.keyword}
              headings={captionSourceLines(state)}
              onCaptureImages={onCaptureImages}
            />
          )}
        </section>
      </div>
    </StudioFrame>
  );
}
