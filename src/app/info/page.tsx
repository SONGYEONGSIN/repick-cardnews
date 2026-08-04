import { InfoFlow } from "@/features/infosend/InfoFlow";
import { keywordFromParam } from "@/features/studio/switch-format";

/** 카드뉴스에서 형태를 바꿔 넘어오면 주소에 주제가 실려 온다(`switch-format`). */
export default async function InfoPage({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string | string[] }>;
}) {
  const { keyword } = await searchParams;
  return <InfoFlow initialKeyword={keywordFromParam(keyword)} />;
}
