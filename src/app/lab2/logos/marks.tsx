/**
 * 서맘 스튜디오 로고 시안 6종.
 *
 * 축은 색이 아니라 **은유**다 — 무엇을 상징으로 삼는가. 여섯이 서로 다른 것을 말한다.
 *
 * 모두 `currentColor` 만 쓴다. 다만 채운 면 위에 뚫는 자리(헤드라인 막대 등)는 배경색이
 * 필요한데, 밝은 바탕과 어두운 바탕에서 그 색이 다르다. 그래서 `cut` 으로 받는다 —
 * 마스크를 쓰지 않은 이유는 22px 에서 마스크 경계가 흐려지기 때문이다.
 */

type MarkProps = { size?: number; label: string; cut?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 32 32",
  fill: "none" as const,
  role: "img" as const,
});

/** A — 기대어 선 두 장. ㅅ(서맘 초성) + 카드 두 장 + 받침선(작업대). */
export function MarkLean({ size = 32, label, cut = "fill-surface" }: MarkProps) {
  return (
    <svg {...base(size)} aria-label={label}>
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
      <rect x="7.5" y="4" width="9.5" height="21" rx="2.5" fill="currentColor" transform="rotate(-17 12.25 14.5)" />
      <rect x="9.6" y="17.8" width="5.4" height="2" rx="1" className={cut} transform="rotate(-17 12.25 14.5)" />
      <rect x="4" y="27" width="24" height="2" rx="1" fill="currentColor" opacity=".32" />
    </svg>
  );
}

/** B — 부채꼴 세 장. 넘어가는 순간을 정지시킨 형태. 카드뉴스는 넘겨 보는 매체다. */
export function MarkFan({ size = 32, label, cut = "fill-surface" }: MarkProps) {
  return (
    <svg {...base(size)} aria-label={label}>
      <rect
        x="11"
        y="7"
        width="10"
        height="19"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
        transform="rotate(-24 16 26)"
      />
      <rect
        x="11"
        y="7"
        width="10"
        height="19"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
        transform="rotate(24 16 26)"
      />
      <rect x="11" y="7" width="10" height="19" rx="2" fill="currentColor" />
      <rect x="13.2" y="20" width="5.6" height="2.2" rx="1.1" className={cut} />
    </svg>
  );
}

/** C — ㅅㅁ 모노그램. 사각 프레임(ㅁ) 안의 ㅅ. 서맘 두 초성이 카드 프레임과 겹친다. */
export function MarkMonogram({ size = 32, label }: MarkProps) {
  return (
    <svg {...base(size)} aria-label={label}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 10 L10.5 22 M16 10 L21.5 22"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** D — 접힌 모서리. 다음 장이 비치는 페이지 넘김 기호를 카드 비율로. */
export function MarkFold({ size = 32, label, cut = "fill-surface" }: MarkProps) {
  return (
    <svg {...base(size)} aria-label={label}>
      <path d="M6 5 H20.5 L26 10.5 V27 H6 Z" fill="currentColor" />
      <path d="M20.5 5 L26 10.5 H20.5 Z" className={cut} />
      <path d="M20.5 5 L26 10.5 H20.5 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="9.5" y="19" width="9" height="2.2" rx="1.1" className={cut} />
    </svg>
  );
}

/** E — 조리개. 사진에서 출발한다는 것을 말한다. 스튜디오의 도구 은유. */
export function MarkAperture({ size = 32, label }: MarkProps) {
  return (
    <svg {...base(size)} aria-label={label}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 9.5 L21.6 19.2 M21.6 19.2 L10.4 19.2 M10.4 19.2 L16 9.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(20 16 16)"
      />
      <circle cx="16" cy="16" r="1.9" fill="currentColor" />
    </svg>
  );
}

/** F — 카드 구조 그대로. 사진 밴드 + 헤드라인 + 본문. 산출물의 해부도가 곧 마크다. */
export function MarkAnatomy({ size = 32, label }: MarkProps) {
  return (
    <svg {...base(size)} aria-label={label}>
      <rect x="7" y="3.5" width="18" height="25" rx="3.5" stroke="currentColor" strokeWidth="1.9" />
      <rect x="10" y="6.5" width="12" height="9.5" rx="1.8" fill="currentColor" />
      <rect x="10" y="19" width="12" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="10" y="23.2" width="7.5" height="2.4" rx="1.2" fill="currentColor" opacity=".45" />
    </svg>
  );
}

export const LOGO_VARIANTS = [
  {
    id: "lean",
    name: "A 기대어 선 두 장",
    Mark: MarkLean,
    concept: "ㅅ(서맘 초성) + 카드 두 장 + 받침선",
    says: "서맘이 카드를 만든다. 인화지를 세워 말리는 작업실 풍경이기도 해요.",
    risk: "ㅅ으로 읽히려면 설명이 한 번 필요해요. 형태가 셋(획·카드·받침)이라 20px에서 가장 빡빡합니다.",
  },
  {
    id: "fan",
    name: "B 부채꼴 세 장",
    Mark: MarkFan,
    concept: "넘어가는 순간을 정지",
    says: "카드뉴스는 넘겨 보는 매체다 — 매체의 동작 자체가 상징.",
    risk: "카드 앱 일반의 형태라 이 도구만의 것이라고 하기엔 약합니다.",
  },
  {
    id: "monogram",
    name: "C ㅅㅁ 모노그램",
    Mark: MarkMonogram,
    concept: "사각 프레임(ㅁ) 안의 ㅅ",
    says: "서맘. 프레임이 카드이자 ㅁ이에요.",
    risk: "이름만 말하고 무엇을 만드는지는 말하지 않아요. 재생·플레이 아이콘으로 오독될 여지도 있습니다.",
  },
  {
    id: "fold",
    name: "D 접힌 모서리",
    Mark: MarkFold,
    concept: "다음 장이 비치는 페이지 넘김",
    says: "여러 장이 이어진다. 문서·페이지의 보편 기호라 즉시 읽혀요.",
    risk: "보편적이라 개성이 가장 약합니다. 파일 아이콘처럼 보일 수 있어요.",
  },
  {
    id: "aperture",
    name: "E 조리개",
    Mark: MarkAperture,
    concept: "사진에서 출발한다",
    says: "사진 작업실. 스튜디오라는 이름과 가장 직접 붙어요.",
    risk: "카메라 앱으로 읽힙니다. 이 도구는 촬영이 아니라 편집·생성이라 방향이 어긋날 수 있어요.",
  },
  {
    id: "anatomy",
    name: "F 카드 해부도",
    Mark: MarkAnatomy,
    concept: "사진 밴드 + 헤드라인 + 본문",
    says: "이 도구가 만드는 것 그 자체. 산출물의 구조가 곧 마크예요.",
    risk: "설명이 필요 없는 대신 서맘이라는 이름과의 연결은 없습니다.",
  },
] as const;
