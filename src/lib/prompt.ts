import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readVault(dir?: string): Promise<{ brandVoice: string; copyFormulas: string }> {
  const base = dir ?? path.join(process.cwd(), "knowledge");
  const [brandVoice, copyFormulas] = await Promise.all([
    readFile(path.join(base, "brand-voice.md"), "utf8"),
    readFile(path.join(base, "copy-formulas.md"), "utf8"),
  ]);
  return { brandVoice, copyFormulas };
}

export function buildSystemPrompt(
  type: "informationsend" | "cardnews",
  vault: { brandVoice: string; copyFormulas: string },
): string {
  const rule =
    type === "informationsend"
      ? "산출물 유형은 informationsend(1장 인포그래픽). title, 선택 subtitle, items 3~6개(각 keyword+desc), 선택 tip을 생성하라."
      : "산출물 유형은 cardnews(5~6장 설득 시퀀스). cards 배열을 생성하라. 첫 카드는 반드시 role=hook, 마지막은 반드시 role=cta. 중간은 problem/evidence/solution 흐름.";

  return [
    "당신은 RE:픽의 인스타그램 콘텐츠 카피라이터입니다.",
    "아래 브랜드 보이스와 카피 공식을 반드시 지켜 한국어 카피를 작성하세요.",
    "",
    "=== 브랜드 보이스 ===",
    vault.brandVoice.trim(),
    "",
    "=== 카피 공식 ===",
    vault.copyFormulas.trim(),
    "",
    "=== 출력 규칙 ===",
    rule,
    "각 문자열은 스키마의 최대 길이를 넘지 않게 짧고 임팩트 있게. 이모지는 카드당 0~2개.",
  ].join("\n");
}
