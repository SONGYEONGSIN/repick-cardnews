import { z } from "zod/v4";

export const InfographicSpec = z.object({
  type: z.literal("informationsend"),
  title: z.string().min(1).max(40),
  subtitle: z.string().max(60).optional(),
  items: z
    .array(z.object({ keyword: z.string().min(1).max(30), desc: z.string().min(1).max(120) }))
    .min(3)
    .max(6),
  tip: z.string().max(120).optional(),
});

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
  handle: z.string().max(30).optional(),
});

export const CardnewsCard = z.discriminatedUnion("role", [
  HookCard, ProblemCard, EvidenceCard, SolutionCard, CtaCard,
]);

export const CardnewsSpec = z
  .object({
    type: z.literal("cardnews"),
    keyword: z.string().min(1).max(40),
    cards: z.array(CardnewsCard).min(5).max(6),
  })
  .refine((v) => v.cards[0]?.role === "hook", { message: "첫 카드는 hook이어야 합니다" })
  .refine((v) => v.cards[v.cards.length - 1]?.role === "cta", { message: "마지막 카드는 cta여야 합니다" });

export type InfographicSpec = z.infer<typeof InfographicSpec>;
export type CardnewsSpec = z.infer<typeof CardnewsSpec>;
export type CardnewsCard = z.infer<typeof CardnewsCard>;
