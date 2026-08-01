/**
 * 서맘 스튜디오 — 워드마크와 심볼.
 *
 * 이름: 이건 남에게 파는 제품이 아니라 본인 작업실이다. 그래서 범용적인 이름 대신 만드는
 * 사람의 이름을 쓴다. 다섯 음절이라 그냥 늘어놓으면 마크가 눌리므로 **굵기로 주종을 만든다** —
 * `서맘`은 900, `스튜디오`는 400 에 보조색. 이 디자인이 색 없이 굵기로 위계를 세우는 체계라
 * 락업도 같은 규칙을 따른다.
 *
 * 심볼: 겹친 낱장 세 장. 뒤 두 장은 선으로, 앞장만 채우고 그 안에 헤드라인 자리를 굵은 막대
 * 하나로 둔다 — 이 도구가 하는 일(사진 위에 글 한 줄을 얹어 낱장으로 만드는 것)이 형태로 읽힌다.
 * 이름이 바뀌어도 마크는 유지한다. 마크는 이름이 아니라 산출물을 말해야 한다.
 * 무채색 원칙을 지켜 currentColor 만 쓰므로 어디에 놓아도 주변 색을 따라간다.
 */
export function StudioMark({ size = 22 }: { size?: number }) {
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
  const lg = size === "lg";
  return (
    <span className="flex items-center gap-2.5">
      <StudioMark size={lg ? 26 : 22} />
      <span className={`flex items-baseline gap-1.5 tracking-tight ${lg ? "text-[21px]" : "text-[17px]"}`}>
        <span className="font-black">서맘</span>
        <span className={`font-normal text-ink-2 ${lg ? "text-[15px]" : "text-[13px]"}`}>스튜디오</span>
      </span>
    </span>
  );
}
