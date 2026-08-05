import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { buildSellingUserContent, buildTopicCurationSystemPrompt, buildTopicCurationUserContent, CuratedTopicsSchema, curateTopicsWithClaude, friendlyTopicCurationError, TopicCurationSchemaMismatch } from "@/lib/topic-curation";
import { CliNotFound, CliTimeout, CliFailed, NoStructuredOutput } from "@/lib/claude-cli";
import type { YoutubeCandidate } from "@/lib/youtube-trending";

describe("buildTopicCurationUserContent", () => {
  it("후보 목록을 번호·제목·채널·카테고리로 정리한 텍스트 블록 하나로 만든다", () => {
    const candidates: YoutubeCandidate[] = [
      { videoId: "a", title: "제목1", channelTitle: "채널1", categoryId: "24" },
      { videoId: "b", title: "제목2", channelTitle: "채널2", categoryId: "22" },
    ];
    const blocks = buildTopicCurationUserContent(candidates);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    const text = blocks[0].type === "text" ? blocks[0].text : "";
    expect(text).toContain("제목1");
    expect(text).toContain("채널1");
    expect(text).toContain("24");
    expect(text).toContain("제목2");
  });
});

describe("buildTopicCurationSystemPrompt", () => {
  it("생활 정보 주제로만 추리고 연예·정치는 제외하라는 지시를 담는다", () => {
    const prompt = buildTopicCurationSystemPrompt();
    expect(prompt).toContain("30~40대");
    expect(prompt).toContain("생활");
    expect(prompt).toContain("정치");
  });
});

describe("buildTopicCurationSystemPrompt — 순위", () => {
  it("데이터랩이 없을 때 유일한 정렬 근거이므로 순위(rank)도 매기라는 지시를 담는다", () => {
    const prompt = buildTopicCurationSystemPrompt();
    expect(prompt).toContain("순위");
  });
});

describe("CuratedTopicsSchema", () => {
  it("키워드·이유·순위 배열을 통과시킨다", () => {
    const result = CuratedTopicsSchema.safeParse({
      topics: [{ keyword: "에어컨 전기세", reason: "여름철 생활비 관심사", rank: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("keyword가 없으면 거부한다", () => {
    const result = CuratedTopicsSchema.safeParse({ topics: [{ reason: "이유만 있음", rank: 1 }] });
    expect(result.success).toBe(false);
  });

  it("rank가 없으면 거부한다 — 데이터랩이 없을 때 유일한 정렬 근거다", () => {
    const result = CuratedTopicsSchema.safeParse({
      topics: [{ keyword: "에어컨 전기세", reason: "여름철 생활비 관심사" }],
    });
    expect(result.success).toBe(false);
  });
});

/** 주어진 node 코드를 본문으로 갖는 실행 가능한 stub 을 만들고 경로를 돌려준다.
 * `@/lib/claude-cli.test.ts`와 같은 방식 — 실제 claude CLI 를 호출하지 않는다. */
async function stub(body: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "topic-curation-stub-"));
  const file = path.join(dir, "fake-claude");
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

const candidates: YoutubeCandidate[] = [{ videoId: "a", title: "제목1", channelTitle: "채널1", categoryId: "24" }];

/**
 * stub 을 쓰므로 **Windows 에서 건너뛴다** — 이유는 `claude-cli.test.ts` 의 `itWithStub` 주석에
 * 적어 두었다(셰방을 Windows 가 읽지 않는다). 이 동작의 커버리지는 macOS·Linux 가 진다.
 */
describe.skipIf(process.platform === "win32")("curateTopicsWithClaude", () => {
  it("stub 이 스키마에 맞는 topics(rank 포함)를 내면 그대로 돌려준다", async () => {
    const command = await stub(
      `process.stdout.write(JSON.stringify({
        type: "result",
        is_error: false,
        structured_output: { topics: [{ keyword: "에어컨 전기세", reason: "여름철 관심사", rank: 1 }] },
      }) + "\\n")`,
    );

    const topics = await curateTopicsWithClaude(candidates, { command, timeoutMs: 5000 });

    expect(topics).toEqual([{ keyword: "에어컨 전기세", reason: "여름철 관심사", rank: 1 }]);
  });

  it("stub 이 스키마에 안 맞는 값(rank 없음)을 내면 TopicCurationSchemaMismatch 를 던진다", async () => {
    const command = await stub(
      `process.stdout.write(JSON.stringify({
        type: "result",
        is_error: false,
        structured_output: { topics: [{ keyword: "키", reason: "순위 없음" }] },
      }) + "\\n")`,
    );

    await expect(curateTopicsWithClaude(candidates, { command, timeoutMs: 5000 })).rejects.toBeInstanceOf(
      TopicCurationSchemaMismatch,
    );
  });
});

describe("friendlyTopicCurationError", () => {
  it("CliNotFound 는 CLI 설치 확인 안내를 준다", () => {
    expect(friendlyTopicCurationError(new CliNotFound("claude 실행 파일 없음"))).toContain("CLI");
  });

  it("CliTimeout 은 오래 걸렸다는 안내를 준다", () => {
    expect(friendlyTopicCurationError(new CliTimeout("제한 시간 초과"))).toContain("오래");
  });

  it("NoStructuredOutput·TopicCurationSchemaMismatch 는 결과가 예상과 안 맞다는 안내를 준다", () => {
    expect(friendlyTopicCurationError(new NoStructuredOutput("x"))).toContain("예상");
    expect(friendlyTopicCurationError(new TopicCurationSchemaMismatch("x"))).toContain("예상");
  });

  it("사용량 한도 CliFailed 는 한도 안내를 준다", () => {
    const msg = friendlyTopicCurationError(new CliFailed("Claude AI usage limit reached"));
    expect(msg).toContain("사용량 한도");
  });

  it("그 밖의 CliFailed 는 일반 실패 문구를 준다", () => {
    const msg = friendlyTopicCurationError(new CliFailed("boom"));
    expect(msg).not.toContain("boom");
    expect(msg).toContain("실패");
  });
});

/**
 * 후보의 **출처가 둘**이 됐다: 유튜브(보는 것)와 쿠팡(사는 것). 프롬프트가 그 차이를 말해
 * 주지 않으면 Claude 가 상품명을 그대로 주제로 뱉는다 — `제습기` 는 주제가 아니다.
 */
describe("쿠팡 후보로 만드는 사용자 내용", () => {
  const items = [
    { name: "휴대용 선풍기", category: "가전디지털" },
    { name: "스노클링 물안경", category: "스포츠/레저용품" },
  ];

  it("상품 이름과 카테고리를 담는다", () => {
    const text = buildSellingUserContent(items)[0];
    expect(text.type).toBe("text");
    expect(text.type === "text" && text.text).toContain("휴대용 선풍기");
    expect(text.type === "text" && text.text).toContain("스포츠/레저용품");
  });

  it("무엇을 뜻하는 목록인지 말해 준다 — '지금 팔리는 것'", () => {
    const text = buildSellingUserContent(items)[0];
    expect(text.type === "text" && text.text).toContain("팔린");
  });

  // 상품명을 그대로 주제로 뱉지 않게, 무엇을 하라는지 못 박는다.
  it("상품이 아니라 주제를 뽑으라고 말한다", () => {
    const text = buildSellingUserContent(items)[0];
    expect(text.type === "text" && text.text).toContain("상품 이름을 그대로");
  });

  it("빈 목록이면 던진다 — 근거 없이 주제를 지어내게 두지 않는다", () => {
    expect(() => buildSellingUserContent([])).toThrow();
  });
});
