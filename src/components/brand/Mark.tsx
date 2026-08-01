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
      width={(height * 105) / 46}
      viewBox="0 0 105 46"
      fill="none"
      role={label ? "img" : "presentation"}
      aria-label={label || undefined}
    >
      {/* 획 두께는 4.6 하나로 통일한다. 섞이면 딱 떨어지지 않는다. */}
      {/* 서 — ㅅ(심볼과 같은 비대칭) + ㅓ */}
      <path d="M18 8 L7 34" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M18 8 L29 36" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M43 7 V39" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M33 23 H43" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />

      {/* 맘 — 초성 ㅁ(좌상) · 종성 ㅁ(좌하) · 중성 ㅏ(우측 전체 높이).
          두 ㅁ 은 획이 아니라 둥근 프레임 — 카드 두 장이다. 조판 관례로는 종성이 초성보다
          넓지만, 여기서는 **같은 크기**로 둔다. 두 장이 같아야 카드 두 장으로 읽힌다.
          ㅏ 는 세로획에서 가로획이 **오른쪽**으로 나간다 — 왼쪽으로 나가면 ㅓ 다. */}
      <rect x="54" y="7" width="25" height="14" rx="3.5" stroke="currentColor" strokeWidth="4.6" />
      <rect x="54" y="25" width="25" height="14" rx="3.5" stroke="currentColor" strokeWidth="4.6" />
      <path d="M88 7 V39" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M88 16 H98" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
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
  // 락업 전체가 하나의 이름이므로 바깥이 이름을 갖고 안쪽은 감춘다 — 자간을 벌린 글자를
  // 스크린리더가 한 자씩 읽는 일을 막는다.
  //
  // 아래 글자는 자간을 숫자로 주지 않는다. 로고 크기가 바뀔 때마다 어긋나기 때문이다.
  // 글자를 하나씩 나눠 양끝 정렬하면 세로 방향 flex 가 정해 준 폭(= 워드마크 폭)에
  // 언제나 정확히 맞는다.
  return (
    <span className="inline-flex flex-col gap-1.5" role="img" aria-label="서맘 스튜디오">
      <span aria-hidden="true" className="flex">
        <SeomamWordmark height={lg ? 32 : 24} label="" />
      </span>
      {/* 폭을 워드마크의 88% 로 좁혀 자간을 줄인다. 100% 면 양끝이 워드마크에 딱 붙어
          자간이 과해 보인다. 비율로 두면 로고 크기가 바뀌어도 같은 인상이 유지된다. */}
      <span
        aria-hidden="true"
        className={`flex w-[88%] self-center justify-between font-bold text-ink-2 ${
          lg ? "text-[12px]" : "text-[10px]"
        }`}
      >
        {["스", "튜", "디", "오"].map((c) => (
          <span key={c}>{c}</span>
        ))}
      </span>
    </span>
  );
}
