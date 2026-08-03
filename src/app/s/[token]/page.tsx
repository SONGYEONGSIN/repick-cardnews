import { notFound } from "next/navigation";
import { loadShare } from "@/lib/share-store";

/**
 * GET /s/<토큰> — 폰에서 여는 독립 화면. `StudioFrame`(스튜디오 셸)을 쓰지 않는다 —
 * 폰 브라우저에서 QR·링크로 바로 열리는 화면이라 데스크톱 편집기 챙길 필요가 없다.
 *
 * 토큰이 없거나 만료면 `notFound()`로 표준 404만 돌려준다 — 이유를 구분해 알려 주면
 * 존재 여부를 흘리는 것이라 항상 같은 반응이어야 한다.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entry = loadShare(token, Date.now());
  if (!entry) notFound();

  return (
    <main className="flex min-h-screen w-full flex-col items-center gap-6 bg-canvas px-4 py-8">
      <p className="text-center text-[15px] font-bold text-ink">이미지를 길게 눌러 저장하세요</p>
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        {entry.images.map((_, i) => (
          <img
            key={i}
            src={`/s/${token}/${i + 1}.png`}
            alt={`${entry.keyword} 카드 ${i + 1}/${entry.images.length}`}
            className="aspect-[4/5] w-full rounded-lg border border-hair bg-surface object-cover"
          />
        ))}
      </div>
    </main>
  );
}
