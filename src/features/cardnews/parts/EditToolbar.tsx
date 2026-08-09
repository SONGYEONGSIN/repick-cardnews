"use client";

import { Image as ImageIcon } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { CARD_LAYOUTS, LAYOUT_LABELS } from "@/lib/layout-assign";
import {
  isBlankText,
  TEXT_ALIGNS,
  TEXT_ALIGN_LABELS,
  TEXT_SCALE_STEPS,
  TEXT_SCALE_LABELS,
  textScaleFor,
  textScaleStepOf,
} from "@/templates/layout-utils";
import { THEMES, THEME_IDS, type ThemeId } from "@/templates/themes";
import { BODY_MAX, HEADING_MAX } from "../checks";
import type { CardDraft } from "../reducer";

/**
 * 툴바 — 만들기 화면의 유일한 컨트롤 표면.
 *
 * 옆 패널(`CardInspector`)을 없애고 전부 여기로 올렸다. 그래서 캔버스가 전체 폭을 쓴다 —
 * 사진을 고치는 도구에서 가장 넓어야 할 것은 사진이다.
 *
 * 왼쪽 **요소 선택기**(헤드라인·본문·사진·카드)가 축이다. 무엇을 고르느냐에 따라 그 옆이
 * 통째로 바뀐다. 캔버스를 눌러도 같이 바뀐다 — 두 입구가 같은 상태를 가리킨다.
 *
 * 시안(`src/app/lab2/Editor.tsx`)에는 있었지만 여기서 **뺀 것**: 글 위치(대신 캔버스의 손잡이로
 * 옮긴다)·사진 배율·형광·역할 배지·다시 쓰기·빼기. `CardDraft` 가 받지 않는 값이라 조작해도
 * 저장될 곳이 없다 — 눌리는데 아무 일도 안 나는 버튼을 두지 않는다. 글자 크기·정렬은 이제
 * `CardDraft.textScale`·`textAlign`으로 받으므로 헤드라인·본문을 고른 동안 아래에 컨트롤을 둔다
 * — 카드 전체에 한 번에 적용되는 값이라 두 탭에서 같은 컨트롤·같은 값을 보여 준다.
 *
 * **테마**(`CardnewsState.themeId`, 다섯 장 전체에 적용)는 **자기 탭**을 갖는다.
 *
 * 처음엔 '카드' 탭 안에 넣고 "5장 전체" 라벨로만 구분했다. 새 탭을 만들면 다른 탭들처럼
 * "카드 하나짜리 설정"으로 읽힐까 봐서였는데, **카드 하나짜리 탭 안에 있는 편이 오히려 더
 * 그렇게 읽혔다**(실사용 지적). 탭을 나누고 패널 안에 적용 범위를 적는 쪽이 분명하다.
 *
 * 액센트 색을 쓰지 않는다. 선택 상태는 검정 채움(`bg-ink text-surface`)과 굵기로만 만든다.
 */

export type EditTarget = "heading" | "body" | "steps" | "photo" | "card" | "theme";

/** 순서 목록 상한 — 스키마(`SolutionCard.steps`)의 `.max(5)` 와 같은 값이어야 한다. */
export const MAX_STEPS = 5;

function Group({ children }: { children: React.ReactNode }) {
  // 좁은 화면에서는 줄을 바꾼다 — 안 그러면 테마 다섯 개가 상자를 뚫고 나간다(폰에서 확인, 2026-08-09).
  return <span className="flex flex-wrap items-center rounded-lg border border-hair p-1">{children}</span>;
}

