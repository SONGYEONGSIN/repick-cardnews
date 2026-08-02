import type { InfographicSpec, CardnewsSpec } from "@/lib/schema";

export const infographicFixture: InfographicSpec = {
  type: "informationsend",
  title: "에어컨 전기세 절약하는 6가지 방법",
  subtitle: "이렇게 사용하면 전기요금 아낄 수 있어요!",
  items: [
    { keyword: "처음엔 파워냉방", desc: "처음 10~20분은 파워냉방으로 빠르게 시원하게! 희망온도에 빨리 도달해요." },
    { keyword: "시원해지면 24~26℃ 유지", desc: "적정온도를 유지하면 전력 소모를 줄일 수 있어요." },
    { keyword: "선풍기와 함께 사용", desc: "공기 순환을 도와 냉방 효율 UP! 체감온도는 낮추고 전기는 절약해요." },
    { keyword: "필터는 2주~1개월마다 청소", desc: "먼지가 쌓이면 냉방 효율이 떨어지고 전기 사용량이 늘어나요." },
    { keyword: "외출 30분 이내면 끄지 말기", desc: "다시 켤 때 더 많은 전기가 들어가요. 짧은 외출은 켜두는 게 절약돼요." },
    { keyword: "실외기 주변 정리하기", desc: "통풍이 잘돼야 냉방 효율이 올라가요. 장애물은 치워주세요." },
  ],
  tip: "에너지소비효율 1등급 제품을 쓰면 전기세 절약에 더 도움이 됩니다.",
};

export const cardnewsFixture: CardnewsSpec = {
  type: "cardnews",
  keyword: "카드뉴스 설계",
  cards: [
    { role: "hook", heading: "이제 카드뉴스는 설득하는 구조가 됩니다", sub: "한 장씩 전환 흐름 만들기" },
    { role: "problem", heading: "대부분 첫 장에서 이탈합니다", body: "정보를 나열만 하면 스크롤은 멈추지 않아요." },
    { role: "evidence", heading: "반응 좋은 카드뉴스는 공통점이 있어요", body: "호기심 → 공감 → 신뢰 → 행동의 흐름을 탑니다." },
    { role: "solution", heading: "첫 장부터 이렇게 설계하세요", body: "5장 구조로 나눠 설득선을 만드세요.", steps: ["1장 궁금증", "2장 문제제기", "3장 증거", "4장 해결책", "5장 CTA"] },
    { role: "cta", heading: "저장하고 바로 적용해보세요", action: "이 게시물 저장하기", handle: "@repick" },
  ],
};
