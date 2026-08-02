"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Send } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";

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
 */
type ConnectionStatus =
  | { state: "loading" }
  | { state: "ready" }
  | { state: "not-ready"; missing: string[] }
  | { state: "check-failed" };

type VerifyResult =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "success"; username: string }
  | { state: "failed"; message: string };

export function InstagramPublishPanel({
  busy,
  published,
  onPublish,
}: {
  /** 다른 내보내기 작업(다운로드·저장 등)이 진행 중이어도 버튼을 눌러선 안 된다. */
  busy: boolean;
  /** 지난번 게시가 성공했는지 — 지역 상태를 부모(`ExportScreen`)가 들고 있다가 넘긴다. */
  published: boolean;
  onPublish: (caption: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<ConnectionStatus>({ state: "loading" });
  const [caption, setCaption] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [verify, setVerify] = useState<VerifyResult>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/instagram-status")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setStatus(
          data.ready
            ? { state: "ready" }
            : { state: "not-ready", missing: Array.isArray(data.missing) ? data.missing : [] },
        );
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "check-failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canPublish = status.state === "ready" && !busy && !publishing;

  async function handleClick() {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await onPublish(caption);
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

  return (
    <section className="flex max-w-[640px] flex-col gap-4">
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
            <p className="text-[14px] leading-relaxed text-ink-2">
              아직 인스타그램에 바로 올릴 수 없어요. 아래 항목을 서버에 먼저 준비해야 게시 버튼이 켜져요.
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

        {status.state === "ready" && (
          <>
            <p className="text-[14px] leading-relaxed text-ink-2">
              올리기를 누르면 이 카드 사진이 우리 공개 주소를 거쳐 인스타그램 서버로 전달돼요. "폰으로
              보내기"와 달리 이 컴퓨터의 집 네트워크를 벗어나 인터넷으로 나가는 방식이에요.
            </p>

            <div className="flex flex-col gap-2">
              <LineButton disabled={verify.state === "checking"} onClick={() => void handleVerify()}>
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

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ink-2">캡션 (선택)</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={busy || publishing}
                rows={3}
                maxLength={2200}
                placeholder="게시물에 함께 올릴 글을 적어 주세요"
                className={`rounded-lg border border-hair px-3 py-2.5 text-[14px] leading-relaxed transition-colors duration-200 placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none`}
              />
            </label>

            {publishing && (
              <p className="text-[13px] text-ink-2">
                게시하는 중이에요. 인스타그램이 사진을 준비할 때까지 최대 몇 분 걸릴 수 있어요 — 창을 닫지
                말고 기다려 주세요.
              </p>
            )}

            {published && !publishing && (
              <p className="flex items-center gap-2 text-[14px] font-bold">
                <Check size={16} aria-hidden="true" className="flex-none" />
                인스타그램에 올렸어요.
              </p>
            )}

            <SolidButton disabled={!canPublish} onClick={() => void handleClick()}>
              <Send size={15} aria-hidden="true" />
              인스타에 올리기
            </SolidButton>
          </>
        )}
      </div>
    </section>
  );
}
