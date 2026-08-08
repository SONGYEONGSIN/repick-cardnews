import { MIN_PASSWORD_LENGTH, SESSION_COOKIE, SESSION_DAYS, isUsablePassword, safeEqual, signSession } from "@/lib/auth";

/**
 * 비밀번호를 받아 세션 쿠키를 심는다.
 *
 * 비밀번호를 해시로 두지 않는 이유: 해시가 막아 주는 것은 "환경변수는 봤지만 로그인은 못 하게"
 * 인데, **환경변수를 본 사람은 이미 인스타 액세스 토큰을 손에 쥔다.** 대신 사람이 외울 수 없는
 * 긴 무작위 문자열을 쓴다 — 대입 공격이 성립하지 않는다.
 */
export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  // 설정이 없으면 잠긴다. 열어 두는 쪽으로 실패하면 배포 한 번에 계정이 열린다.
  if (!expected || !secret) {
    return Response.json({ error: "로그인 설정이 아직 안 됐어요." }, { status: 500 });
  }

  // 짧은 비밀번호는 **맞아도 들여보내지 않는다.** 이 설계는 길이에 기대고 있어서, 짧은 값을
  // 받아 주는 순간 방어가 없는 것과 같다. 맞는 값을 넣고도 막히는 편이 낫다.
  if (!isUsablePassword(expected)) {
    return Response.json(
      { error: `설정된 비밀번호가 너무 짧아요(${MIN_PASSWORD_LENGTH}자 이상이어야 해요).` },
      { status: 500 },
    );
  }

  let password = "";
  try {
    const body: unknown = await req.json();
    if (typeof body === "object" && body !== null && "password" in body) {
      const raw = (body as { password: unknown }).password;
      if (typeof raw === "string") password = raw;
    }
  } catch {
    // 본문이 JSON 이 아니면 빈 비밀번호로 본다 — 어차피 아래에서 거절된다.
  }

  if (!safeEqual(password, expected)) {
    return Response.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  }

  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const token = await signSession(Date.now() + maxAge * 1000, secret);

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": [
          `${SESSION_COOKIE}=${token}`,
          "Path=/",
          `Max-Age=${maxAge}`,
          "HttpOnly",
          "SameSite=Lax",
          "Secure",
        ].join("; "),
      },
    },
  );
}
