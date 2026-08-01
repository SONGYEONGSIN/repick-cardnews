/**
 * 낱장 — 워드마크와 심볼.
 *
 * 이름: 기존 "콘티"는 영상·광고의 스토리보드 용어라 이 도구가 만드는 것(인스타 카드 세트)과
 * 어긋난다. "낱장"은 산출 단위 그 자체이고, 사진을 낱장으로 뽑아낸다는 인화 은유가 자연스럽다.
 *
 * 심볼: 겹친 낱장 세 장. 뒤 두 장은 선으로, 앞장만 채우고 그 안에 헤드라인 자리를 굵은 막대
 * 하나로 둔다 — 이 도구가 하는 일(사진 위에 글 한 줄을 얹어 낱장으로 만드는 것)이 형태로 읽힌다.
 * 무채색 원칙을 지켜 currentColor 만 쓰므로 어디에 놓아도 주변 색을 따라간다.
 */
export function NatjangMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* 뒤 두 장 — 겹쳐 밀린 낱장 */}
      <rect x="9.5" y="3.5" width="19" height="24" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity=".3" />
      <rect x="6" y="5.5" width="19" height="24" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      {/* 앞장 — 채운 면 위에 헤드라인 자리 */}
      <rect x="2.5" y="7.5" width="19" height="21" rx="2.5" fill="currentColor" />
      <rect x="6" y="21" width="12" height="3" rx="1.5" className="fill-surface" />
    </svg>
  );
}

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <NatjangMark size={size === "lg" ? 26 : 22} />
      <span className={`font-black tracking-tight ${size === "lg" ? "text-[21px]" : "text-[17px]"}`}>낱장</span>
    </span>
  );
}
