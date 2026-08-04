/**
 * 게시 전에 공개 주소로 사진을 한 번 불러 보는 확인의 **결과 종류**.
 *
 * 예전엔 참/거짓뿐이라 실패 문구가 하나였다("터널이 켜져 있는지, 주소가 맞는지 확인해
 * 주세요"). 그래서 터널은 멀쩡히 도는데 `.env.local` 만 옛 주소인 상황에서, 사용자가
 * 터널을 붙잡고 한참 헤맸다(2026-08-05 실제로 그랬다). 둘을 갈라 말한다.
 *
 * 순수 함수다 — 이 저장소 vitest 는 `environment: "node"` 라 화면을 못 그린다.
 */
export type TunnelReach = "ok" | "unreachable" | "not-ok";

export function tunnelFailureMessage(reach: Exclude<TunnelReach, "ok">): string {
  if (reach === "unreachable") {
    // 호스트를 못 찾거나 연결이 안 된다 — 터널이 꺼졌거나 주소가 옛것이다. 주소를 먼저 본다:
    // 터널은 켤 때마다 새 주소가 생기므로 이쪽이 훨씬 흔하다.
    return "공개 주소에 닿지 못했어요. 터널을 새로 켜면 주소가 바뀌어요 — PUBLIC_BASE_URL 이 지금 터널 주소인지 확인해 주세요.";
  }
  // 서버는 응답했는데 사진이 안 나온다 — 주소는 살아 있다.
  return "공개 주소는 살아 있는데 사진을 열지 못했어요. 예약해 둔 사진이 지워졌거나 서버가 다시 켜지는 중일 수 있어요.";
}
