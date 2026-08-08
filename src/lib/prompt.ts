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

/** Anthropic API 의 Messages 엔드포인트가 base64 이미지 source 로 허용하는 media type 4종 */
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function isImageMediaType(value: string): value is ImageMediaType {
  return value === "image/jpeg" || value === "image/png" || value === "image/gif" || value === "image/webp";
}

import type { InfoFormat } from "@/lib/schema";

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

/**
 * 형식별 생성 규칙. 담는 정보가 다르면 시키는 말도 달라야 한다 — 목록형 규칙 하나로 비교표를
 * 시키면 "왼쪽·오른쪽" 이 뭔지 모른 채 items 를 뱉는다.
 *
 * **요청 개수는 스키마 범위 안쪽으로 좁혀 잡는다.** 상한까지 채우면 카드에서 글자가 줄어들어
 * 읽기 어렵다 — 사용자가 직접 늘렸을 때만 그 상태가 되게 한다(`prompt.test.ts` 가 범위를 잠근다).
 */
const FORMAT_RULES: Record<InfoFormat, string> = {
  list: "items 3~4개(각 keyword+desc)를 생성하라.",
  compare:
    "columns.left/right 에 비교 대상 이름을 짧게 넣고, items 3~4개(각 label+left+right)를 생성하라. " +
    "label 은 비교 기준이며 **같은 기준으로 양쪽을 재라** — 한쪽만 좋게 쓰지 마라.",
  steps:
    "items 3~4개(각 keyword+desc)를 생성하라. **순서가 뜻을 가진다** — 앞 단계를 해야 다음 단계가 된다. " +
    "keyword 는 그 단계에서 할 일이다.",
  stat:
    "items 2~3개(각 value+label)를 생성하라. value 에는 숫자와 단위만 넣어라(예: 7%, 26℃, 2주) — " +
    "문장을 넣지 마라. label 은 그 숫자가 무엇인지 한 줄로.",
  check:
    "items 5~6개(각 text)를 생성하라. 각 항목은 한 줄 동작이다 — 설명을 붙이지 마라.",
};

export function buildSystemPrompt(
  type: "informationsend" | "cardnews",
  vault: { brandVoice: string; copyFormulas: string },
  hasPhotos: boolean,
  format: InfoFormat = "list",
  /**
   * 카드뉴스에서 만들 카드 수 — **올린 사진 수와 같다.** 안 주면 예전처럼 범위로 시킨다.
   *
   * 예전에는 "5~6장" 이 문장에 박혀 있어 사진을 3장만 올려도 카드가 5장 나왔고, 남는 카드가
   * 사진 없이 떴다. 사진 수를 그대로 시키면 그 어긋남이 없다.
   */
  cardCount?: number,
): string {
  // 스키마는 items 3~6 을 허용하지만 5개 이상은 사진 밴드를 최소로 줄여도 카드에 안 들어간다.
  // 생성 단계에서 3~4개를 요청해 평소엔 큰 글자가 나오게 하고, 사용자가 직접 늘렸을 때만 축소된다.
  const rule =
    type === "informationsend"
      ? `산출물 유형은 informationsend(1장 인포그래픽), 형식은 ${format}. title, 선택 subtitle, 선택 tip 과 함께 ${FORMAT_RULES[format]}`
      : `산출물 유형은 cardnews(설득 시퀀스). cards 배열을 ${
          cardCount === undefined ? "5~6장" : `정확히 ${cardCount}장`
        } 생성하라. 첫 카드는 반드시 role=hook, 마지막은 반드시 role=cta. 중간은 problem/evidence/solution 흐름.`;

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
