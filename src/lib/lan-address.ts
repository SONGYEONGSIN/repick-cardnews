import { networkInterfaces } from "node:os";

/**
 * 이 PC의 집 네트워크(LAN) IPv4 주소를 찾는다 — 폰이 같은 공유기에서 접속할 링크를 만들 때 쓴다.
 * 루프백(internal)과 APIPA(169.254.0.0/16, 연결 안 된 인터페이스가 스스로 붙이는 비활성 주소)는
 * 제외한다. 못 찾으면 null — 호출 쪽이 안내 문구로 대체한다.
 */
export function findLanAddress(): string | null {
  const interfaces = networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      if (addr.address.startsWith("169.254.")) continue;
      return addr.address;
    }
  }
  return null;
}
