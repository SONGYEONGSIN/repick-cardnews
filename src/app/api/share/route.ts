import { z } from "zod/v4";
import { createShareToken, SHARE_TOKEN_TTL_MS } from "@/lib/share-token";
import { saveShare } from "@/lib/share-store";
import { findLanAddress } from "@/lib/lan-address";

/**
 * 폰으로 보내기 / 인스타 게시가 공유하는 기반 — 완성된 카드 PNG 들을 서버 메모리에 올리고
 * 1회용 토큰을 돌려준다. 이 라우트는 로컬 도구 안에서만 도는 것을 전제로 인증이 없다 —
 * 그 대신 토큰이 유일한 열쇠이므로 추측 불가능해야 한다(`@/lib/share-token`).
 *
 * 응답·오류 메시지는 전부 한국어여야 한다는 이 태스크의 제약 때문에, 옆의 save/generate
 * 라우트가 쓰는 `e.message` 그대로 노출 패턴은 따르지 않는다 — zod v4 의 `ZodError.message`
 * 는 JSON 블롭(영문 필드명 포함)이라 그대로 흘리면 "영어 원문·JSON 유출 금지"를 어긴다.
 * 대신 `parsed.error.issues[0].message`(이 저장소 zod 관례)만 꺼내 쓴다.
 */

const MAX_IMAGES = 6;
/** 1080×1350 PNG 한 장의 여유치. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEV_PORT = 3500;

const ImageSchema = z
  .string()
  .min(1, "이미지 데이터가 비어 있습니다")
  .refine((b64) => Buffer.byteLength(b64, "base64") <= MAX_IMAGE_BYTES, {
    message: `이미지 용량이 너무 큽니다 (장당 최대 ${MAX_IMAGE_BYTES / (1024 * 1024)}MB)`,
  });

const BodySchema = z.object({
  keyword: z.string().trim().min(1, "키워드를 입력하세요").max(60),
  images: z
    .array(ImageSchema)
    .min(1, "보낼 이미지가 없습니다")
    .max(MAX_IMAGES, `이미지는 최대 ${MAX_IMAGES}장까지 보낼 수 있습니다`),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const token = createShareToken();
    const issuedAt = Date.now();

    saveShare(token, {
      images: parsed.data.images.map((b64) => Buffer.from(b64, "base64")),
      keyword: parsed.data.keyword,
      issuedAt,
    });

    const host = findLanAddress();
    const link = host ? `http://${host}:${DEV_PORT}/s/${token}` : null;

    return Response.json({
      token,
      link,
      expiresAt: new Date(issuedAt + SHARE_TOKEN_TTL_MS).toISOString(),
    });
  } catch {
    return Response.json({ error: "공유 링크를 만들지 못했습니다" }, { status: 500 });
  }
}
