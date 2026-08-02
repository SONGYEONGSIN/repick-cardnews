import { z } from "zod/v4";
import { loadShare } from "@/lib/share-store";
import { checkInstagramConfig } from "@/lib/instagram-config";
import { isLocalHost } from "@/lib/local-guard";
import {
  publishCarousel,
  buildCarouselImageUrls,
  friendlyPublishError,
  CAROUSEL_MIN_ITEMS,
  CAROUSEL_MAX_ITEMS,
} from "@/lib/instagram";

/**
 * POST /api/publish — 공유 토큰이 가리키는 카드 이미지들을 인스타그램 캐러셀로 게시한다.
 *
 * **사진이 이 서버를 벗어나는 지점**: 인스타그램 콘텐츠 게시 API 는 파일을 직접 받지 않고
 * `image_url` 을 주면 인스타그램 서버가 그 주소로 사진을 가져간다(`@/lib/instagram` 상단 주석
 * 참고). 그래서 아래 `publishCarousel()` 호출이 시작되는 순간 — `PUBLIC_BASE_URL` + 공유 토큰
 * 경로(`/s/<token>/<n>.png`)로 만든 주소를 통해 — 카드 이미지가 인터넷으로 나간다. 로컬 PC
 * 안에서만 도는 다른 기능(저장·폰으로 보내기)과 다른 지점이다.
 *
 * 설정(공개 주소·비즈니스 계정 ID·액세스 토큰)이 하나라도 없으면 게시를 시도하지 않고 무엇이
 * 없는지 한국어로 알려준다 — 액세스 토큰 값 자체는 어떤 응답에도 담기지 않는다.
 *
 * **이 PC 브라우저에서만 부를 수 있다** — 실 토큰이 설정되면 이 경로는 "인스타그램에
 * 게시"라는 실제 액션을 수행하므로, 같은 와이파이의 다른 기기가 무심코(또는 의도적으로)
 * 호출하는 것을 `isLocalHost()`로 막는다. 판정 기준과 한계(헤더 위조는 못 막음)는
 * `@/lib/local-guard` 참고.
 */

const BodySchema = z.object({
  token: z.uuid("잘못된 공유 링크입니다"),
  caption: z.string().trim().max(2200, "캡션은 2200자를 넘을 수 없습니다").default(""),
});

export async function POST(req: Request) {
  if (!isLocalHost(req.headers.get("host"))) {
    return Response.json(
      { error: "인스타그램 게시는 이 컴퓨터의 브라우저에서만 할 수 있어요." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const configCheck = checkInstagramConfig(process.env);
  if (!configCheck.ready) {
    return Response.json(
      { error: `인스타그램 게시 설정이 없어요: ${configCheck.missing.join(", ")}` },
      { status: 400 },
    );
  }

  const entry = loadShare(parsed.data.token, Date.now());
  if (!entry) {
    return Response.json({ error: "공유 링크가 없거나 만료됐어요" }, { status: 404 });
  }

  if (entry.images.length < CAROUSEL_MIN_ITEMS || entry.images.length > CAROUSEL_MAX_ITEMS) {
    return Response.json(
      {
        error: `캐러셀은 ${CAROUSEL_MIN_ITEMS}~${CAROUSEL_MAX_ITEMS}장만 게시할 수 있어요 (현재 ${entry.images.length}장)`,
      },
      { status: 400 },
    );
  }

  const imageUrls = buildCarouselImageUrls(configCheck.config.publicBaseUrl, parsed.data.token, entry.images.length);

  try {
    const mediaId = await publishCarousel({
      config: configCheck.config,
      imageUrls,
      caption: parsed.data.caption,
    });
    return Response.json({ mediaId });
  } catch (e) {
    return Response.json({ error: friendlyPublishError(e) }, { status: 502 });
  }
}
