import { z } from "zod/v4";
import { CardnewsSpec, INFO_FORMATS, infoSpecFor, type InfoFormat } from "@/lib/schema";
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
  // 정보전달 형식. 사용자가 고른 값이라 서버가 안다 — 모델 응답에 없으면 이 값으로 채운다.
  format: z.enum(INFO_FORMATS.map((f) => f.id) as [InfoFormat, ...InfoFormat[]]).default("list"),
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
  /**
   * 참고 이미지 — **카드에 실리지 않는다.** 카피를 쓸 때 말투·구성만 참고한다
   * (`buildUserContent` 주석 참고). 사진과 같은 형식·같은 상한을 쓴다.
   */
  references: z
    .array(
      z
        .string()
        .regex(
          /^data:image\/(jpeg|png|gif|webp);base64,/,
          "참고 이미지는 jpeg·png·gif·webp 형식의 base64 dataURL이어야 합니다",
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

  // 형식 하나짜리 스키마를 넘긴다 — union 은 도구 스키마로 못 쓴다(`infoSpecFor` 주석 참고).
  const spec = body.type === "informationsend" ? infoSpecFor(body.format) : CardnewsSpec;

  try {
    const vault = await readVault();
    const raw = await runClaudeCli({
      // 카드뉴스는 **올린 사진 수만큼** 카드를 만든다 — 남는 카드가 사진 없이 뜨지 않게.
      // 정보전달은 1장이라 장수 개념이 없다.
      system: buildSystemPrompt(
        body.type,
        vault,
        body.photos.length > 0,
        body.format,
        body.type === "cardnews" && body.photos.length > 0 ? body.photos.length : undefined,
      ),
      content: buildUserContent(body.keyword, body.photos, body.references),
      jsonSchema: z.toJSONSchema(spec),
      model: MODEL,
      timeoutMs: TIMEOUT_MS,
    });

    // JSON Schema 는 모양만 강제한다. `.refine()`(첫 카드 hook / 마지막 cta)은
    // z.toJSONSchema 에서 탈락하므로 여기서 진짜 스키마로 다시 검증한다.
    // 이모지는 **검증 전에** 걷어낸다 — 시키지 않아도 얹어 오는데 카드에서는 제목을 한 줄
    // 더 밀어내고 팁 앞에 군더더기를 남긴다(`@/lib/strip-emoji`). 지운 뒤 길이 상한을
    // 넘는지 스키마가 다시 본다.
    // 형식(판별자)이 빠져 있으면 채운다 — 그것 하나 때문에 100초를 버리지 않는다.
    const filled =
      body.type === "informationsend" && typeof raw === "object" && raw !== null && !("format" in raw)
        ? { ...raw, format: body.format }
        : raw;
    const parsed = spec.safeParse(stripEmojiDeep(filled));
    if (!parsed.success) {
      // 어느 칸이 어긋났는지 남긴다 — 모델이 무엇을 잘못 냈는지 알아야 프롬프트를 고친다.
      console.error(
        "[카피 스키마 불일치]",
        parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join(" · "),
      );
      return Response.json({ error: SCHEMA_MISMATCH }, { status: 502 });
    }
    return Response.json({ spec: parsed.data });
  } catch (e) {
    // 사용자에게는 한국어 안내만 간다. **왜 실패했는지는 서버 콘솔에만** 남긴다 — 안 남기면
    // 원인을 알 길이 없다(인스타 게시에서 같은 일을 겪었다, 2026-08-05).
    console.error("[카피 생성 실패]", e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 500) : String(e).slice(0, 500));
    if (e instanceof NoStructuredOutput) {
      return Response.json({ error: SCHEMA_MISMATCH }, { status: 502 });
    }
    return Response.json({ error: friendlyGenerateError(e) }, { status: 500 });
  }
}
