"use client";

import { useState } from "react";
import { CircleAlert, Plus, X } from "lucide-react";
import { Badge, FOCUS_RING } from "@/components/ui";
import { LineButton } from "@/features/shell/StudioFrame";
import { MAX_HASHTAGS, parseHashtags, validateHashtagCount } from "@/lib/hashtags";

/**
 * 해시태그 칩 입력 — `InstagramPublishPanel`의 캡션 아래에 쓴다. 공백·쉼표로 구분해 여러 개를
 * 한 번에 넣어도 되고, `#`을 붙이든 안 붙이든 정규화된다(`@/lib/hashtags`). 인스타그램이
 * 2025-12부터 게시물당 5개로 제한하므로, 더한 결과가 5개를 넘으면 **하나도 더하지 않고**
 * 이유만 보여준다 — 일부만 조용히 잘라 넣지 않는다. `/api/publish`의 zod 검증이 같은 상한을
 * 다시 확인한다(화면만 막지 않는다).
 */
export function HashtagInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const parsedNew = parseHashtags(input);
    if (parsedNew.length === 0) {
      setInput("");
      return;
    }
    const merged = [...value];
    for (const tag of parsedNew) {
      if (!merged.includes(tag)) merged.push(tag);
    }
    const validation = validateHashtagCount(merged);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    onChange(merged);
    setInput("");
    setError(null);
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-ink-2">해시태그 (선택, 최대 {MAX_HASHTAGS}개)</span>
        <Badge tone="neutral">
          {value.length} / {MAX_HASHTAGS}
        </Badge>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(tag)}
                className={`inline-flex items-center gap-1 rounded-full bg-hair-soft px-2.5 py-1 text-[13px] font-semibold text-ink-2 transition-opacity duration-200 hover:opacity-85 disabled:opacity-50 ${FOCUS_RING} motion-reduce:transition-none`}
              >
                #{tag}
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length < MAX_HASHTAGS ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commit();
            }}
            disabled={disabled}
            placeholder="예: 다이어트 (# 없이 써도 돼요)"
            className={`min-w-0 flex-1 rounded-lg border border-hair px-3 py-2 text-[14px] transition-colors duration-200 placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none`}
          />
          <LineButton disabled={disabled || input.trim().length === 0} onClick={commit}>
            <Plus size={15} aria-hidden="true" />
            추가
          </LineButton>
        </div>
      ) : (
        <p className="text-[13px] text-ink-2">{MAX_HASHTAGS}개를 다 썼어요. 빼려면 태그의 × 를 눌러요.</p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-ink-2">
          <CircleAlert size={14} aria-hidden="true" className="flex-none" />
          {error}
        </p>
      )}
    </div>
  );
}
