/**
 * 예약 화면의 **판정 모듈** — 응답 해석과 상태 라벨.
 *
 * 이 저장소 vitest 는 `environment: "node"` 라 렌더 테스트를 붙일 수 없다. 판단은 전부 여기로
 * 빼고 컴포넌트(`SchedulePanel`)에는 JSX 와 배선만 남긴다.
 *
 * 서버 응답을 **다시 검증한다** — 필드가 바뀌면 여기서 걸러 내야지, 타입만 믿고 통과시키면
 * 화면이 `undefined` 를 그린다.
 */

export type ScheduleStatusView = "pending" | "published" | "failed" | "missed" | "canceled";

/**
 * 다섯 상태 전부 한국어. 화면에 그대로 나간다.
 *
 * 목록이 예약 전용이 아니게 되면서(지금 바로 올린 것도 함께 쌓인다) 예약 말투("올렸어요")
 * 대신 **결과**를 말한다 — 체크 표시 하나로는 성공인지 그냥 끝난 것인지 흐렸다.
 */
export const STATUS_LABELS: Record<ScheduleStatusView, string> = {
  pending: "예약 대기 중",
  published: "업로드 성공",
  failed: "업로드 실패",
  missed: "시각 놓침",
  canceled: "취소함",
};

export type ScheduleView = {
  id: string;
  status: ScheduleStatusView;
  keyword: string;
  imageCount: number;
  describe: string;
  message?: string;
  /** 상태가 마지막으로 바뀐 시각 — 언제 올렸는지 보여 준다. 옛 기록에는 없다. */
  updatedAt?: number;
  /** 지금 올리는 중이면 어디까지 갔는지. 서버가 함께 내려준다(`/api/schedule`). */
  progress?: SchedulePublishProgress;
};

/**
 * 예약이 도는 동안의 진행 단계. `@/lib/instagram` 의 `PublishStageProgress` 와 같은 모양이되,
 * 이 파일은 서버 코드를 끌어오지 않으므로(클라이언트 번들) 여기서 다시 좁힌다.
 */
export type SchedulePublishProgress =
  | { stage: "preparing"; index: number; total: number }
  | { stage: "bundling" }
  | { stage: "publishing" };

function asProgress(value: unknown): SchedulePublishProgress | null {
  const r = asRecord(value);
  if (!r) return null;
  if (r.stage === "bundling" || r.stage === "publishing") return { stage: r.stage };
  if (r.stage === "preparing" && typeof r.index === "number" && typeof r.total === "number") {
    return { stage: "preparing", index: r.index, total: r.total };
  }
  // 모르는 모양은 버린다 — 화면이 깨지느니 안 보여 준다.
  return null;
}

/** 진행 단계를 사람이 읽는 한 줄로. 없으면 `null` — 부를 쪽이 안 그리면 된다. */
export function progressLine(progress: SchedulePublishProgress | undefined): string | null {
  if (!progress) return null;
  if (progress.stage === "preparing") {
    // 한 장짜리(정보전달)에 "1장 중 1장"은 군더더기다.
    return progress.total <= 1 ? "사진 준비 중" : `${progress.total}장 중 ${progress.index}장 준비 중`;
  }
  if (progress.stage === "bundling") return "한 세트로 묶는 중";
  return "인스타그램에 올리는 중";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asStatus(value: unknown): ScheduleStatusView | null {
  return typeof value === "string" && value in STATUS_LABELS ? (value as ScheduleStatusView) : null;
}

export function toScheduleView(status: number, body: unknown): ScheduleView[] {
  if (status !== 200) return [];
  const record = asRecord(body);
  const rows = record?.items;
  if (!Array.isArray(rows)) return [];

  const out: ScheduleView[] = [];
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    const id = typeof r.id === "string" ? r.id : null;
    const st = asStatus(r.status);
    // 라벨이 없는 상태는 그리지 않는다 — 빈 칸을 보여 주느니 빼는 게 낫다.
    if (!id || !st) continue;
    out.push({
      id,
      status: st,
      keyword: typeof r.keyword === "string" ? r.keyword : "",
      imageCount: typeof r.imageCount === "number" ? r.imageCount : 0,
      describe: typeof r.describe === "string" ? r.describe : "",
      ...(typeof r.message === "string" ? { message: r.message } : {}),
      ...(typeof r.updatedAt === "number" ? { updatedAt: r.updatedAt } : {}),
      ...(asProgress(r.progress) ? { progress: asProgress(r.progress) as SchedulePublishProgress } : {}),
    });
  }
  return out;
}

