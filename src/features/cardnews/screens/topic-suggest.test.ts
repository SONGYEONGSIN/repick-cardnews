import { buildTopicsQuery } from "@/features/cardnews/screens/material-finder";
import { describe, it, expect } from "vitest";
import {
  CANDIDATE_SOURCE,
  TOPICS_IDLE_HINT,
  candidateSourceLine,
  elapsedLabel,
  errorView,
  panelStatus,
  toTopicsView,
  waitingStatus,
} from "./topic-suggest";

/** 응답 형태의 근거는 `src/app/api/topics/route.ts` 뿐이다 — 그 라우트가 실제로 만드는 본문을 그대로 쓴다. */
const NOTE_DATALAB =
  "네이버 데이터랩 검색어트렌드에서 30~40대 여성 기준 상대 검색 비중을 조회해 정렬했어요(절대 검색량이 아니라 후보끼리의 상대 비교예요).";
const NOTE_NO_CONFIG =
  "네이버 데이터랩 검색어트렌드 설정이 없어 Claude가 판단한 관련성 순서로 정렬했어요(실제 검색 비중은 반영되지 않았어요).";
const NOTE_UNAVAILABLE =
  "네이버 데이터랩 검색어트렌드에 연결하지 못해 Claude가 판단한 관련성 순서로 정렬했어요 — 클라이언트 ID·시크릿 설정을 확인해 주세요(실제 검색 비중은 반영되지 않았어요).";

function okBody(extra: Record<string, unknown> = {}) {
  return {
    topics: [
      { keyword: "에어컨 전기세", reason: "이유1" },
      { keyword: "장마철 빨래", reason: "이유2" },
    ],
    rankedBy: "naver-datalab",
    note: NOTE_DATALAB,
    ...extra,
  };
}

describe("toTopicsView — 순위 근거 세 가지", () => {
  it("데이터랩으로 정렬됐으면 서버가 준 note 를 그대로 쓰고 확인이 필요한 상태로 보지 않는다", () => {
    const view = toTopicsView(200, okBody());

    expect(view.kind).toBe("results");
    if (view.kind !== "results") return;
    expect(view.basis.note).toBe(NOTE_DATALAB);
    expect(view.basis.needsAttention).toBe(false);
    expect(view.topics).toHaveLength(2);
  });

  it("네이버 설정이 없어 Claude 순서면 서버 note 그대로에 확인 필요는 아니다", () => {
    const view = toTopicsView(200, okBody({ rankedBy: "claude-no-naver-config", note: NOTE_NO_CONFIG }));

    expect(view.kind).toBe("results");
    if (view.kind !== "results") return;
    expect(view.basis.note).toBe(NOTE_NO_CONFIG);
    expect(view.basis.needsAttention).toBe(false);
  });

  it("설정은 있는데 연결하지 못한 경우만 확인이 필요한 상태로 표시한다", () => {
    const view = toTopicsView(200, okBody({ rankedBy: "claude-naver-unavailable", note: NOTE_UNAVAILABLE }));

    expect(view.kind).toBe("results");
    if (view.kind !== "results") return;
    expect(view.basis.needsAttention).toBe(true);
    // 문구는 서버 것을 그대로 — 화면이 새로 짓지 않는다.
    expect(view.basis.note).toBe(NOTE_UNAVAILABLE);
  });
});

describe("toTopicsView — 후보가 적거나 없을 때", () => {
  it("주제가 0개면 결과가 아니라 '없음' 상태로 판정하고 서버 message 를 보존한다", () => {
    const message = "오늘은 유튜브 인기 급상승 중 생활 정보로 다듬을 만한 주제가 없었어요. 잠시 후 다시 시도해 주세요.";
    const view = toTopicsView(200, { topics: [], rankedBy: "claude-no-naver-config", note: NOTE_NO_CONFIG, message });

    expect(view.kind).toBe("empty");
    if (view.kind !== "empty") return;
    expect(view.message).toBe(message);
  });

  it("일부만 가져왔으면 결과 상태이면서 서버 message 를 함께 들고 있다", () => {
    const view = toTopicsView(200, okBody({ message: "오늘은 생활 정보로 다듬을 만한 후보가 2개뿐이었어요." }));

    expect(view.kind).toBe("results");
    if (view.kind !== "results") return;
    expect(view.message).toBe("오늘은 생활 정보로 다듬을 만한 후보가 2개뿐이었어요.");
  });

  it("message 가 없으면 null 이다", () => {
    const view = toTopicsView(200, okBody());

    expect(view.kind).toBe("results");
    if (view.kind !== "results") return;
    expect(view.message).toBeNull();
  });

  it("건너뛴 유튜브 카테고리를 감추지 않고 그대로 들고 있다(없으면 빈 배열)", () => {
    const withSkip = toTopicsView(200, okBody({ skippedCategories: ["People & Blogs"] }));
    const without = toTopicsView(200, okBody());

    expect(withSkip.kind === "results" && withSkip.skipped).toEqual(["People & Blogs"]);
    expect(without.kind === "results" && without.skipped).toEqual([]);
  });
});

