"use client";

import { useState, type Dispatch } from "react";
import { ArrowLeft, Check, CircleAlert, RotateCcw } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { CardRenderer } from "@/templates/CardRenderer";
import { showAdBadge } from "@/templates/ad-badge";
import { outputDir } from "@/lib/paths";
import { mmdd } from "@/features/studio/useGenerate";
import { toRenderCards } from "../render";
import type { CardnewsAction, CardnewsState } from "../reducer";
import { inKorean } from "./errors";
import { FileSavePanel } from "./FileSavePanel";
import { SharePanel, type ShareResult } from "./SharePanel";
import { InstagramPublishPanel } from "./InstagramPublishPanel";

/**
 * 화면 3 — 내보내기. `src/app/lab2/Export.tsx` 시안에서 캡션·해시태그·인스타 올리기
 * 섹션(조각 2)을 걷어내고 "세트로 확인 → 저장"만 남겼다가, 실사용 피드백(2026-08-02)으로
 * 캡션·해시태그를 `InstagramPublishPanel`에 되돌리고 아래처럼 다시 정리했다.
 *
 * 미리보기는 `CardCanvas`(편집 표면)가 아니라 `CardRenderer` 로 실제 템플릿을 그려 축소한다
 * (옛 `steps/ExportStep.tsx` 와 같은 방식) — 테마가 반영된 진짜 결과라야 저장 직전
 * 확인이 의미가 있다. `handle` 은 빈 문자열로 고정한다 — 카드뉴스는 계정 핸들 워터마크를
 * 쓰지 않는다(그 prop 자체는 `CardRenderer`/`CardFrame` 공용이라 정보전달 플로우가 쓴다).
 *
 * **레이아웃**: `xl` 이상에서 두 칸이다. 왼쪽(미리보기 + 저장될 파일)은 `xl:flex-1` 로 남는
 * 폭을 전부 가져가고 상한을 두지 않는다 — `WorkbenchScreen` 의 오른쪽(카드) 칸과 같은
 * 역할이다. 오른쪽(내보내는 방법 세 갈래)은 `xl:basis-[38%]` 에 하한 380px·상한 480px 로
 * 못박는다 — `WorkbenchScreen` 의 왼쪽(레일) 칸과 같은 역할로, 안의 글이 너무 넓게 늘어나지
 * 않게 한다. 이 폭 규칙(최대 폭 상한도 `mx-auto` 도 두지 않는다)의 근거는 그 화면의 주석과
 * `fullwidth-report.md` 참고. 좁은 화면에서는 위아래로 쌓이고 DOM 순서가 그대로 읽기 순서다.
 *
 * **세 갈래**: `FileSavePanel`(파일로 저장) · `SharePanel`(폰으로 보내기) ·
 * `InstagramPublishPanel`(인스타그램에 올리기) 를 나란히 놓았다. 앞의 둘은 사진이 이
 * 컴퓨터(또는 같은 와이파이)를 벗어나지 않고, 인스타그램만 인터넷으로 나간다 — 각 패널의
 * `SectionHead aside` 문구가 그 경계를 말한다. 예전엔 앞의 둘의 트리거 버튼이
 * `StudioFrame` 헤더(action)에 있어 인스타그램 패널(본문에 자리한 자체 버튼)과 위계가
 * 어긋났다 — 지금은 셋 다 본문의 같은 형태 카드다. 헤더에는 "만들기로 돌아가기"만 남는다.
 * "처음부터 다시"(RESET)는 되돌릴 수 없는 조작이라 이 세 갈래보다 아래, 화면 맨 끝에 그대로
 * 둔다.
 */
/**
 * 내보내는 방법 — **고르는 것**이지 순서대로 하는 일 목록이 아니다. 셋을 한꺼번에 쌓아 두면
 * 그 구분이 사라지고, 각 방법의 세부(저장될 파일 목록 등)가 어느 방법에 딸린 것인지도 흐려진다.
 *
 * `note` 는 **사진이 어디까지 나가는가** 다 — 방법마다 다르고, 고르기 전에 알아야 한다.
 */
type ExportMethod = "file" | "phone" | "instagram";

const EXPORT_METHODS: readonly { id: ExportMethod; label: string; note: string }[] = [
  { id: "file", label: "파일로 저장", note: "이 컴퓨터 안에만 남아요" },
  { id: "phone", label: "폰으로 보내기", note: "같은 와이파이 안에서만 오가요" },
  { id: "instagram", label: "인스타그램에 올리기", note: "사진이 인터넷으로 나가요" },
];

