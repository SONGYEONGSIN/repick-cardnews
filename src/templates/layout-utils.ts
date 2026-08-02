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

export type TextYSpacers = { top: number; bottom: number };

/**
 * 글 덩어리 위/아래에 두는 신축 여백의 flex-grow 비율. 이 값을 flex-basis:0 인 두 스페이서
 * div에 그대로 꽂으면(top=flexGrow, bottom=flexGrow) 남는 공간만 textY 비율대로 나뉜다.
 * 좌표로 잘라내는 대신 남는 공간을 나누므로 글이 길어도 카드 밖으로 넘치지 않는다.
 * textY=1 → 위 스페이서만 자라 지금의 justifyContent:flex-end 와 같다.
 * textY=0 → 아래 스페이서만 자라 flex-start 와 같다.
 */
export function textYSpacers(textY: number): TextYSpacers {
  const top = clamp01(textY);
  return { top: round2(top), bottom: round2(1 - top) };
}