/** 취소할 수 있는 것만 참이다 — 이미 끝난 예약은 되돌릴 수 없다. */
export function isPending(item: ScheduleView | undefined): boolean {
  return item?.status === "pending";
}

/**
 * `<input type="datetime-local">` 이 읽는 `YYYY-MM-DDTHH:mm`. **로컬 기준**이어야 한다 —
 * `toISOString()` 은 UTC 라 사용자가 보는 시계와 어긋난다.
 */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * **이 세션에서 건 예약**이 아직 대기 중인가. 예약해 놓고 "인스타에 올리기"를 또 누르면 같은
 * 카드가 두 번 올라간다(지금 한 번, 예약 시각에 한 번) — 그걸 막는 데 쓴다.
 *
 * 큐는 전역이라 **남이 옛날에 건 예약까지 막으면 안 된다.** 그래서 이 세션이 만든 id 만 본다.
 */
export function hasPendingFrom(items: ScheduleView[], sessionIds: readonly string[]): boolean {
  const mine = new Set(sessionIds);
  return items.some((item) => mine.has(item.id) && item.status === "pending");
}

/** 서버가 알려주는 시계 상태. 옛 서버는 안 줄 수 있으므로 `undefined` 를 허용한다. */
export type SchedulerHealthView = "alive" | "stale";

/**
 * 시계가 멈췄다고 말할 문구. 말할 게 없으면 `null`.
 *
 * **기다리는 예약이 있을 때만 말한다** — 예약이 하나도 없는데 "시계가 멈췄어요"는 겁만 준다.
 * 실제로 예약이 44분을 지나도 '대기 중'인 채였는데 화면은 아무 말도 못 했다(2026-08-05).
 */
export function schedulerWarning(health: SchedulerHealthView | undefined, hasPending: boolean): string | null {
  if (health !== "stale" || !hasPending) return null;
  return "예약을 돌리는 시계가 멈춰 있어요. dev 서버를 다시 켜면 이어서 올라가요.";
}

/** 목록 응답에서 시계 상태를 읽는다. 모르는 값은 `undefined` — 화면이 조용히 넘어간다. */
export function toSchedulerHealth(body: unknown): SchedulerHealthView | undefined {
  const r = asRecord(body);
  return r?.scheduler === "alive" || r?.scheduler === "stale" ? r.scheduler : undefined;
}

/**
 * 캡처 결과를 서버로 보낼 base64 로 바꾼다.
 *
 * `captureImages` 는 **순수 base64**(`btoa` 결과)를 준다 — `data:` 접두사가 없다. 그런데
 * 예약 패널이 data URL 인 줄 알고 콤마로 잘라, 매번 빈 문자열을 보냈다. 그래서 예약이 저장한
 * 이미지가 0바이트였고 인스타그램은 그걸 받아 거절했다(2026-08-05). 어느 형태로 오든
 * 깨지지 않게 한 곳에서 다룬다.
 */
export function toPublishBase64(captured: string): string {
  const marker = ";base64,";
  const at = captured.indexOf(marker);
  return at === -1 ? captured : captured.slice(at + marker.length);
}


/**
 * 지울 수 있는 기록인가. 끝났지만 **올라가지 않은** 것만 지운다.
 *
 * 성공한 기록은 못 지운다 — 인스타에는 남아 있는데 여기서만 사라지면 무엇을 올렸는지 알 길이
 * 없어진다. 대기 중도 못 지운다: 그건 취소가 먼저다.
 */
export function canRemoveRecord(status: ScheduleStatusView): boolean {
  return status === "failed" || status === "canceled" || status === "missed";
}

/** 언제 올렸는지 한 줄로. 옛 기록에는 시각이 없어 그때는 빈 문자열이다. */
export function recordWhen(at: number | undefined): string {
  if (at === undefined) return "";
  const d = new Date(at);
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}