export function ExportScreen({
  state,
  dispatch,
  onPrev,
  onDownload,
  onSave,
  onCaptureImages,
}: {
  state: CardnewsState;
  dispatch: Dispatch<CardnewsAction>;
  onPrev: () => void;
  onDownload: () => Promise<void>;
  onSave: () => Promise<{ dir: string; paths: string[] }>;
  onCaptureImages: (count: number) => Promise<string[]>;
}) {
  // 어디에 저장됐는지는 저장할 값이 아니라 이 화면을 보는 동안의 확인 표시다 — reducer 에 넣지 않는다.
  const [saved, setSaved] = useState<{ dir: string; count: number } | null>(null);
  // 폰으로 보내기 결과(QR·링크·만료)도 같은 이유로 지역 상태다. 아직 누르기 전에는 null.
  const [share, setShare] = useState<ShareResult | null>(null);
  // 인스타그램 게시 성공 표시 — `saved`와 같은 이유로 지역 상태다.
  const [published, setPublished] = useState(false);
  // `/api/publish` 를 실제로 부르는 동안에만 값이 있다 — `InstagramPublishPanel` 이 이 값이
  // 있을 때만 `/api/publish-progress` 를 몇 초 간격으로 물어본다. 요청이 끝나면(성공/실패)
  // 곧바로 null 로 되돌려 폴링을 멈춘다.
  const [publishToken, setPublishToken] = useState<string | null>(null);
  // 되돌릴 수 없는 조작이라 확인을 한 번 거친다 — 이 화면 안의 지역 상태로, window.confirm 은 쓰지 않는다.
  const [resetConfirm, setResetConfirm] = useState(false);
  // 어떤 방법으로 내보낼지. 셋을 한꺼번에 쌓아 두면 "고르는 것"이 아니라 "할 일 목록"으로
  // 읽히고, 각 방법의 세부(저장될 파일 목록 등)가 어느 방법 것인지도 흐려진다.
  const [method, setMethod] = useState<ExportMethod>("file");

  const rendered = toRenderCards(state);
  const dir = outputDir("cardnews", state.keyword, mmdd());

  async function run(fn: () => Promise<void>) {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      await fn();
    } catch (e) {
      // 캡처·다운로드·폴더 저장은 파일시스템/네트워크 API 라 영문 오류를 던질 수 있다.
      const message = inKorean(
        e instanceof Error ? e.message : "",
        "내보내기에 실패했어요. 잠시 뒤 다시 시도해 주세요."
      );
      dispatch({ type: "SET_ERROR", error: message });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  function downloadFiles() {
    void run(onDownload);
  }

  function saveFiles() {
    void run(async () => {
      const res = await onSave();
      setSaved({ dir: res.dir, count: res.paths.length });
    });
  }

  function requestShare() {
    void run(async () => {
      const images = await onCaptureImages(state.cards.length);
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

  // 캡처 → `/api/share`(토큰 발급) → `/api/publish`(인스타그램 캐러셀 게시) 순서. 해시태그는
  // 화면에서 5개 상한을 이미 지켰지만(`InstagramPublishPanel`), 캡션과 합치는 것 자체는
  // `/api/publish`가 한다(`@/lib/hashtags`) — 여기는 구조 그대로 넘기기만 한다.
  // `/api/publish` 는 실패 시 이미 한국어 메시지를 돌려주므로(`friendlyPublishError`), `run()`
  // 이 그 메시지를 그대로 `inKorean()`에 넣어도 한글이라 통과한다 — 영문으로 갈아 끼워지지 않는다.
  async function publishToInstagram(caption: string, hashtags: string[]) {
    await run(async () => {
      const images = await onCaptureImages(state.cards.length);
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
        { label: "형태", value: `카드뉴스 ${state.cards.length}장` },
        { label: "크기", value: "1080 × 1350 PNG" },
        { label: "저장 위치", value: dir },
      ]}
      action={
        <>
          {/* 되돌릴 수 없는 조작은 본문 맨 아래가 아니라 헤더에 둔다 — 만들고·고르고·내보내는
              본문 흐름과 섞이면 실수로 눌리기 쉽다(docs/ui-standards.md §4). 확인은 그 자리에서
              버튼이 바뀌는 방식이다 — window.confirm 은 쓰지 않는다. */}
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
            넘겨 보는 순서대로 늘어놓았어요. 한 덩어리로 읽히는지 마지막으로 확인해 보세요.
          </p>
          {state.busy && (
            <p role="status" className="text-[14px] text-ink-2">
              내보내는 중이에요. 잠시만 기다려 주세요.
            </p>
          )}
        </div>

        {state.error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface"
          >
            <CircleAlert size={16} aria-hidden="true" className="flex-none" />
            {state.error}
          </p>
        )}

        {/* 세로로 쌓는다 — 예전엔 왼쪽(미리보기+저장될 파일) / 오른쪽(방법 셋)으로 갈랐는데,
            방법을 하나만 보여 주게 되면서 반대쪽이 비었다. 폭을 통으로 쓰면 미리보기가 더 많이
            들어가고 방법 패널도 제 세부를 옆에 펼칠 수 있다. */}
        <section className="flex flex-col gap-4">
          <SectionHead
            title={`${state.cards.length}장 이어 보기`}
            aside="인스타에서 넘어가는 순서 그대로예요"
          />
          <ol className="flex gap-4 overflow-x-auto pb-3">
            {rendered.map((card, i) => {
              const draft = state.cards[i];
              return (
                <li key={draft.id} className="flex w-[270px] flex-none flex-col gap-2">
                  {/* 순수 시각 미리보기 — 헤드라인·본문은 실제 템플릿 텍스트라 스크린리더에
                      그대로 노출되면 아래 순번·역할 캡션, "저장될 파일" 목록과 카드 수만큼
                      중복 낭독된다. 보이는 정보는 그 두 곳에 이미 텍스트로 있다. */}
                  <div className="overflow-hidden rounded-xl border border-hair bg-surface" aria-hidden="true">
                    <span className="block aspect-[4/5] w-full overflow-hidden bg-hair-soft">
                      {/* 1080px 기준 템플릿을 0.25배(=270px)로 줄인다 — 옛 0.1407배(152px)는
                          "너무 작아 안 보인다"는 실사용 피드백으로 키웠다. */}
                      <span className="block origin-top-left scale-[0.25]">
                        {/* 카드뉴스는 계정 핸들 워터마크를 쓰지 않는다 — 빈 문자열이면 CardFrame이 안 그린다. */}
                        <CardRenderer card={card} themeId={state.themeId} handle="" ad={showAdBadge(state.ad, i, rendered.length)} />
                      </span>
                    </span>
                  </div>
                  <p className="text-[13px] font-bold tabular-nums text-ink-2">{i + 1}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-bold">내보내는 방법</h2>
            <p className="text-[13px] text-ink-2">
              하나를 골라요. 사진이 어디까지 나가는지는 방법마다 달라요.
            </p>
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
                    {on && (
                      <span className="rounded bg-ink px-2 py-0.5 text-[12px] font-bold text-surface">선택</span>
                    )}
                  </span>
                  <span className="text-[13px] text-ink-2">{m.note}</span>
                </button>
              );
            })}
          </div>

          {/* 고른 방법의 세부만 나온다. '파일로 저장'은 저장될 파일 목록을 **옆에** 둔다 —
              예전엔 이 목록이 방법과 떨어진 자리에 홀로 떠 있어 어느 방법에 딸린 것인지 흐렸다. */}
          {/* `items-start` 를 쓰지 않는다 — 나란한 테두리 박스의 아래가 들쭉날쭉하면 결함으로
              읽힌다(실측: 156px vs 284px). 칸을 늘리고 박스가 그 높이를 채운다. */}
          {method === "file" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <FileSavePanel busy={state.busy} dir={dir} saved={saved} onDownload={downloadFiles} onSave={saveFiles} />
              <div className="flex h-full flex-col gap-4">
                <SectionHead title="저장될 파일" />
                <div className="flex flex-1 flex-col gap-4 rounded-xl border border-hair p-6">
                  <p className="text-[17px] font-bold tracking-tight">{dir}/</p>
                  <ul className="flex flex-col gap-2">
                    {state.cards.map((card, i) => (
                      <li key={card.id} className="flex items-center gap-2.5 text-[14px] text-ink-2">
                        <Check size={14} aria-hidden="true" className="flex-none" />
                        <span className="tabular-nums">{i + 1}.png</span>
                        <span className="text-ink-3">·</span>
                        <span className="truncate">{card.copy.heading}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-hair pt-4 text-[14px] leading-relaxed text-ink-2">
                    같은 주제로 오늘 다시 저장하면 이 폴더를 덮어써요. 이전 회차를 남기려면 폴더 이름을 바꿔 주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {method === "phone" && (
            <SharePanel share={share} busy={state.busy} onRequest={requestShare} />
          )}

          {method === "instagram" && (
            <InstagramPublishPanel
              busy={state.busy}
              published={published}
              onPublish={publishToInstagram}
              token={publishToken}
              imageCount={state.cards.length}
              keyword={state.keyword}
              headings={state.cards.map((c) => c.copy.heading)}
              onCaptureImages={onCaptureImages}
            />
          )}
        </section>

      </div>
    </StudioFrame>
  );
}
