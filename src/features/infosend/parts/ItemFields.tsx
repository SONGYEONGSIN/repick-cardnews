"use client";

import { itemFieldMaxes, type InfoFormat, type InfoItem } from "@/lib/schema";
import { ITEM_INPUT } from "./SortableItem";

/**
 * 항목 한 개의 **칸**. 형식마다 담는 것이 다르다 — 목록은 키워드+설명, 비교는 기준과 양쪽,
 * 숫자는 값과 설명, 체크는 한 줄.
 *
 * 줄 껍데기(끌기·번호·지우기)는 `SortableItem` 이 그린다. 여기는 칸만 그린다 — 그래야 형식이
 * 늘어도 껍데기를 복제하지 않는다.
 *
 * 글자 수 상한은 **스키마에서 온다**(`itemFieldMaxes`). 손으로 적으면 스키마와 어긋나 화면은
 * 받아 주는데 저장이 거절되는 일이 생긴다.
 */
export function ItemFields({
  format,
  item,
  index,
  columns,
  onPatch,
}: {
  format: InfoFormat;
  item: InfoItem;
  index: number;
  /** 비교형에서 양쪽 이름 — 어느 칸이 어느 쪽인지 라벨로 보여 준다. */
  columns?: { left: string; right: string };
  onPatch: (patch: Partial<InfoItem>) => void;
}) {
  const max = itemFieldMaxes(format);
  const n = index + 1;

  if (format === "check" && "text" in item) {
    return (
      <input
        value={item.text}
        aria-label={`${n}번 항목`}
        maxLength={max[0]}
        onChange={(e) => onPatch({ text: e.target.value })}
        className={ITEM_INPUT}
      />
    );
  }

  if (format === "stat" && "value" in item) {
    return (
      <>
        <input
          value={item.value}
          aria-label={`${n}번 숫자`}
          maxLength={max[0]}
          placeholder="7%"
          onChange={(e) => onPatch({ value: e.target.value })}
          className={`${ITEM_INPUT} font-bold`}
        />
        <input
          value={item.label}
          aria-label={`${n}번 숫자 설명`}
          maxLength={max[1]}
          onChange={(e) => onPatch({ label: e.target.value })}
          className={ITEM_INPUT}
        />
      </>
    );
  }

  if (format === "compare" && "left" in item) {
    return (
      <>
        <input
          value={item.label}
          aria-label={`${n}번 비교 기준`}
          maxLength={max[0]}
          placeholder="비교 기준"
          onChange={(e) => onPatch({ label: e.target.value })}
          className={`${ITEM_INPUT} font-bold`}
        />
        {/* 양쪽 칸은 나란히 — 위아래로 쌓으면 무엇과 무엇을 비교하는지 눈이 다시 찾아야 한다. */}
        <div className="flex gap-1.5">
          <input
            value={item.left}
            aria-label={`${n}번 ${columns?.left ?? "왼쪽"} 값`}
            maxLength={max[1]}
            placeholder={columns?.left}
            onChange={(e) => onPatch({ left: e.target.value })}
            className={ITEM_INPUT}
          />
          <input
            value={item.right}
            aria-label={`${n}번 ${columns?.right ?? "오른쪽"} 값`}
            maxLength={max[2]}
            placeholder={columns?.right}
            onChange={(e) => onPatch({ right: e.target.value })}
            className={ITEM_INPUT}
          />
        </div>
      </>
    );
  }

  // 목록·순서형 — 항목 모양이 같다(`{keyword, desc}`).
  if (!("keyword" in item)) return null;
  return (
    <>
      <input
        value={item.keyword}
        aria-label={format === "steps" ? `${n}단계 할 일` : `${n}번 항목 키워드`}
        maxLength={max[0]}
        onChange={(e) => onPatch({ keyword: e.target.value })}
        className={ITEM_INPUT}
      />
      <textarea
        value={item.desc}
        aria-label={format === "steps" ? `${n}단계 설명` : `${n}번 항목 설명`}
        rows={2}
        maxLength={max[1]}
        onChange={(e) => onPatch({ desc: e.target.value })}
        className={ITEM_INPUT}
      />
    </>
  );
}
