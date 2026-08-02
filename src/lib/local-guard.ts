/**
 * 요청이 "이 PC 브라우저"에서 온 것인지 판정한다 — HTTP `Host` 헤더가 가리키는 주소가
 * 루프백(`localhost`/`127.0.0.1`/`[::1]`)인지만 본다. 순수 함수라 헤더 값 문자열만 넣고
 * 바로 테스트할 수 있다(`@/lib/local-guard.test.ts`).
 *
 * **막는 것**: 같은 와이파이의 다른 기기가 이 PC의 LAN IP(예: `192.168.0.5:3500`)로 보내는
 * 요청. 그 기기의 브라우저가 보내는 `Host` 헤더는 자신이 접속한 LAN 주소이지 `localhost`가
 * 될 수 없다 — 그래서 `/api/publish`·`/api/share`처럼 "이 PC에서만 눌러야 하는" 액션 앞에
 * 붙이면 다른 기기의 무심코 클릭·자동화된 요청을 막는다.
 *
 * **못 막는 것(정직하게)**: `Host` 헤더는 요청자가 직접 채우는 값이라 **위조 가능**하다.
 * 예를 들어 `curl -H "Host: localhost:3500" http://<LAN IP>:3500/api/publish`처럼 헤더를
 * 일부러 바꿔 보내면 이 판정을 그대로 통과한다. 이건 진짜 인증이 아니라 "실수로 다른
 * 기기에서 못 누르게" 막는 수준의 보호다 — 집 네트워크에서 도는 개인 도구에 맞는 선이며,
 * 공인 사용자 인증(비밀번호·토큰)을 대신하지 않는다.
 */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `host:port` 또는 `[ipv6]:port` 형태에서 포트를 뗀 호스트 이름만 남긴다. */
function extractHostname(host: string): string {
  if (host.startsWith("[")) {
    const closeBracket = host.indexOf("]");
    return closeBracket === -1 ? host : host.slice(0, closeBracket + 1);
  }
  const lastColon = host.lastIndexOf(":");
  return lastColon === -1 ? host : host.slice(0, lastColon);
}

export function isLocalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const trimmed = hostHeader.trim();
  if (!trimmed) return false;
  const hostname = extractHostname(trimmed.toLowerCase());
  return LOCAL_HOSTNAMES.has(hostname);
}
