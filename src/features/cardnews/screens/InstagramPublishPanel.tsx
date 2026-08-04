"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Send } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { maxPublishWaitMs } from "@/lib/instagram";
import { daysRemaining } from "@/lib/instagram-token-refresh";
import type { PublishProgress } from "@/lib/publish-progress-store";
import { TokenStatusBlock, type RefreshActionResult, type TokenStatusView } from "./TokenStatusBlock";
import { HashtagInput } from "./HashtagInput";
import { defaultCaption, defaultHashtags } from "./caption-draft";
import { SchedulePanel } from "./SchedulePanel";

/**
 * "인스타그램에 올리기" 패널. 연결 여부는 이 컴포넌트가 마운트 시 `GET /api/instagram-status`
 * 로 직접 물어본다 — 그 라우트는 서버만 아는 사실(토큰 등이 있는지 없는지)을 읽기 전용으로
 * 알려줄 뿐, 값 자체(액세스 토큰)는 절대 돌려주지 않는다 — 이 컴포넌트도, 다른 어떤 클라이언트
 * 코드도 토큰 값을 볼 수 없다.
 *
 * "폰으로 보내기"(`SharePanel`)와 다른 지점: 그건 같은 와이파이 안에서만 오가지만, 이건 누르는
 * 순간 카드 사진이 인스타그램 서버로 나간다 — 그 사실을 게시 버튼이 나타나기 **전에** 항상
 * 보이도록 적어 둔다.
 *
 * "연결 확인" 버튼은 `POST /api/instagram-verify`를 부른다 — 환경변수가 채워졌는지만 보는
 * `instagram-status`와 달리 실제로 Graph API 를 한 번 호출해 토큰이 유효한지, 계정 ID가
 * 맞는지 확인하고 연결된 계정 이름(username)을 보여 준다. **화면이 열릴 때 자동으로 부르지
 * 않고, 사용자가 버튼을 눌렀을 때만** 호출한다.
 *
 * 공개 주소(`PUBLIC_BASE_URL`)는 게시할 때만 필요하다 — 연결 확인(계정 ID·토큰)엔 필요
 * 없다. 그래서 `/api/instagram-status`가 `ready:false`와 함께 내려주는 `connected`로
 * "연결도 아직 안 됨"(`not-ready`)과 "연결은 됐는데 공개 주소가 없어 게시 준비만 덜 됨"
 * (`connected-not-ready`)을 구분한다 — 뒤쪽 상태에서만 "연결 확인" 버튼을 켠다.
 *
 * **게시 진행 상황**: `/api/publish` 호출이 도는 동안(`token` prop이 채워져 있는 동안)만
 * `GET /api/publish-progress`를 몇 초 간격으로 물어본다 — 서버가 3단계(사진 준비 → 묶기 →
 * 게시) 중 어디에 있는지 기록해 둔 것을 그대로 읽어와 "N장 중 M장 준비 중"처럼 숫자로
 * 보여준다. `token`이 null이 되면(요청이 끝나면) 폴링을 멈춘다.
 *
 * **토큰 만료일**: `GET /api/instagram-refresh-token`으로 저장된 만료일을 읽어 "N월 N일까지 ·
 * N일 남음"으로 보여준다(`TokenStatusBlock`). 서버가 기동할 때마다 자동으로 30일 이내면
 * 스스로 갱신하지만(`src/instrumentation.ts`), 화면의 "토큰 갱신" 버튼으로 사용자가 언제든
 * 남은 기간과 무관하게 직접 시도할 수도 있다(`POST` 같은 경로). 이미 만료됐으면 자동/수동
 * 갱신 둘 다 불가능하므로 버튼 대신 대시보드 재발급 안내를 보여준다.
 *
 * **해시태그**: 캡션 아래에서 태그를 하나씩(또는 공백·쉼표로 여러 개를 한 번에) 입력받아
 * 칩으로 쌓는다. 인스타그램이 2025-12부터 게시물당 5개로 제한하므로(`@/lib/hashtags`가
 * 단일 출처) 5개를 넘기려 하면 추가를 막고 이유를 보여준다 — 이 화면과 `/api/publish`의
 * zod 검증이 같은 상한을 쓴다. `#`은 붙이든 안 붙이든 정규화된다. 실제로 캡션과 합치는
 * 것은(줄바꿈 두 번 뒤 `#태그` 나열, `combineCaptionWithHashtags`) 이 화면이 아니라
 * `/api/publish`가 한다 — 여기는 `caption`·`hashtags`를 구조 그대로 넘길 뿐이다.
 */