describe("toTopicsView — 오류는 언제나 한국어", () => {
  it("403(다른 기기)의 한국어 안내를 그대로 보여 준다", () => {
    const view = toTopicsView(403, { error: "트렌드 주제 가져오기는 이 컴퓨터의 브라우저에서만 할 수 있어요." });

    expect(view).toEqual({
      kind: "error",
      message: "트렌드 주제 가져오기는 이 컴퓨터의 브라우저에서만 할 수 있어요.",
    });
  });

  it("설정이 없다는 400 안내도 그대로 보여 준다", () => {
    const view = toTopicsView(400, { error: "트렌드 주제를 가져올 설정이 없어요: 유튜브 API 키(YOUTUBE_API_KEY)" });

    expect(view.kind).toBe("error");
    expect(view.kind === "error" && view.message).toContain("유튜브 API 키");
  });

  it("영문 오류가 오면 한국어 안내로 갈아 끼운다", () => {
    const view = toTopicsView(502, { error: "Internal Server Error" });

    expect(view.kind).toBe("error");
    expect(view.kind === "error" && view.message).not.toContain("Internal");
    expect(view.kind === "error" && /[가-힣]/.test(view.message)).toBe(true);
  });

  it("본문이 없거나 형태가 어긋나도 raw JSON 대신 한국어 안내를 준다", () => {
    for (const body of [null, {}, { topics: "nope" }, "<html>"]) {
      const view = toTopicsView(200, body);
      expect(view.kind).toBe("error");
      expect(view.kind === "error" && /[가-힣]/.test(view.message)).toBe(true);
    }
  });

  it("errorView 는 브라우저가 던진 영문(Failed to fetch)을 한국어로 바꾼다", () => {
    expect(/[가-힣]/.test(errorView("Failed to fetch").message)).toBe(true);
    expect(errorView("Failed to fetch").message).not.toContain("fetch");
  });
});

describe("기다리는 동안 보여 줄 문구", () => {
  it("시작 전 안내는 버튼을 눌러야 시작한다는 것과 예상 시간을 함께 말한다", () => {
    expect(TOPICS_IDLE_HINT).toContain("1분 40초");
    expect(/[가-힣]/.test(TOPICS_IDLE_HINT)).toBe(true);
  });

  it("예상 시간 안쪽에서는 얼마나 걸리는지 미리 알려 준다", () => {
    expect(waitingStatus(0)).toContain("1분 40초");
  });

  it("예상 시간을 넘기면 멈춘 게 아니라 더 걸리는 중임을 말한다", () => {
    expect(waitingStatus(120)).not.toBe(waitingStatus(0));
    expect(waitingStatus(120)).toContain("조금 더");
  });

  it("경과 시간은 분·초로 읽는다", () => {
    expect(elapsedLabel(0)).toBe("0초");
    expect(elapsedLabel(12)).toBe("12초");
    expect(elapsedLabel(60)).toBe("1분");
    expect(elapsedLabel(100)).toBe("1분 40초");
    expect(elapsedLabel(-3)).toBe("0초");
  });
});

describe("panelStatus — 스크린리더에 읽힐 한 줄", () => {
  it("결과가 있고 아직 고르지 않았으면 개수와 고르는 방법을 말한다", () => {
    const view = toTopicsView(200, okBody());
    expect(panelStatus(view, "")).toContain("2개");
  });

  it("고른 주제가 있으면 주제 칸에 들어갔다는 것과 바꿀 수 있다는 것을 말한다", () => {
    const view = toTopicsView(200, okBody());
    const line = panelStatus(view, "에어컨 전기세");

    expect(line).toContain("에어컨 전기세");
    expect(line).toContain("바꿀");
  });

  it("공백만 다른 입력도 고른 것으로 본다", () => {
    const view = toTopicsView(200, okBody());
    expect(panelStatus(view, "  에어컨 전기세 ")).toContain("에어컨 전기세");
  });

  it("없음 상태에서는 서버 설명에 직접 입력하라는 안내를 덧붙인다", () => {
    const view = toTopicsView(200, {
      topics: [],
      rankedBy: "claude-no-naver-config",
      note: NOTE_NO_CONFIG,
      message: "오늘은 마땅한 주제가 없었어요.",
    });

    const line = panelStatus(view, "");
    expect(line).toContain("오늘은 마땅한 주제가 없었어요.");
    expect(line).toContain("직접 입력");
  });

  it("오류 상태에서는 오류 문구를 그대로 읽는다", () => {
    const view = errorView("잠깐 문제가 있었어요.");
    expect(panelStatus(view, "")).toBe("잠깐 문제가 있었어요.");
  });
});

