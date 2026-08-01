/**
 * 서맘 스튜디오 — 심볼.
 *
 * 워드마크 없이 마크만 세운다. 그러면 형태가 혼자 의미를 져야 하므로, 세 가지가 한 형태에
 * 겹치도록 잡았다.
 *
 * - 서로 기대어 선 두 획 = **서맘의 초성 ㅅ**
 * - 그 두 획이 곧 **카드 두 장**. 앞장 안의 짧은 막대는 헤드라인 자리 — 이 도구가 만드는 것.
 * - 아래 받침선 = **작업대**. 스튜디오라는 이름이 형태로 들어간 자리다.
 *
 * 인화지를 세워 말리는 모습이기도 해서 사진 작업실 은유와도 붙는다.
 *
 * 무채색 원칙을 지켜 `currentColor` 만 쓴다 — 어디에 놓아도 주변 색을 따라간다.
 * 텍스트가 없으므로 접근 가능한 이름을 SVG 자신이 가져야 한다(`role="img"` + `aria-label`).
 */
export function StudioMark({ size = 28, label = "서맘 스튜디오" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={label}>
      {/* 뒤 카드 — 선으로 두어 앞뒤 깊이를 만든다 */}
      <rect
        x="15"
        y="4"
        width="9.5"
        height="21"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        transform="rotate(17 19.75 14.5)"
      />
      {/* 앞 카드 — 채움 */}
      <rect x="7.5" y="4" width="9.5" height="21" rx="2.5" fill="currentColor" transform="rotate(-17 12.25 14.5)" />
      {/* 앞 카드 안 헤드라인 자리 */}
      <rect
        x="9.6"
        y="17.8"
        width="5.4"
        height="2"
        rx="1"
        className="fill-surface"
        transform="rotate(-17 12.25 14.5)"
      />
      {/* 작업대 */}
      <rect x="4" y="27" width="24" height="2" rx="1" fill="currentColor" opacity=".32" />
    </svg>
  );
}

/** 사이드바·상단에 놓이는 로고. 이름 텍스트 없이 마크만 세운다. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return <StudioMark size={size === "lg" ? 34 : 28} />;
}