/** 진행 상황을 몇 초 간격으로 물어볼지 — "몇 초 간격"이라는 요구를 만족하는 값. */
const PROGRESS_POLL_INTERVAL_MS = 3_000;

/** 서버가 기록한 진행 상황을 한국어 문구로 바꾼다. `done`은 화면에 보일 일이 거의 없다 —
 * `/api/publish` 요청 자체가 거의 동시에 끝나 `publishing` 상태를 먼저 꺼버리기 때문이다. */
function progressLabel(progress: PublishProgress | null): string | null {
  if (!progress) return null;
  if (progress.stage === "preparing") return `${progress.total}장 중 ${progress.index}장 준비 중`;
  if (progress.stage === "bundling") return "사진을 한 세트로 묶는 중";
  if (progress.stage === "publishing") return "인스타그램에 올리는 중";
  return null;
}

type ConnectionStatus =
  | { state: "loading" }
  | { state: "ready" }
  | { state: "connected-not-ready"; missing: string[] }
  | { state: "not-ready"; missing: string[] }
  | { state: "check-failed" };

type VerifyResult =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "success"; username: string }
  | { state: "failed"; message: string };

/** "연결 확인" 버튼과 그 결과 표시. `ready`·`connected-not-ready` 두 상태에서 똑같이 쓴다. */
function VerifyBlock({ verify, onVerify }: { verify: VerifyResult; onVerify: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <LineButton disabled={verify.state === "checking"} onClick={onVerify}>
        {verify.state === "checking" ? "확인하는 중..." : "연결 확인"}
      </LineButton>
      {verify.state === "success" && (
        <p role="status" className="flex items-center gap-2 text-[14px] font-bold">
          <Check size={16} aria-hidden="true" className="flex-none" />
          연결됨 @{verify.username} — 이 계정이 맞는지 확인해 주세요.
        </p>
      )}
      {verify.state === "failed" && (
        <p role="alert" className="flex items-center gap-2 text-[14px] text-ink-2">
          <CircleAlert size={16} aria-hidden="true" className="flex-none" />
          {verify.message}
        </p>
      )}
    </div>
  );
}

