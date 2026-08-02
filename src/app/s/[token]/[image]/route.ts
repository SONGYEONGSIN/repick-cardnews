import { loadShare } from "@/lib/share-store";

/**
 * GET /s/<토큰>/<n>.png — 공유된 카드 한 장을 image/png 로 내준다.
 * 토큰이 없거나 만료면 아무 것도 내주지 않는다(404) — 존재 여부를 알려 주는 문구·시간 차이를
 * 두지 않기 위해 이유를 구분하지 않고 항상 같은 응답을 돌려준다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; image: string }> }) {
  const { token, image } = await params;

  const match = /^(\d+)\.png$/.exec(image);
  if (!match) {
    return new Response(null, { status: 404 });
  }

  const entry = loadShare(token, Date.now());
  const index = Number(match[1]) - 1;
  if (!entry || index < 0 || index >= entry.images.length) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(entry.images[index]), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