function Opt({
  label,
  on,
  onClick,
  swatch,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  /** 앞에 붙는 시각 견본. 색 자체가 고르는 대상일 때만 쓴다(docs/ui-standards.md §5). */
  swatch?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded px-3 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
        on ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
      }`}
    >
      {swatch}
      {label}
    </button>
  );
}

/**
 * 테마 견본 — 한 칩에 **바탕·강조·글자색** 세 값을 담는다. 이 화면은 색을 쓰지 않는 것이
 * 원칙이지만, 여기서는 **색 자체가 고르는 대상**이라 예외가 선다(docs/ui-standards.md §5).
 * 값은 전부 `THEMES` 에서 오고 하드코딩 리터럴은 없다.
 */
function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const t = THEMES[themeId];
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 flex-none rounded-full"
      style={{ background: t.bg, boxShadow: `inset 0 0 0 3px ${t.accent}, inset 0 0 0 4px ${t.fg}` }}
    />
  );
}

function Btn({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-lg border border-hair px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-200 hover:border-ink hover:bg-hair-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hair disabled:hover:bg-transparent disabled:hover:text-ink-2 ${FOCUS_RING} motion-reduce:transition-none`}
    >
      {children}
    </button>
  );
}

/**
 * 0~100 슬라이더. `min`/`max` 는 옛 `CardInspector` 가 쓰던 폭을 그대로 가져왔다 —
 * 글 배경 30 미만은 사진 위 글이 안 읽히고, 사진 높이 70 초과는 글 자리가 남지 않는다.
 */
