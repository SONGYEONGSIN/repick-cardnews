import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
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

    // 같은 키워드·같은 날 폴더에 다시 저장하면 이전 회차의 남는 장(6장 → 5장이면 6.png)이 남아
    // 폴더가 원장의 count 와 어긋난다. 이번 장수보다 큰 번호의 png 만 지운다 —
    // 사용자가 폴더에 넣어 둔 다른 파일은 건드리지 않는다.
    for (const name of await readdir(absDir)) {
      const numbered = /^(\d+)\.png$/.exec(name);
      if (!numbered || Number(numbered[1]) <= body.images.length) continue;
      try {
        await unlink(path.join(absDir, name));
      } catch (e) {
        if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
      }
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
