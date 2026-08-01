/**
 * 서맘 스튜디오 — 심볼 (시안 C, ㅅㅁ 모노그램).
 *
 * 사각 프레임 안에 ㅅ. 두 초성이 한 형태에 겹친다 — 바깥 둥근 사각이 **ㅁ**이자 카드
 * 프레임이고, 안의 두 획이 **ㅅ**이다.
 *
 * 워드마크 없이 마크만 세우므로 접근 가능한 이름을 SVG 가 직접 갖는다
 * (`role="img"` + `aria-label`). 로고만 남기고 이름을 지우면 스크린리더에서 브랜드가
 * 통째로 사라진다.
 *
 * 무채색 원칙을 지켜 `currentColor` 만 쓴다 — 어두운 바탕에 놓아도 그대로 반전된다.
 * 획이 둘뿐이라 20px 에서도 형태가 뭉개지지 않는다.
 */
export function StudioMark({ size = 44, label = "서맘 스튜디오" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={label}>
      {/* ㅁ — 카드 프레임 */}
      <rect x="3.5" y="3.5" width="25" height="25" rx="6.5" stroke="currentColor" strokeWidth="2" />
      {/* ㅅ — 좌우 대칭이면 삼각형(재생 아이콘)으로 읽힌다. 실제 시옷의 비대칭을 살린다:
          왼쪽 획은 짧고 가파르게, 오른쪽 획은 길고 완만하게 뻗으며 획 두께도 다르다. */}
      <path d="M14.8 9.2 L9.2 21.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M14.8 9.2 L23.2 22.8" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  );
}

/** 사이드바·상단에 놓이는 로고. 이름 텍스트 없이 마크만 세운다. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return <StudioMark size={size === "lg" ? 48 : 32} />;
}
