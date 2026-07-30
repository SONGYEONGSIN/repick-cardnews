import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseDataUrl } from "@/lib/photos";

export async function readVault(dir?: string): Promise<{ brandVoice: string; copyFormulas: string }> {
  const base = dir ?? path.join(process.cwd(), "knowledge");
  const [brandVoice, copyFormulas] = await Promise.all([
    readFile(path.join(base, "brand-voice.md"), "utf8"),
    readFile(path.join(base, "copy-formulas.md"), "utf8"),
  ]);
  return { brandVoice, copyFormulas };
}

/** Anthropic SDK가 허용하는 base64 이미지 media type (Base64ImageSource.media_type 리터럴 유니온과 동일) */
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function isImageMediaType(value: string): value is ImageMediaType {
  return value === "image/jpeg" || value === "image/png" || value === "image/gif" || value === "image/webp";
}

export type ContentBlock =
  | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
  | { type: "text"; text: string };

const PHOTO_RULES: Record<"informationsend" | "cardnews", string> = {
  cardnews:
    "첨부된 N번째 사진이 N번째 카드에 쓰입니다. 각 카드의 카피는 그 카드의 사진에 실제로 보이는 것에 근거해 쓰세요.",
  informationsend:
    "첨부된 사진 1장은 이 인포그래픽의 대표 이미지입니다. title·subtitle이 사진과 어긋나지 않게 쓰고, items는 키워드 주제를 따르세요.",
};

const PHOTO_RULE_COMMON = "사진에 보이지 않는 것을 사실처럼 쓰지 마세요.";

export function buildSystemPrompt(
  type: "informationsend" | "cardnews",
  vault: { brandVoice: string; copyFormulas: string },
  hasPhotos: boolean,
): string {
  const rule =
    type === "informationsend"
      ? "산출물 유형은 informationsend(1장 인포그래픽). title, 선택 subtitle, items 3~6개(각 keyword+desc), 선택 tip을 생성하라."
      : "산출물 유형은 cardnews(5~6장 설득 시퀀스). cards 배열을 생성하라. 첫 카드는 반드시 role=hook, 마지막은 반드시 role=cta. 중간은 problem/evidence/solution 흐름.";

  const lines = [
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
  ];

  if (hasPhotos) {
    lines.push("", "=== 사진 규칙 ===", PHOTO_RULES[type], PHOTO_RULE_COMMON);
  }

  return lines.join("\n");
}

export function buildUserContent(keyword: string, photos: readonly string[]): ContentBlock[] {
  const blocks: ContentBlock[] = photos.map((dataUrl) => {
    const { mediaType, base64 } = parseDataUrl(dataUrl);
    if (!isImageMediaType(mediaType)) {
      throw new Error(`지원하지 않는 이미지 형식입니다: ${mediaType}`);
    }
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  });

  const text =
    photos.length > 0
      ? `키워드: "${keyword}"\n첨부한 사진 ${photos.length}장은 순서대로 1번부터 ${photos.length}번입니다.\n위 키워드와 사진으로 콘텐츠 카피를 생성하세요.`
      : `키워드: "${keyword}"\n위 키워드로 콘텐츠 카피를 생성하세요.`;

  blocks.push({ type: "text", text });
  return blocks;
}
