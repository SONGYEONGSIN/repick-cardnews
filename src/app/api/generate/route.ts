import { z } from "zod/v4";
import { InfographicSpec, CardnewsSpec } from "@/lib/schema";
import { stripEmojiDeep } from "@/lib/strip-emoji";
import { readVault, buildSystemPrompt, buildUserContent } from "@/lib/prompt";
import { runClaudeCli, NoStructuredOutput } from "@/lib/claude-cli";
import { friendlyGenerateError, SCHEMA_MISMATCH } from "@/lib/api-errors";

const MODEL = "claude-opus-4-8";
/** 실측 24초의 5배. 넘어가면 매달려 있느니 끊고 사용자에게 알린다. */
const TIMEOUT_MS = 120_000;

const BodySchema = z.object({
  keyword: z.string().trim().min(1, "키워드를 입력하세요").max(60),
  type: z.enum(["informationsend", "cardnews"]),
  // 허용 형식은 Anthropic이 base64 이미지로 받는 4종과 정확히 같아야 한다.
  // 더 넓게 열면 zod는 통과시키고 prompt.ts의 media type 가드가 던져서 400이어야 할 것이 500이 된다.
  photos: z
    .array(
      z
        .string()
        .regex(
          /^data:image\/(jpeg|png|gif|webp);base64,/,
          "사진은 jpeg·png·gif·webp 형식의 base64 dataURL이어야 합니다",
        ),
    )
    .max(6)
    .default([]),
});

export function parseBody(raw: unknown): z.infer<typeof BodySchema> {
  return BodySchema.parse(raw);
}

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = parseBody(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "잘못된 요청" }, { status: 400 });
  }

  const spec = body.type === "informationsend" ? InfographicSpec : CardnewsSpec;

  try {
    const vault = await readVault();
    const raw = await runClaudeCli({
      system: buildSystemPrompt(body.type, vault, body.photos.length > 0),
      content: buildUserContent(body.keyword, body.photos),
      jsonSchema: z.toJSONSchema(spec),
      model: MODEL,
      timeoutMs: TIMEOUT_MS,
    });

    // JSON Schema 는 모양만 강제한다. `.refine()`(첫 카드 hook / 마지막 cta)은
    // z.toJSONSchema 에서 탈락하므로 여기서 진짜 스키마로 다시 검증한다.
    // 이모지는 **검증 전에** 걷어낸다 — 시키지 않아도 얹어 오는데 카드에서는 제목을 한 줄
    // 더 밀어내고 팁 앞에 군더더기를 남긴다(`@/lib/strip-emoji`). 지운 뒤 길이 상한을
    // 넘는지 스키마가 다시 본다.
    const parsed = spec.safeParse(stripEmojiDeep(raw));
    if (!parsed.success) {
      return Response.json({ error: SCHEMA_MISMATCH }, { status: 502 });
    }
    return Response.json({ spec: parsed.data });
  } catch (e) {
    if (e instanceof NoStructuredOutput) {
      return Response.json({ error: SCHEMA_MISMATCH }, { status: 502 });
    }
    return Response.json({ error: friendlyGenerateError(e) }, { status: 500 });
  }
}
