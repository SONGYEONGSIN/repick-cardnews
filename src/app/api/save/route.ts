import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod/v4";
import { outputDir, outputFile } from "@/lib/paths";
import { appendLedger } from "@/lib/ledger";

const MODEL = "claude-opus-4-8";

const BodySchema = z.object({
  type: z.enum(["informationsend", "cardnews"]),
  keyword: z.string().min(1),
  mmdd: z.string().regex(/^\d{4}$/),
  images: z.array(z.string().min(1)).min(1).max(6),
  templateIds: z.array(z.string()),
});

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "잘못된 요청" }, { status: 400 });
  }

  try {
    const relDir = outputDir(body.type, body.keyword, body.mmdd);
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });

    const paths: string[] = [];
    for (let i = 0; i < body.images.length; i++) {
      const rel = outputFile(relDir, i + 1);
      await writeFile(path.join(process.cwd(), rel), Buffer.from(body.images[i], "base64"));
      paths.push(rel);
    }

    await appendLedger({
      ts: new Date().toISOString(),
      type: body.type,
      keyword: body.keyword,
      count: body.images.length,
      templateIds: body.templateIds,
      model: MODEL,
      paths,
      perf: null,
    });

    return Response.json({ dir: relDir, paths });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "저장 중 오류" }, { status: 500 });
  }
}
