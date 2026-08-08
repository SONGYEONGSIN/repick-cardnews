import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isPublicPath, verifySession } from "@/lib/auth";

/**
 * 로그인하지 않은 요청을 로그인 화면으로 돌린다.
 *
 * **판단은 전부 `@/lib/auth` 가 한다.** 여기는 배선만이다 — 미들웨어는 테스트로 못 묶는데,
 * 인증을 테스트 없이 둘 수는 없기 때문이다.
 *
 * `AUTH_SECRET` 이 없으면 **아무도 못 들어온다.** 설정을 빠뜨렸을 때 열어 두는 쪽으로
 * 기울면, 배포 한 번 잘못해서 인스타 계정이 통째로 열린다. 잠기는 쪽으로 실패한다.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const ok = secret ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret, Date.now()) : false;
  if (ok) return NextResponse.next();

  // API 는 화면으로 돌리지 않는다 — 리다이렉트를 받으면 fetch 쪽이 HTML 을 JSON 으로 읽으려다
  // 엉뚱한 오류를 낸다. 401 이면 화면이 "로그인이 풀렸어요" 를 제대로 말할 수 있다.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "로그인이 필요해요. 새로고침 후 다시 로그인해 주세요." }, { status: 401 });
  }

  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = "";
  return NextResponse.redirect(to);
}

export const config = {
  // 모든 요청을 거치게 두고 열고 닫는 판단은 `isPublicPath` 한 곳에서 한다. 여기에 예외를
  // 적으면 규칙이 두 군데로 갈라져, 한쪽만 고치는 순간 구멍이 된다.
  matcher: "/:path*",
};
