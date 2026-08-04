/** 카피 생성 API(`/api/generate`) 호출 래퍼. 실패 시 서버가 준 한국어 메시지를 그대로 던진다. */
import type { InfoFormat } from "@/lib/schema";

export async function requestSpec<T>(args: {
  type: "cardnews" | "informationsend";
  keyword: string;
  photos: string[];
  /** 정보전달 형식. 서버가 이걸로 생성 규칙을 고르고, 모델이 빠뜨리면 채운다. */
  format?: InfoFormat;
}): Promise<T> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "카피 생성에 실패했어요");
  return data.spec as T;
}

/**
 * `MMDD` 형식의 오늘 날짜 문자열을 반환한다.
 *
 * 이 프로젝트에는 "카드 템플릿(src/templates/**) 렌더 결과가 캡처마다 달라지지 않도록
 * Math.random/Date.now/new Date() 사용을 금지"하는 결정론 규칙이 있지만, 이 함수는
 * 템플릿 렌더링이 아니라 저장 산출물 폴더 이름(`cardnews/<슬러그>-<MMDD>/`)을 만들기
 * 위한 것이라 실제 오늘 날짜가 필요하다. 따라서 `new Date()` 사용은 규칙 위반이 아니다.
 */
export function mmdd(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