function Dial({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="flex-none text-[14px] text-ink-2">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1 w-[104px] flex-none accent-ink ${FOCUS_RING}`}
      />
      <span className="w-10 flex-none text-right text-[13px] tabular-nums text-ink-2">{value}%</span>
    </label>
  );
}

/** 글자수. 넘치면 액센트 색 대신 검정 채움으로 뒤집는다 — 이 화면의 강조 수단은 그것뿐이다. */
function Counter({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span
      className={`ml-auto rounded px-2 py-0.5 text-[13px] font-bold tabular-nums ${
        over ? "bg-ink text-surface" : "text-ink-2"
      }`}
    >
      {len}/{max}
    </span>
  );
}

function Divider() {
  return <span className="h-7 w-px flex-none bg-hair" aria-hidden="true" />;
}

export function EditToolbar({
  card,
  target,
  onSelect,
  onPatch,
  onSwapPhoto,
  onRequestFocus,
  headlineSelection,
  themeId,
  onThemeChange,
  ad,
  adAppliesHere,
  onAdChange,
}: {
  card: CardDraft;
  target: EditTarget;
  onSelect: (t: EditTarget) => void;
  onPatch: (patch: Partial<Omit<CardDraft, "id" | "photoId">>) => void;
  onSwapPhoto: () => void;
  /** 헤드라인·본문이 이미 비어 있을 때 "추가" 버튼이 부르는 콜백 — 값은 이미 ""라 onPatch로는
      아무 변화가 없다. 캔버스의 그 칸에 포커스를 옮기는 게 실제 효과다(CardCanvas 참고). */
  onRequestFocus: () => void;
  /** 캔버스의 헤드라인에서 지금 드래그·키보드로 고른 글자(CardCanvas 참고). 형광 버튼이 이 값을
      그대로 저장한다 — 비어 있으면 아직 아무것도 안 골랐다는 뜻이라 버튼을 비활성으로 둔다. */
  headlineSelection: string;
  /** 다섯 장 전체에 적용되는 테마 — `CardDraft` 가 아니라 `CardnewsState` 소속이라 `onPatch` 로
      보내지 않고 따로 받는다. '카드' 탭 안에서만 보여준다(위 파일 상단 주석 참고). */
  themeId: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
  /** 협찬·광고 표기 — 세트 전체에 적용된다. */
  ad: boolean;
  /** 지금 보고 있는 카드에 그 표기가 실제로 붙는가. 안 붙으면 스위치를 숨긴다. */
  adAppliesHere: boolean;
  onAdChange: (ad: boolean) => void;
}) {
  const copy = card.copy;
  // hook·cta 에는 본문이 없다. 없는 카드에서는 본문 탭 자체를 띄우지 않는다.
  const body = "body" in copy ? copy.body : undefined;
  // 해법 카드에만 있는 순서 목록. 스키마 상한이 5개다(`CardnewsSpec` 의 SolutionCard).
  const steps = "steps" in copy ? (copy.steps ?? []) : undefined;
  const hasPhoto = card.layout !== "text-only";

  const picks: { id: EditTarget; label: string; show: boolean }[] = [
    // **테마가 맨 앞이다.** 적용 범위가 세트 전체라, 카드 하나씩 손보기 전에 먼저 정하는
    // 순서가 자연스럽다. 예전엔 '카드' 탭 안에 있었는데 카드 설정으로 읽혀 탭을 나눴고,
    // 그때는 맨 뒤에 뒀다 — 쓰다 보니 제일 먼저 만지는 것이라 앞으로 옮겼다(2026-08-09).
    { id: "theme", label: "테마", show: true },
    { id: "heading", label: "헤드라인", show: true },
    { id: "body", label: "본문", show: body !== undefined },
    // 순서 목록은 해법 카드에만 있다. 없는 카드에서는 탭 자체를 띄우지 않는다(본문과 같은 규칙).
    { id: "steps", label: "순서", show: steps !== undefined },
    { id: "photo", label: "사진", show: hasPhoto },
    { id: "card", label: "카드", show: true },
  ];
  const tabs = picks.filter((p) => p.show);

  // 카드를 넘기면 지금 카드에 없는 요소를 가리키고 있을 수 있다(problem 에서 "본문"을 고른 뒤
  // cta 로 이동, text-only 에서 "사진"). 그대로 두면 어느 탭도 선택 표시가 안 되고 패널이
  // 엉뚱하게 비므로, **렌더 중에 순수 계산으로** 항상 있는 "카드"로 떨어뜨린다.
  // effect 로 부모 상태를 고치지 않는다 — 한 프레임 어긋난 화면이 먼저 보이고 렌더가 두 번 돈다.
  const active: EditTarget = tabs.some((p) => p.id === target) ? target : "card";

  const isText = active === "heading" || active === "body";
  const activeText = active === "body" ? (body ?? "") : copy.heading;
  const textBlank = isBlankText(activeText);
  const len = active === "body" ? (body?.length ?? 0) : copy.heading.length;
  const max = active === "body" ? BODY_MAX : HEADING_MAX;

  /**
   * "지우기" — heading 은 다섯 역할 전부에 있어 그대로 지운다. body 는 problem·evidence·
   * solution 에만 있어 `"body" in copy` 로 좁힌 **안쪽에서** 패치를 만든다(CardCanvas의
   * bodyEdit 과 같은 이유 — 바깥에서 만들면 hook·cta 유니온에 없는 body 가 섞인다). `active`가
   * "body" 인 시점엔 탭이 이미 `body !== undefined` 로만 떴으므로 실제로는 늘 참이지만,
   * 타입은 그 사실을 모르니 단언(`as`) 대신 이 안쪽 `in` 체크로 좁힌다.
   */
  /**
   * 탭마다 아래에 한 줄로 붙는 **안내**. 예전엔 조작 사이사이에 설명문이 끼어 있어(헤드라인
   * 탭은 일곱 덩어리 중 셋이 문장이었다) "무엇을 할 수 있나"가 한눈에 안 잡혔다. 조작은 위
   * 줄, 설명은 아래 줄로 나눠 어느 탭을 눌러도 같은 자리를 보게 한다.
   */
  function hintFor(target: EditTarget): string {
    if (target === "heading" || target === "body") {
      return "카드에서 글자를 직접 눌러 고쳐요 · 손잡이를 끌어 글 위치를 위아래로 옮겨요";
    }
    if (target === "steps") return "순서 글도 카드에서 직접 눌러 고쳐요";
    if (target === "photo") return "사진 위를 끌어 초점을 옮겨요";
    // 사진 전면 카드는 사진이 바탕·글자색을 덮는다 — 안 적으면 "테마가 안 먹는다"로 읽힌다
    // (실제로 그런 문의를 받았다). 해당 레이아웃일 때만 덧붙인다.
    if (target === "theme") {
      // 사진 전면 카드는 사진이 바탕·글자색을 덮는다 — 안 적으면 "테마가 안 먹는다"로 읽힌다
      // (실제로 그런 문의를 받았다).
      return card.layout === "full-bleed"
        ? "바탕·글자·강조색과 제목 글꼴을 한 번에 바꿔요 · 이 카드는 사진이 덮어서 글꼴과 형광만 달라져요"
        : "바탕·글자·강조색과 제목 글꼴을 한 번에 바꿔요";
    }
    return "구성은 이 카드에만 적용돼요";
  }

  function clearActiveText() {
    if (active === "heading") {
      onPatch({ copy: { ...copy, heading: "" } });
    } else if (active === "body" && "body" in copy) {
      onPatch({ copy: { ...copy, body: "" } });
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-hair">
      {/* 무엇을 고칠지 고르는 줄. 컨트롤은 바로 아래에 붙는다 — 한 줄에 다 밀어 넣으면
          좁은 폭에서 줄바꿈이 지저분해지고, 고른 것과 그 도구의 관계도 흐려진다. */}
      <div className="flex gap-1 border-b border-hair p-2" role="tablist" aria-label="고칠 요소">
        {tabs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            onClick={() => onSelect(p.id)}
            className={`h-10 rounded-lg px-4 text-[14px] font-bold transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
              active === p.id ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* **안내가 위, 조작이 아래.** 예전엔 둘이 한 줄에 섞여 있었고(헤드라인 탭은 일곱 덩어리
          중 셋이 문장), 그다음엔 안내를 아래에 뒀다 — 그러니 다 만지고 나서야 읽게 된다는
          지적을 받아 위로 올렸다(정보전달 `InfoToolbar` 와 같은 골격). 어느 탭을 눌러도 같은
          자리를 보게 한다. */}
      <div role="tabpanel" className="flex flex-col gap-2.5 px-3 py-2.5">
        <p className="text-[13px] leading-relaxed text-ink-2">{hintFor(active)}</p>
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-2">
        {isText && (
          <>
            {/* 크기·정렬은 헤드라인·본문이 아니라 카드 전체에 한 번 적용된다(CardDraft.textScale·
                textAlign) — 헤드라인 탭에서 고르든 본문 탭에서 고르든 같은 값을 보고 같은 값을
                바꾼다. */}
            <span className="flex items-center gap-2.5">
              <span className="text-[14px] text-ink-2">크기</span>
              <Group>
                {TEXT_SCALE_STEPS.map((step) => (
                  <Opt
                    key={step}
                    label={TEXT_SCALE_LABELS[step]}
                    on={textScaleStepOf(card.textScale) === step}
                    onClick={() => onPatch({ textScale: textScaleFor(step) })}
                  />
                ))}
              </Group>
            </span>
            <span className="flex items-center gap-2.5">
              <span className="text-[14px] text-ink-2">정렬</span>
              <Group>
                {TEXT_ALIGNS.map((a) => (
                  <Opt key={a} label={TEXT_ALIGN_LABELS[a]} on={card.textAlign === a} onClick={() => onPatch({ textAlign: a })} />
                ))}
              </Group>
            </span>
            {/* 형광은 본문이 아니라 헤드라인에만 있다(카드뉴스 형광은 거의 다 헤드라인이라 범위를
                좁혔다) — 크기·정렬과 달리 본문 탭에서는 이 컨트롤 자체를 안 보여준다. 이미 강조가
                있으면 지우기로 바뀐다(크기·정렬의 지우기/추가 짝과 같은 방식). 선택이 없으면
                버튼을 비활성으로 두고 옆에 왜인지 말해 준다 — 조용히 아무 일도 안 나면 안 된다. */}
            {active === "heading" && (
              <span className="flex items-center gap-2.5">
                {card.highlight ? (
                  <Btn onClick={() => onPatch({ highlight: "" })}>형광 지우기</Btn>
                ) : (
                  <>
                    <Btn disabled={!headlineSelection} onClick={() => onPatch({ highlight: headlineSelection })}>
                      형광
                    </Btn>
                    {!headlineSelection && (
                      <span className="text-[13px] text-ink-2">헤드라인 글자를 드래그로 선택하면 켤 수 있어요</span>
                    )}
                  </>
                )}
              </span>
            )}
            <Counter len={len} max={max} />
            {/* 되돌리기가 없어 실수로 지우면 복구는 다시 입력뿐이다 — 그래도 그 복구가 한 번의
                입력으로 충분하므로 확인 절차는 두지 않는다. 이미 비어 있으면 "추가"로 바뀌어
                지우기를 다시 누를 일이 없다. */}
            <span className="ml-auto">
              <Btn onClick={textBlank ? onRequestFocus : clearActiveText}>{textBlank ? "추가" : "지우기"}</Btn>
            </span>
          </>
        )}

        {active === "photo" && (
          <>
            {card.layout === "full-bleed" && (
              <Dial
                label="글 배경"
                value={Math.round(card.scrim * 100)}
                min={30}
                max={95}
                onChange={(v) => onPatch({ scrim: v / 100 })}
              />
            )}
            {card.layout === "split" && (
              <Dial
                label="사진 높이"
                value={Math.round(card.band * 100)}
                min={30}
                max={70}
                onChange={(v) => onPatch({ band: v / 100 })}
              />
            )}
            <span className="ml-auto">
              <Btn onClick={onSwapPhoto}>
                <ImageIcon size={15} aria-hidden="true" />
                사진 바꾸기
              </Btn>
            </span>
          </>
        )}

        {active === "steps" && steps !== undefined && "steps" in copy && (
          <>
            <span className="text-[14px] text-ink-2">
              단계 <span className="font-bold tabular-nums text-ink">{steps.length}</span>/{MAX_STEPS}
            </span>
            <Btn
              disabled={steps.length >= MAX_STEPS}
              onClick={() => onPatch({ copy: { ...copy, steps: [...steps, ""] } })}
            >
              단계 추가
            </Btn>
            <Btn
              disabled={steps.length === 0}
              onClick={() => onPatch({ copy: { ...copy, steps: steps.slice(0, -1) } })}
            >
              마지막 단계 빼기
            </Btn>
            {steps.length === 0 && (
              <span className="text-[14px] text-ink-2">지금은 순서가 없어요. 추가하면 카드에 나와요.</span>
            )}
          </>
        )}

        {active === "card" && (
          <>
            <span className="flex items-center gap-2.5">
              <span className="text-[14px] text-ink-2">구성</span>
              <Group>
                {CARD_LAYOUTS.map((l) => (
                  <Opt
                    key={l}
                    label={LAYOUT_LABELS[l]}
                    on={l === card.layout}
                    onClick={() => onPatch({ layout: l })}
                  />
                ))}
              </Group>
            </span>

          </>
        )}

        {active === "theme" && (
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="text-[14px] text-ink-2">
              이 세트 <span className="font-bold text-ink">5장 전체</span>에 적용
            </span>
            <Group>
              {THEME_IDS.map((id) => (
                <Opt
                  key={id}
                  label={THEMES[id].label}
                  on={id === themeId}
                  onClick={() => onThemeChange(id)}
                  swatch={<ThemeSwatch themeId={id} />}
                />
              ))}
            </Group>
            {/* 협찬·광고를 받았으면 밝혀야 한다(표시광고법). 세트 전체 성격이라 테마와 같은 자리다.
                **이 카드에 표기가 안 붙으면 스위치도 숨긴다** — 첫 장은 인스타의 `1/4` 표시에
                가려 표기를 넣지 않는데, 스위치만 보이면 켜도 아무 일이 없어 보인다. */}
            {adAppliesHere && (
              <Group>
                <Opt label="[광고] 표기" on={ad} onClick={() => onAdChange(!ad)} />
              </Group>
            )}
          </span>
        )}
        </div>
      </div>
    </div>
  );
}
