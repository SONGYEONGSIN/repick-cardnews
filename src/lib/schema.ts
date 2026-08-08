import { z } from "zod/v4";

/**
 * 정보전달 **형식 다섯**. 담는 정보의 모양이 다르면 형식도 다르다 — 비교("A vs B")나
 * 수치("1도에 7%")를 목록형 설명 안에 뭉개 넣던 것을 갈랐다(2026-08-05).
 *
 * **배열 이름은 다섯 모두 `items`** 다. 항목 한 개의 모양만 다르다. 그래야 reducer 의
 * 추가·삭제·정렬이 형식과 무관하게 그대로 돈다 — 이름을 형식마다 다르게 두면 그 네 동작을
 * 형식 수만큼 복제해야 한다. 설계: `docs/superpowers/specs/2026-08-05-infosend-formats-design.md`
 */
export const INFO_FORMATS = [
  { id: "list", label: "목록", note: "팁을 나열해요" },
  { id: "compare", label: "비교", note: "둘 중 무엇이 나은지" },
  { id: "steps", label: "순서", note: "따라 하는 법" },
  { id: "stat", label: "숫자", note: "수치가 곧 메시지" },
  { id: "check", label: "체크리스트", note: "설명 없이 목록만" },
] as const;

export type InfoFormat = (typeof INFO_FORMATS)[number]["id"];

/** 형식마다 담을 수 있는 항목 수. 화면(고르기·점검)과 스키마가 같은 값을 쓴다. */
const ITEM_RANGES: Record<InfoFormat, { min: number; max: number }> = {
  list: { min: 3, max: 6 },
  compare: { min: 3, max: 5 },
  steps: { min: 3, max: 5 },
  stat: { min: 2, max: 3 },
  check: { min: 4, max: 8 },
};

export function itemRangeOf(format: InfoFormat): { min: number; max: number } {
  return ITEM_RANGES[format];
}

/**
 * 항목 한 개가 담은 **글들**. 형식마다 칸 이름이 다르지만(`keyword/desc` ·
 * `label/left/right` · `value/label` · `text`) 점검과 캡션은 이름을 알 필요가 없다 —
 * 글만 필요하다. 첫 글이 그 항목의 대표다.
 */
export function itemTexts(item: InfoItem): string[] {
  if ("text" in item) return [item.text];
  if ("value" in item) return [item.value, item.label];
  if ("left" in item) return [item.label, item.left, item.right];
  return [item.keyword, item.desc];
}

/** 칸마다 허용 길이. **`itemTexts` 와 같은 순서·같은 개수**여야 한다 — 어긋나면 엉뚱한 칸을 잰다. */
const ITEM_FIELD_MAXES: Record<InfoFormat, readonly number[]> = {
  list: [30, 120],
  compare: [20, 40, 40],
  steps: [30, 120],
  stat: [8, 40],
  check: [40],
};

export function itemFieldMaxes(format: InfoFormat): readonly number[] {
  return ITEM_FIELD_MAXES[format];
}

const commonInfoFields = {
  type: z.literal("informationsend"),
  title: z.string().min(1).max(40),
  subtitle: z.string().max(60).optional(),
  tip: z.string().max(120).optional(),
};

function itemsOf<T extends z.ZodTypeAny>(item: T, format: InfoFormat) {
  const { min, max } = ITEM_RANGES[format];
  return z.array(item).min(min).max(max);
}

const ListSpec = z.object({
  ...commonInfoFields,
  format: z.literal("list"),
  items: itemsOf(z.object({ keyword: z.string().min(1).max(30), desc: z.string().min(1).max(120) }), "list"),
});

const CompareSpec = z.object({
  ...commonInfoFields,
  format: z.literal("compare"),
  columns: z.object({ left: z.string().min(1).max(16), right: z.string().min(1).max(16) }),
  items: itemsOf(
    z.object({
      label: z.string().min(1).max(20),
      left: z.string().min(1).max(40),
      right: z.string().min(1).max(40),
    }),
    "compare",
  ),
});

const StepsSpec = z.object({
  ...commonInfoFields,
  format: z.literal("steps"),
  items: itemsOf(z.object({ keyword: z.string().min(1).max(30), desc: z.string().min(1).max(120) }), "steps"),
});

const StatSpec = z.object({
  ...commonInfoFields,
  format: z.literal("stat"),
  // value 는 숫자와 단위만(`7%`·`26℃`·`2주`) — 문장을 넣으면 크게 그릴 수 없다.
  items: itemsOf(z.object({ value: z.string().min(1).max(8), label: z.string().min(1).max(40) }), "stat"),
});

