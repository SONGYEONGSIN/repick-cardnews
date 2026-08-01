/**
 * WCAG 2.x 명암비 계산.
 *
 * 토큰 램프가 접근성 기준을 만족하는지 테스트로 고정하기 위한 것이다 — 브라우저 없이
 * 결정론적으로 돌아야 해서 직접 구현한다.
 */

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`hex 색상이 아닙니다: ${hex}`);
  const body = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [
    Number.parseInt(body.slice(0, 2), 16),
    Number.parseInt(body.slice(2, 4), 16),
    Number.parseInt(body.slice(4, 6), 16),
  ];
}

/** 채널 하나를 sRGB 에서 선형 광량으로 되돌린다. */
function linearize(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
