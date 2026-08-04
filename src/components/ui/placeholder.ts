/**
 * 아직 내용이 없는 자리를 나타내는 점선 박스.
 *
 * 사진 올리는 곳(`Dropzone`)과 카드가 나올 자리(`WorkbenchScreen`)가 화면에서 **나란히
 * 놓이므로 같은 골격이어야 한다.** 예전엔 모서리(`rounded-xl` vs `rounded-2xl`)와 세로
 * 여백(`py-14` vs `py-16`)이 달라 한쪽만 커 보였다 — 한 곳에 두어 다시 갈라지지 않게 한다.
 */
/**
 * 이 자리의 최소 높이. **점선 박스가 아닌 패널도 같은 자리에 오면 이 높이를 쓴다** —
 * 정보전달 만들기 화면의 '사진을 쓸지 고르기' 패널이 그렇다. 안 맞추면 왼쪽만 낮아
 * 오른쪽 카드 자리와 아래가 어긋난다(docs/ui-standards.md §3).
 */
export const PLACEHOLDER_MIN_H = "min-h-[19rem]";

export const PLACEHOLDER_BOX =
  `flex ${PLACEHOLDER_MIN_H} flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-hair px-6 py-14 text-center`;
