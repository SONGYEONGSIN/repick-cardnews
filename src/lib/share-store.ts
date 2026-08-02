import { isTokenExpired } from "@/lib/share-token";

/**
 * 발급된 공유 토큰 → 카드 이미지 보관소. **서버 프로세스 메모리에만** 두고 파일로 남기지
 * 않는다 — 1회용이고 만료되면 사라져야 한다.
 *
 * Next.js dev 서버는 route 모듈을 다시 불러올 수 있어 모듈 스코프 `Map`은 리로드마다
 * 비워진다. 이 저장소에 기존 globalThis 싱글턴 패턴이 없어 여기서 새로 만든다 —
 * `globalThis`에 한 번만 만들고 재사용한다(Prisma 클라이언트 싱글턴과 같은 관례).
 */

export type ShareEntry = {
  images: Buffer[];
  keyword: string;
  issuedAt: number;
};

declare global {
  var __repickShareStore: Map<string, ShareEntry> | undefined;
}

function store(): Map<string, ShareEntry> {
  if (!globalThis.__repickShareStore) {
    globalThis.__repickShareStore = new Map();
  }
  return globalThis.__repickShareStore;
}

/** 만료된 항목을 통째로 쓸어낸다. 로컬 1인 도구 규모라 접근마다 훑어도 비용이 작다. */
function purgeExpired(now: number): void {
  const map = store();
  for (const [token, entry] of map) {
    if (isTokenExpired(entry.issuedAt, now)) {
      map.delete(token);
    }
  }
}

export function saveShare(token: string, entry: ShareEntry): void {
  store().set(token, entry);
}

/** 존재하지 않거나 만료된 토큰은 null — 호출 쪽에서 이유를 구분하지 않는다(정보 누출 방지). */
export function loadShare(token: string, now: number): ShareEntry | null {
  purgeExpired(now);
  return store().get(token) ?? null;
}