export function InstagramPublishPanel({
  busy,
  published,
  onPublish,
  token,
  imageCount,
  keyword,
  headings,
  onCaptureImages,
}: {
  /** 다른 내보내기 작업(다운로드·저장 등)이 진행 중이어도 버튼을 눌러선 안 된다. */
  busy: boolean;
  /** 지난번 게시가 성공했는지 — 지역 상태를 부모(`ExportScreen`)가 들고 있다가 넘긴다. */
  published: boolean;
  /** 캡션과 해시태그(정규화된 배열, `#` 없이)를 구조 그대로 넘긴다 — 합치는 건 서버 몫이다. */
  onPublish: (caption: string, hashtags: string[]) => Promise<void>;
  /** `/api/publish` 요청이 실제로 도는 동안만 값이 있다 — 이 값이 있을 때만 진행 상황을 폴링한다. */
  token: string | null;
  /** 이번에 게시할 사진 장수 — 최대 소요 시간 안내에 쓴다. */
  imageCount: number;
  /** 예약 항목에 함께 남긴다 — 목록에서 어떤 카드인지 알아보려면 주제가 필요하다. */
  keyword: string;
  /** 카드들의 헤드라인 — 캡션 초안을 여기서 뽑는다(`caption-draft`). */
  headings: readonly string[];
  /** 예약할 때 카드 이미지를 그 자리에서 굳히기 위해 부른다(`ExportScreen` 의 캡처). */
  onCaptureImages: (count: number) => Promise<string[]>;
}) {
  const [status, setStatus] = useState<ConnectionStatus>({ state: "loading" });
  // 빈 칸을 마주하는 대신 고칠 거리를 준다 — 카드의 헤드라인과 주제에서 뽑는다(`caption-draft`).
  // 초기값으로만 쓴다: 사용자가 고친 뒤 카드가 바뀌어도 덮어쓰지 않는다.
  const [caption, setCaption] = useState(() => defaultCaption(keyword, headings));
  const [hashtags, setHashtags] = useState<string[]>(() => defaultHashtags(keyword));
  // 이 세션이 건 예약이 아직 대기 중인가. 예약해 놓고 "지금 올리기"를 또 누르면 같은 카드가
  // 두 번 올라간다(지금 한 번, 예약 시각에 한 번).
  const [schedulePending, setSchedulePending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [verify, setVerify] = useState<VerifyResult>({ state: "idle" });
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatusView>({ state: "loading" });
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshActionResult>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/instagram-status")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const missing = Array.isArray(data.missing) ? data.missing : [];
        if (data.ready) {
          setStatus({ state: "ready" });
        } else if (data.connected) {
          setStatus({ state: "connected-not-ready", missing });
        } else {
          setStatus({ state: "not-ready", missing });
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "check-failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 저장된 토큰 만료일을 읽기 전용으로 물어본다 — 토큰이 아예 없는 상태(`not-ready`)에서도
  // 해롭지 않게 "unknown"으로 떨어질 뿐이라, 연결 상태와 무관하게 마운트 시 한 번만 부른다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/instagram-refresh-token")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.expired) {
          setTokenStatus({ state: "expired" });
        } else if (typeof data.expiresAt === "string" && typeof data.daysRemaining === "number") {
          setTokenStatus({ state: "valid", expiresAt: new Date(data.expiresAt), daysRemaining: data.daysRemaining });
        } else {
          setTokenStatus({ state: "unknown" });
        }
      })
      .catch(() => {
        if (!cancelled) setTokenStatus({ state: "check-failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 게시가 실제로 도는 동안(`token`이 있는 동안)만 몇 초 간격으로 진행 상황을 물어본다.
  // 요청이 끝나 `token`이 null이 되면 다음 effect 정리에서 폴링을 멈추고 표시도 지운다.
  useEffect(() => {
    if (!token) {
      setProgress(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/publish-progress?token=${encodeURIComponent(token as string)}`);
        const data = await res.json();
        if (!cancelled && data.progress) setProgress(data.progress);
      } catch {
        // 한 번 실패했다고 화면을 에러로 바꾸지 않는다 — 다음 폴링에서 다시 시도한다.
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), PROGRESS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  const canPublish = status.state === "ready" && !busy && !publishing && !schedulePending;
  const maxWaitMinutes = Math.round(maxPublishWaitMs(imageCount) / 60_000);
  const label = progressLabel(progress);

  async function handleClick() {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await onPublish(caption, hashtags);
    } finally {
      setPublishing(false);
    }
  }

  /** 화면이 열릴 때 자동으로 부르지 않는다 — 버튼을 눌렀을 때만 실제 Graph API 를 호출한다. */
  async function handleVerify() {
    setVerify({ state: "checking" });
    try {
      const res = await fetch("/api/instagram-verify", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setVerify({ state: "success", username: data.username });
      } else {
        setVerify({
          state: "failed",
          message: typeof data.error === "string" ? data.error : "연결 확인에 실패했어요.",
        });
      }
    } catch {
      setVerify({ state: "failed", message: "연결 확인에 실패했어요. 잠시 후 다시 시도해 주세요." });
    }
  }

  /** "토큰 갱신" 버튼 — 남은 기간과 무관하게 항상 시도한다(서버 쪽 게이트는 자동 갱신에만
   * 적용된다, `src/instrumentation.ts` 참고). 성공하면 화면에 보이는 만료일도 즉시 새로
   * 고친다. */
  async function handleRefreshToken() {
    setRefreshingToken(true);
    try {
      const res = await fetch("/api/instagram-refresh-token", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRefreshResult({ state: "success", expiresAt: data.expiresAt });
        const expiresAt = new Date(data.expiresAt);
        setTokenStatus({ state: "valid", expiresAt, daysRemaining: daysRemaining(new Date(), expiresAt) });
      } else {
        setRefreshResult({
          state: "failed",
          message: typeof data.error === "string" ? data.error : "토큰 갱신에 실패했어요.",
        });
      }
    } catch {
      setRefreshResult({ state: "failed", message: "토큰 갱신에 실패했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setRefreshingToken(false);
    }
  }

  return (
    // 표준: 제목/구분선 밖, 내용은 박스 안 + 상태(왼쪽)/게시 준비(오른쪽) 2단 — docs/ui-standards.md §1,§3
    <section className="flex flex-col gap-4">
      <SectionHead title="인스타그램에 올리기" aside="누르면 사진이 인스타그램 서버로 나가요" />
      <div role="status" className="flex flex-col gap-4 rounded-xl border border-hair p-6">
        {status.state === "loading" && (
          <p className="text-[14px] text-ink-2">연결 상태를 확인하는 중이에요.</p>
        )}

        {status.state === "check-failed" && (
          <p className="flex items-center gap-2 text-[14px] text-ink-2">
            <CircleAlert size={16} aria-hidden="true" className="flex-none" />
            연결 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {status.state === "not-ready" && (
          <div className="flex flex-col gap-3">
            <p className="max-w-[46rem] text-[14px] leading-relaxed text-ink-2">
              아직 인스타그램에 연결할 수 없어요. 아래 항목을 서버에 먼저 준비해야 연결 확인도, 게시도 할 수
              있어요.
            </p>
            <ul className="flex flex-col gap-1.5">
              {status.missing.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[14px] font-bold">
                  <CircleAlert size={14} aria-hidden="true" className="flex-none" />
                  {item}
                </li>
              ))}
            </ul>
            <SolidButton disabled>
              <Send size={15} aria-hidden="true" />
              인스타에 올리기
            </SolidButton>
          </div>
        )}

        {status.state === "connected-not-ready" && (
          <div className="flex flex-col gap-3">
            <p className="max-w-[46rem] text-[14px] leading-relaxed text-ink-2">
              계정 연결에 필요한 값은 준비됐어요. 연결 확인은 지금 해 볼 수 있지만, 게시하려면 아래 항목이
              더 필요해요.
            </p>
            <ul className="flex flex-col gap-1.5">
              {status.missing.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[14px] font-bold">
                  <CircleAlert size={14} aria-hidden="true" className="flex-none" />
                  {item}
                </li>
              ))}
            </ul>
            <VerifyBlock verify={verify} onVerify={() => void handleVerify()} />
            <TokenStatusBlock
              status={tokenStatus}
              refreshing={refreshingToken}
              refreshResult={refreshResult}
              onRefresh={() => void handleRefreshToken()}
            />
            <SolidButton disabled>
              <Send size={15} aria-hidden="true" />
              인스타에 올리기
            </SolidButton>
          </div>
        )}

        {status.state === "ready" && (
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            {/* 왼쪽 = 적고 누르는 것(캡션 · 해시태그 · 게시) — 손이 가는 쪽이 먼저다 */}
            <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ink-2">캡션 (선택)</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={busy || publishing}
                rows={8}
                maxLength={2200}
                placeholder="게시물에 함께 올릴 글을 적어 주세요"
                className={`rounded-lg border border-hair px-3 py-2.5 text-[14px] leading-relaxed transition-colors duration-200 placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none`}
              />
            </label>

            <HashtagInput value={hashtags} onChange={setHashtags} disabled={busy || publishing} />

            {publishing && (
              <p role="status" className="text-[13px] text-ink-2">
                게시하는 중이에요{label ? ` — ${label}` : ""}. 사진 처리 속도에 따라 최대 {maxWaitMinutes}분까지
                걸릴 수 있어요 — 창을 닫지 말고 기다려 주세요.
              </p>
            )}

            {published && !publishing && (
              <p className="flex items-center gap-2 text-[14px] font-bold">
                <Check size={16} aria-hidden="true" className="flex-none" />
                인스타그램에 올렸어요.
              </p>
            )}

            {/* 막힌 이유를 적는다 — 회색 버튼만 두면 왜 안 눌리는지 알 수 없다. */}
            {schedulePending && (
              <p role="status" className="flex items-start gap-2 text-[14px] font-bold leading-relaxed">
                <CircleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
                예약이 걸려 있어요. 지금 올리면 예약 시각에 한 번 더 올라가요 — 지금 올리려면 아래에서
                예약을 먼저 취소해 주세요.
              </p>
            )}
            <SolidButton disabled={!canPublish} onClick={() => void handleClick()}>
              <Send size={15} aria-hidden="true" />
              인스타에 올리기
            </SolidButton>
            </div>

            {/* 오른쪽 = 읽고 확인하는 것(무엇이 일어나나 · 연결 · 토큰) */}
            <div className="flex flex-col gap-4">
              <p className="text-[14px] leading-relaxed text-ink-2">
                올리기를 누르면 이 카드 사진이 우리 공개 주소를 거쳐 인스타그램 서버로 전달돼요. "폰으로
                보내기"와 달리 이 컴퓨터의 집 네트워크를 벗어나 인터넷으로 나가는 방식이에요.
              </p>

              <VerifyBlock verify={verify} onVerify={() => void handleVerify()} />
              <TokenStatusBlock
                status={tokenStatus}
                refreshing={refreshingToken}
                refreshResult={refreshResult}
                onRefresh={() => void handleRefreshToken()}
              />
            </div>
          </div>
        )}

        {/* 예약도 게시의 한 갈래라 같은 방법 안에 둔다. 지금 화면의 캡션·해시태그를 그대로
            넘긴다 — 예약한 그대로가 올라가야 한다. */}
        {status.state === "ready" && (
          <SchedulePanel
            busy={busy || publishing}
            imageCount={imageCount}
            keyword={keyword}
            caption={caption}
            hashtags={hashtags}
            onCaptureImages={onCaptureImages}
            onPendingChange={setSchedulePending}
          />
        )}
      </div>
    </section>
  );
}
