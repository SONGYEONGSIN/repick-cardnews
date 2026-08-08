import { checkCronSecret } from "@/lib/cron-auth";
import { canClaim } from "@/lib/schedule-claim";
import { dueVerdict } from "@/lib/schedule-due";
import { runScheduledItem } from "@/lib/schedule-runner";
import { deleteImages, listItems, putItem } from "@/lib/schedule-store";
import { writeHeartbeat } from "@/lib/scheduler-health";

/**
 * GET /api/cron/tick — **밖에서 1분마다 두드리는 입구**(cron-job.org).
 *
 * 예전에는 서버 프로세스 안 `setInterval` 이 이 일을 했다. 서버리스에는 요청 사이에 살아남는
 * 프로세스가 없어 밖에서 부르는 방식으로 바꿨다. Vercel Hobby 의 자체 cron 은 **하루 1회**가
 * 상한이라 쓸 수 없다.
 *
 * **이 경로는 로그인 예외다**(`@/lib/auth` 의 `PUBLIC_PREFIXES`). cron 서비스는 로그인할 수
 * 없기 때문인데, 그래서 `CRON_SECRET` 이 **유일한 문지기**다. 설정이 없으면 아무도 못 들어온다.
 *
 * **한 번에 하나만 올린다.** Vercel 함수는 300초에서 끊기고 캐러셀 한 건이 1~2분 걸린다.
 * 밀린 것을 몰아 처리하다 중간에 끊기면 올라갔는지 아닌지 모르는 항목이 생긴다 — 1분마다
 * 불리므로 밀린 것은 분당 하나씩 빠진다. **끊기는 것보다 늦는 편이 낫다.**
 */
export async function GET(req: Request) {
  const given = new URL(req.url).searchParams.get("secret");
  if (!checkCronSecret(given, process.env.CRON_SECRET)) {
    return Response.json({ error: "권한이 없어요." }, { status: 401 });
  }

  const now = Date.now();
  // 올릴 게 없어도 남긴다 — 궁금한 것은 "올릴 게 있나"가 아니라 "시계가 도나"다.
  await writeHeartbeat(now);

  const items = await listItems();
  const ready = items
    .filter((i) => canClaim(i, now))
    .map((i) => ({ item: i, verdict: dueVerdict(i.scheduledAt, now) }));

  // 놓친 것부터 정리한다. 게시보다 먼저 해야 "한참 지난 예약이 목록에 대기 중으로 남아 있는"
  // 상태가 다음 tick 까지 이어지지 않는다.
  let missed = 0;
  for (const { item } of ready.filter((r) => r.verdict === "missed")) {
    await putItem({
      ...item,
      status: "missed",
      message: "예약 시각을 한 시간 넘게 지나 올리지 않았어요.",
      updatedAt: now,
    });
    await deleteImages(item.id);
    missed += 1;
  }

  const due = ready
    .filter((r) => r.verdict === "due")
    .map((r) => r.item)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);

  const target = due[0];
  if (!target) return Response.json({ ok: true, published: 0, missed, waiting: 0 });

  // **인스타를 부르기 전에** 찜한다. 뒤에 하면 그 사이 다음 tick 이 같은 항목을 집어 같은
  // 사진이 두 번 올라간다. (Blob 에 원자적 비교-교환이 없어 완전히 막지는 못한다 —
  // `@/lib/schedule-claim` 의 한계 설명 참고.)
  await putItem({ ...target, status: "publishing", claimedAt: now, updatedAt: now });

  const result = await runScheduledItem(target, { now });

  await putItem({
    ...target,
    status: result.ok ? "published" : "failed",
    ...(result.ok ? {} : { message: result.message }),
    updatedAt: Date.now(),
  });
  // 올린 사진만 지운다 — 실패한 것은 남겨 둬야 사람이 다시 걸 수 있다.
  if (result.ok) await deleteImages(target.id);

  return Response.json({ ok: true, published: result.ok ? 1 : 0, missed, waiting: due.length - 1 });
}
