/**
 * 편집 워크벤치 시안용 결정론적 샘플.
 *
 * 사진은 토큰 배경으로 대체한 자리표시자다 — 실제 사진이 들어가면 화면의 인상이 크게
 * 달라진다. 구조를 고르는 데는 충분하지만, 색·대비의 최종 판단은 실사진으로 다시 봐야 한다.
 */

export type SampleCard = {
  id: string;
  role: string;
  roleLabel: string;
  heading: string;
  body?: string;
  action?: string;
  layout: "full-bleed" | "split" | "text-only";
  /** 사진 자리표시자의 톤 — 실제로는 업로드된 사진이 들어간다 */
  tone: "a" | "b" | "c";
};

export const SAMPLE_CARDS: readonly SampleCard[] = [
  {
    id: "c1",
    role: "hook",
    roleLabel: "후크",
    heading: "이거 모르면 전기세 두 배 나와요",
    body: undefined,
    layout: "full-bleed",
    tone: "a",
  },
  {
    id: "c2",
    role: "problem",
    roleLabel: "문제",
    heading: "껐다 켰다, 오히려 손해예요",
    body: "재가동할 때 전력이 크게 들어요. 잠깐 나갈 땐 끄지 말고 온도만 높여두는 게 더 이득이에요.",
    layout: "split",
    tone: "b",
  },
  {
    id: "c3",
    role: "evidence",
    roleLabel: "근거",
    heading: "전기세 적은 집의 공통점",
    body: "설정 온도를 24~26℃로 유지하고, 2주에 한 번 필터를 청소해요. 필터 관리만으로 전력 5% 절약돼요.",
    layout: "split",
    tone: "c",
  },
  {
    id: "c4",
    role: "solution",
    roleLabel: "해법",
    heading: "전기세 줄이는 4가지 방법",
    body: "오늘부터 이렇게 해보세요. 순서대로만 지켜도 체감이 달라요.",
    layout: "text-only",
    tone: "a",
  },
  {
    id: "c5",
    role: "cta",
    roleLabel: "행동",
    heading: "저장하고 이번 여름 아껴봐요",
    action: "지금 저장하기",
    layout: "full-bleed",
    tone: "b",
  },
];

/** 아직 슬롯에 안 들어간 사진들 */
export const UNUSED_PHOTOS = [
  { id: "p6", name: "IMG_2041.jpg", tone: "c" as const },
  { id: "p7", name: "IMG_2042.jpg", tone: "a" as const },
  { id: "p8", name: "IMG_2055.jpg", tone: "b" as const },
];

/** 사진 자리표시자의 배경 — 토큰만 쓴다 */
export const TONE_CLASS: Record<SampleCard["tone"], string> = {
  a: "bg-plum/25",
  b: "bg-ink/15",
  c: "bg-plum/10",
};

export const LAYOUT_LABEL: Record<SampleCard["layout"], string> = {
  "full-bleed": "가득",
  split: "분할",
  "text-only": "글만",
};

export const THEMES = [
  { id: "violet-doodle", label: "보라 두들" },
  { id: "mint-clean", label: "민트 클린" },
  { id: "mono-bold", label: "모노 볼드" },
] as const;