const CheckSpec = z.object({
  ...commonInfoFields,
  format: z.literal("check"),
  items: itemsOf(z.object({ text: z.string().min(1).max(40) }), "check"),
});

export const InfographicSpec = z.discriminatedUnion("format", [
  ListSpec,
  CompareSpec,
  StepsSpec,
  StatSpec,
  CheckSpec,
]);

/** 형식 하나짜리 스키마. `InfographicSpec` 의 같은 갈래다 — 두 자가 어긋나지 않게 여기서 꺼낸다. */
const SPEC_BY_FORMAT = {
  list: ListSpec,
  compare: CompareSpec,
  steps: StepsSpec,
  stat: StatSpec,
  check: CheckSpec,
} as const;

/**
 * 모델에게 넘길 스키마. **union 을 그대로 넘기면 안 된다** — Claude CLI 는 스키마를 도구의
 * `input_schema` 로 넘기고 Anthropic API 는 그 최상위에 `type` 을 요구하는데, union 은
 * `anyOf` 로 변환돼 `type` 이 없어 400 으로 거절당한다(2026-08-05 실측:
 * `tools.0.custom.input_schema.type: Field required`).
 *
 * 사용자가 형식을 골랐으므로 그 갈래 하나만 넘기면 된다. `schema.test.ts` 가 다섯 형식 모두
 * 최상위가 object 인지 잠근다.
 */
export function infoSpecFor(format: InfoFormat) {
  return SPEC_BY_FORMAT[format];
}

const HookCard = z.object({
  role: z.literal("hook"),
  heading: z.string().min(1).max(40),
  sub: z.string().max(40).optional(),
});
const ProblemCard = z.object({ role: z.literal("problem"), heading: z.string().min(1).max(40), body: z.string().min(1).max(120) });
const EvidenceCard = z.object({ role: z.literal("evidence"), heading: z.string().min(1).max(40), body: z.string().min(1).max(120) });
const SolutionCard = z.object({
  role: z.literal("solution"),
  heading: z.string().min(1).max(40),
  body: z.string().min(1).max(120),
  steps: z.array(z.string().max(40)).max(5).optional(),
});
const CtaCard = z.object({
  role: z.literal("cta"),
  heading: z.string().min(1).max(40),
  action: z.string().min(1).max(40),
});

export const CardnewsCard = z.discriminatedUnion("role", [
  HookCard, ProblemCard, EvidenceCard, SolutionCard, CtaCard,
]);

export const CardnewsSpec = z
  .object({
    type: z.literal("cardnews"),
    keyword: z.string().min(1).max(40),
    /**
     * **올린 사진 수만큼** 만든다(생성 프롬프트가 정확한 수를 시킨다). 하한이 2인 이유는
     * 첫 장이 hook, 마지막이 cta 여야 해서다 — 한 장으로는 둘을 겸할 수 없다.
     * 예전 하한은 5였고, 그래서 사진 3장짜리 결과가 검증에서 튕겼다.
     */
    cards: z.array(CardnewsCard).min(2).max(6),
  })
  .refine((v) => v.cards[0]?.role === "hook", { message: "첫 카드는 hook이어야 합니다" })
  .refine((v) => v.cards[v.cards.length - 1]?.role === "cta", { message: "마지막 카드는 cta여야 합니다" });

export type InfographicSpec = z.infer<typeof InfographicSpec>;
export type CardnewsSpec = z.infer<typeof CardnewsSpec>;
export type CardnewsCard = z.infer<typeof CardnewsCard>;

/**
 * 목록형과 순서형은 **항목 모양이 같다**(`{keyword, desc}`) — 편집칸과 판정을 그대로 나눠 쓴다.
 * 다른 형식(비교·숫자·체크)은 각자의 모양이라 이 가드로 갈라 낸다.
 */
/** 다섯 형식의 항목을 합친 것. `itemTexts` 가 이 모두를 읽는다. */
export type InfoItem = z.infer<typeof InfographicSpec>["items"][number];

export type ListLikeSpec = Extract<z.infer<typeof InfographicSpec>, { format: "list" | "steps" }>;

export function isListLike(spec: z.infer<typeof InfographicSpec>): spec is ListLikeSpec {
  return spec.format === "list" || spec.format === "steps";
}
