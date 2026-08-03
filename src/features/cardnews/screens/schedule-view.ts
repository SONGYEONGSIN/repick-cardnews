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

/** 다섯 상태 전부 한국어. 화면에 그대로 나간다. */
export const STATUS_LABELS: Record<ScheduleStatusView, string> = {
  pending: "대기 중",
  published: "올렸어요",
  failed: "실패",
  missed: "놓침",
  canceled: "취소됨",
};

export type ScheduleView = {
  id: string;
  status: ScheduleStatusView;
  keyword: string;
  imageCount: number;
  describe: string;
  message?: string;
};

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
