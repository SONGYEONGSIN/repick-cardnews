import Anthropic from "@anthropic-ai/sdk";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { InfographicSpec, CardnewsSpec, type ContentSpec } from "@/lib/schema";
import { readVault, buildSystemPrompt } from "@/lib/prompt";

const MODEL = "claude-opus-4-8";

const BodySchema = z.object({
  keyword: z.string().trim().min(1, "키워드를 입력하세요").max(60),
  type: z.enum(["informationsend", "cardnews"]),
});

export function parseBody(raw: unknown): z.infer<typeof BodySchema> {
  return BodySchema.parse(raw);
}

// 설치된 @anthropic-ai/sdk@0.69.0의 helpers/beta/zod는 zod v4 네이티브 toJSONSchema를
// 요구하지만 이 프로젝트는 zod v3(^3.24.1)를 사용한다. 동일한 구조(type/schema/parse)를
// zod-to-json-schema(v3 호환) + SDK 내장 strict-schema 변환기로 직접 구성해 대체한다.
function outputFormat<T>(schema: z.ZodType<T>): {
  type: "json_schema";
  schema: Record<string, unknown>;
  parse: (content: string) => T;
} {
  return {
    type: "json_schema",
    schema: transformJSONSchema(zodToJsonSchema(schema)),
    parse: (content: string) => schema.parse(JSON.parse(content)),
  };
}

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = parseBody(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "잘못된 요청" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const vault = await readVault();
    const system = buildSystemPrompt(body.type, vault);
    const format: z.ZodType<ContentSpec> =
      body.type === "informationsend" ? InfographicSpec : CardnewsSpec;

    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: `키워드: "${body.keyword}"\n위 키워드로 콘텐츠 카피를 생성하세요.` }],
      output_format: outputFormat(format),
    });

    const spec = response.parsed_output as ContentSpec | null;
    if (!spec) {
      return Response.json({ error: "카피 생성 결과가 스키마와 맞지 않습니다. 다시 시도해주세요." }, { status: 502 });
    }
    return Response.json({ spec });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "생성 중 오류" }, { status: 500 });
  }
}
