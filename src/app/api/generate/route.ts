import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { InfographicSpec, CardnewsSpec, type ContentSpec } from "@/lib/schema";
import { readVault, buildSystemPrompt, buildUserContent } from "@/lib/prompt";
import { resolveAuthMode, oauthToken } from "@/lib/auth";

const MODEL = "claude-opus-4-8";

const BodySchema = z.object({
  keyword: z.string().trim().min(1, "키워드를 입력하세요").max(60),
  type: z.enum(["informationsend", "cardnews"]),
  photos: z
    .array(z.string().regex(/^data:image\/[a-z+]+;base64,/, "사진은 base64 dataURL이어야 합니다"))
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

  const mode = resolveAuthMode(process.env);
  if (mode === "none") {
    return Response.json(
      {
        error:
          "Claude 인증이 필요합니다. API 키(ANTHROPIC_API_KEY) 또는 OAuth 토큰(ANTHROPIC_AUTH_TOKEN)을 .env.local에 설정하세요. Claude Pro/Max면 `claude setup-token`으로 토큰을 발급할 수 있습니다.",
      },
      { status: 500 },
    );
  }

  try {
    const vault = await readVault();
    const system = buildSystemPrompt(body.type, vault, body.photos.length > 0);

    const client =
      mode === "oauth"
        ? new Anthropic({
            authToken: oauthToken(process.env),
            defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
          })
        : new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: buildUserContent(body.keyword, body.photos) }],
      output_config: {
        format: zodOutputFormat(body.type === "informationsend" ? InfographicSpec : CardnewsSpec),
      },
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
