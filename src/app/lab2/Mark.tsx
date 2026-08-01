/**
 * 서맘 스튜디오 — 워드마크와 심볼.
 *
 * 워드마크는 서체로 조판하지 않고 **직접 그린 모듈형 한글**이다. 획 두께를 하나로 통일하고
 * 끝을 둥글게 처리해 기하학적으로 세웠다.
 *
 * 핵심은 **맘의 두 ㅁ을 카드 두 장으로** 그린 것이다 — 획이 아니라 둥근 사각 프레임으로.
 * 이름을 쓰는 행위 안에 산출물이 들어가고, 심볼(ㅅㅁ 모노그램)과 형태가 맞물린다.
 * 서의 ㅅ 도 심볼과 같은 비대칭(왼쪽은 짧고 가파르게, 오른쪽은 길고 완만하게)을 쓴다.
 *
 * `currentColor` 만 쓰므로 어두운 바탕에서도 그대로 반전된다.
 */
export function SeomamWordmark({ height = 30, label = "서맘" }: { height?: number; label?: string }) {
  return (
    <svg
      height={height}
      width={(height * 104) / 46}
      viewBox="0 0 104 46"
      fill="none"
      role={label ? "img" : "presentation"}
      aria-label={label || undefined}
    >
      {/* 서 — ㅅ (심볼과 같은 비대칭) + ㅓ */}
      <path d="M17 8 L6 33" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M17 8 L28 35" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M42 6 V38" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 22 H42" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />

      {/* 맘 — 두 ㅁ 을 카드 두 장으로. 획이 아니라 프레임이다. */}
      <rect x="56" y="6" width="22" height="15" rx="4" stroke="currentColor" strokeWidth="4.4" />
      <rect x="56" y="26" width="22" height="15" rx="4" stroke="currentColor" strokeWidth="4.4" />
      <path d="M92 5 V41" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M82 17 H92" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 심볼 (ㅅㅁ 모노그램) — 바깥 둥근 사각이 ㅁ이자 카드 프레임, 안의 두 획이 ㅅ.
 * ㅅ 은 좌우 대칭이면 삼각형(재생 아이콘)으로 읽히므로 실제 시옷의 비대칭을 쓴다.
 *
 * 워드마크를 세울 폭이 없는 좁은 자리(모바일 상단·파비콘)의 축약형이다.
 */
export function StudioMark({ size = 32, label = "서맘 스튜디오" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={label}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M14.8 9.2 L9.2 21.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M14.8 9.2 L23.2 22.8" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 로고 락업 — 워드마크 아래 "스튜디오".
 *
 * 아래 글자는 자간을 크게 벌려 위의 굵은 획과 대비시킨다. 워드마크가 주, 스튜디오가 종이라
 * 크기·굵기·자간 셋으로 주종을 만든다 — 색을 쓰지 않는 이 시스템의 방식 그대로다.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  // 락업 전체가 하나의 이름이므로 바깥이 이름을 갖고 안쪽은 감춘다 — 자간을 크게 벌린 글자를
  // 스크린리더가 한 자씩 읽는 일을 막는다.
  return (
    <span className="flex flex-col items-center gap-1.5" role="img" aria-label="서맘 스튜디오">
      <span aria-hidden="true" className="flex">
        <SeomamWordmark height={lg ? 32 : 24} label="" />
      </span>
      <span
        aria-hidden="true"
        className={`pl-[0.3em] font-bold tracking-[0.3em] text-ink-2 ${lg ? "text-[12px]" : "text-[10px]"}`}
      >
        스튜디오
      </span>
    </span>
  );
}