describe("출처 표시 — 어디서 가져온 주제인지", () => {
  it("후보 출처는 언제나 유튜브다 — 순위 근거와 헷갈리지 않게 이름을 못 박는다", () => {
    expect(CANDIDATE_SOURCE).toContain("유튜브");
    expect(CANDIDATE_SOURCE).toContain("인기 급상승");
  });

  it("누르기 전 안내가 두 출처의 역할을 모두 밝힌다 — 유튜브는 후보, 데이터랩은 순위", () => {
    expect(TOPICS_IDLE_HINT).toContain("유튜브");
    // 데이터랩에는 검색어트렌드와 쇼핑인사이트가 있다 — 어느 쪽인지까지 말해야 한다.
    expect(TOPICS_IDLE_HINT).toContain("검색어트렌드");
  });

  it("가져온 뒤에는 실제로 쓴 카테고리 이름을 붙여 준다", () => {
    const view = toTopicsView(200, okBody({ sourceCategories: ["살림·요리·꿀팁", "일상·브이로그"] }));

    expect(candidateSourceLine(view)).toBe(`${CANDIDATE_SOURCE} · 살림·요리·꿀팁, 일상·브이로그`);
  });

  it("카테고리 정보가 없으면 출처 이름만 말한다 — 빈 구분자를 남기지 않는다", () => {
    expect(candidateSourceLine(toTopicsView(200, okBody()))).toBe(CANDIDATE_SOURCE);
  });

  it("주제가 0개여도 어디서 찾아봤는지는 밝힌다 — 빈손인 이유를 알아야 한다", () => {
    const view = toTopicsView(200, { topics: [], sourceCategories: ["살림·요리·꿀팁"] });

    expect(view.kind).toBe("empty");
    expect(candidateSourceLine(view)).toBe(`${CANDIDATE_SOURCE} · 살림·요리·꿀팁`);
  });

  it("오류일 때는 출처를 말하지 않는다 — 아무것도 가져오지 못했다", () => {
    expect(candidateSourceLine(errorView("실패했어요"))).toBeNull();
  });
});

// 쇼핑인사이트도 검색어트렌드와 **같은 성격의 실패**다 — 서버가 둘 다 "자격 증명을 확인해
// 주세요"라고 말한다. 한쪽만 눈에 띄게 표시하면 쇼핑 렌즈를 쓴 사람은 신호를 덜 받는다.
describe("needsAttention — 사용자가 할 일이 있는 실패만 눈에 띄게", () => {
  it("쇼핑인사이트 연결 실패도 확인이 필요한 상태로 표시한다", () => {
    const view = toTopicsView(
      200,
      okBody({
        rankedBy: "claude-shopping-unavailable",
        note: "네이버 데이터랩 쇼핑인사이트에 연결하지 못해 Claude가 판단한 관련성 순서로 정렬했어요 — 클라이언트 ID·시크릿 설정을 확인해 주세요(실제 검색 비중은 반영되지 않았어요).",
      }),
    );

    expect(view.kind === "results" && view.basis.needsAttention).toBe(true);
  });

  it("정상 경로들은 눈에 띄게 하지 않는다", () => {
    for (const rankedBy of ["naver-datalab", "naver-shopping", "claude-no-naver-config", "claude-lens-chosen"]) {
      const view = toTopicsView(200, okBody({ rankedBy }));
      expect(view.kind === "results" && view.basis.needsAttention).toBe(false);
    }
  });
});

/**
 * 후보 출처가 둘이 됐다 — 유튜브(보는 것)와 쿠팡(사는 것). 순위를 매기는 자(렌즈)는 그대로
 * 공유한다: 출처가 바뀌었다고 자가 달라지면 두 결과를 견줄 수 없다.
 */
describe("buildTopicsQuery — 출처", () => {
  it("기본은 유튜브다 — 지금까지와 같다", () => {
    const q = new URLSearchParams(buildTopicsQuery("search-trend", ""));
    expect(q.get("source")).toBe("youtube");
  });

  it("잘 팔리는 것을 고르면 source=selling 이다", () => {
    const q = new URLSearchParams(buildTopicsQuery("search-trend", "", "selling"));
    expect(q.get("source")).toBe("selling");
  });

  it("출처를 바꿔도 렌즈는 그대로 실려 간다", () => {
    const q = new URLSearchParams(buildTopicsQuery("shopping", "50000006", "selling"));
    expect(q.get("lens")).toBe("shopping");
    expect(q.get("shoppingCategory")).toBe("50000006");
  });
});
