export type Focal = { x: number; y: number };

export const DEFAULT_FOCAL: Focal = { x: 0.5, y: 0.5 };
/** 흰 텍스트가 사진 위에서 대비 4.5:1을 확보하는 하한 */
export const DEFAULT_SCRIM = 0.72;
/**
 * 사진 45% / 글 55%. 0.6 이면 글 영역이 372px 로 줄어 steps 를 가진 solution 카드(~935px 소요)가
 * CardFrame 의 overflow:hidden 에 잘려 나간다 — 에러 없이 PNG 만 깨지는 종류라 기본값으로 둘 수 없다.
 */
export const DEFAULT_BAND_CARDNEWS = 0.45;
export const DEFAULT_BAND_INFO = 0.35;

export type TextAlign = "left" | "center";
/** 헤드라인·본문(및 cta 알약·핸들) 정렬 기본값. cta 카드만 예외를 준다 — reducer.ts의 textAlignFor 참고 */
export const DEFAULT_TEXT_ALIGN: TextAlign = "left";
export const TEXT_ALIGNS: readonly TextAlign[] = ["left", "center"];
export const TEXT_ALIGN_LABELS: Record<TextAlign, string> = { left: "왼쪽", center: "가운데" };

export type HighlightSplit = { before: string; match: string; after: string };
/** 강조 없음(초기값) — CardDraft.highlight, RenderCard.highlight 의 기본값 */
export const DEFAULT_HIGHLIGHT = "";

/**
 * 헤드라인을 강조 문자열 기준으로 [앞·강조·뒤] 세 조각으로 나눈다. 좌표(인덱스)가 아니라
 * "글자"로 저장하므로(reducer의 CardDraft.highlight) 매 렌더마다 이 함수로 다시 찾는다 —
 * 헤드라인을 고쳐도 그 글자가 남아 있는 한 강조가 따라간다.
 *
 * 강조 문자열이 비었거나(indexOf 를 아예 안 부른다) 글에 없으면(indexOf === -1, 강조 문자열이
 * 글보다 길 때도 이 경로로 떨어진다) 조용히 강조 없음으로 본다 — 오류를 던지지 않는다. 헤드라인을
 * 고쳐 강조 글자가 사라져도 렌더가 깨지면 안 된다. 같은 글자가 여러 번 나오면 첫 번째만 찾는다
 * (String.indexOf 의 기본 동작 그대로).
 */
export function splitHighlight(text: string, highlight: string): HighlightSplit {
  if (highlight.length === 0) return { before: text, match: "", after: "" };
  const start = text.indexOf(highlight);
  if (start === -1) return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, start),
    match: text.slice(start, start + highlight.length),
    after: text.slice(start + highlight.length),
  };
}

export type TextScaleStep = "sm" | "md" | "lg";
export const TEXT_SCALE_STEPS: readonly TextScaleStep[] = ["sm", "md", "lg"];
export const TEXT_SCALE_LABELS: Record<TextScaleStep, string> = { sm: "작게", md: "보통", lg: "크게" };
/** 글자 크기 배수 기본값 — "보통"(지금 크기 그대로) */
export const DEFAULT_TEXT_SCALE = 1;

/**
 * 글자 크기 단계(작게/보통/크게) → 배수. `CardDraft.textScale` 에는 이 함수가 만든 값만 들어온다.
 * 출력(CardnewsBody)·캔버스(CardCanvas) 양쪽이 역할·레이아웃별로 이미 다른 실제 글꼴 크기에
 * 이 배수를 곱해 세 단계를 만든다 — 고정 크기를 넣으면 role/layout 마다 다른 지금의 크기 비율이
 * 깨진다.
 */
export function textScaleFor(step: TextScaleStep): number {
  if (step === "sm") return 0.85;
  if (step === "lg") return 1.2;
  return DEFAULT_TEXT_SCALE;
}

/** textScaleFor의 역함수 — 저장된 배수가 툴바에서 어느 단계로 눌려 있는지 판정한다. */
export function textScaleStepOf(scale: number): TextScaleStep {
  if (scale === textScaleFor("sm")) return "sm";
  if (scale === textScaleFor("lg")) return "lg";
  return "md";
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function objectPosition(focal: Focal): string {
  return `${Math.round(clamp01(focal.x) * 100)}% ${Math.round(clamp01(focal.y) * 100)}%`;
}

export type ScrimStop = { position: number; alpha: number };

/**
 * scrim(글 배경 어둠)의 정지점을 textY(글 덩어리의 세로 위치, 0=위 끝~1=아래 끝)에 앵커한다.
 * 어두운 마루가 p(=textY*100)에 있고 위아래로 34%p·68%p 씩 대칭으로 옅어진다.
 * 위치가 0 미만이거나 100 초과여도 자르지 않는다 — CSS 그라디언트는 화면 밖 정지점을 그대로
 * 보간하며, 억지로 0~100에 가두면(clamp) 마루 주변 기울기가 textY 값마다 달라진다.
 */
export function scrimStops(strength: number, textY: number): ScrimStop[] {
  const a = round2(clamp01(strength));
  const mid = round2(a * 0.75);
  const p = clamp01(textY) * 100;
  return [
    { position: round2(p - 68), alpha: 0 },
    { position: round2(p - 34), alpha: mid },
    { position: round2(p), alpha: a },
    { position: round2(p + 34), alpha: mid },
    { position: round2(p + 68), alpha: 0 },
  ];
}

export function scrimGradient(strength: number, textY: number): string {
  const stops = scrimStops(strength, textY)
    .map((s) => `rgba(0,0,0,${s.alpha}) ${s.position}%`)
    .join(", ");
  return `linear-gradient(to bottom, ${stops})`;
}

/**
 * 공백만 남은 글도 "비었다"고 본다 — 스페이스바만 누르고 지운 것도 삭제와 같은 결과라야 한다.
 * 헤드라인·본문·버튼 문구를 저장 이미지에서 뺄지(CardnewsBody), 캔버스에 자리 표시를 보일지
 * (CardCanvas) 판정하는 데 공용으로 쓴다.
 */
export function isBlankText(text: string): boolean {
  return text.trim().length === 0;
}

export type TextYSpacers = { top: number; bottom: number };

/**
 * 글 덩어리 위/아래에 두는 신축 여백의 flex-grow 비율. 이 값을 flex-basis:0 인 두 스페이서
 * div에 그대로 꽂으면(top=flexGrow, bottom=flexGrow) 남는 공간만 textY 비율대로 나뉜다.
 * 좌표로 잘라내는 대신 남는 공간을 나누므로 글이 길어도 카드 밖으로 넘치지 않는다.
 * textY=1 → 위 스페이서만 자라 지금의 justifyContent:flex-end 와 같다.
 * textY=0 → 아래 스페이서만 자라 flex-start 와 같다.
 *
 * 이 모델의 전제는 "글 덩어리는 자연 높이이고 스페이서만 남는 공간을 요구한다"이다. 글 덩어리
 * 자신이 이미 flex-grow 로 남는 공간을 요구하는 컨텐츠(InfographicBody의 아이템 목록 등)를
 * 감쌀 때는 top/bottom 을 각각 0 으로 호출해라 — 스페이서가 공간을 전혀 요구하지 않아야
 * 그 컨텐츠가 지금처럼 남는 공간을 전부 가져간다(CardRenderer.tsx 참고).
 */
export function textYSpacers(textY: number): TextYSpacers {
  const top = clamp01(textY);
  return { top: round2(top), bottom: round2(1 - top) };
}
