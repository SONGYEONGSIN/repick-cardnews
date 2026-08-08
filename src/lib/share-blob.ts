import { del, list, put } from "@vercel/blob";
import { isTokenExpired } from "@/lib/share-token";

/**
 * 공유된 카드 이미지 보관소 — **Blob 에 둔다.**
 *
 * 예전에는 서버 프로세스 메모리(`Map`)에 뒀다. 로컬에서 한 프로세스가 계속 도는 동안에는
 * 맞는 선택이었지만, 배포하면 **이미지를 넣은 인스턴스와 인스타그램이 가지러 오는 인스턴스가
 * 다르다.** 그래서 게시가 통째로 실패한다.
 *
 * Blob 에 두면 **인스타그램이 Blob 주소에서 직접 가져간다.** 우리 서버가 그 순간 살아 있어야
 * 한다는 조건이 사라진다 — 지금 구조에서 제일 약한 고리였다.
 *
 * 주소는 공개지만 토큰이 UUID 라 추측할 수 없다. 예전 `/s/<토큰>` 과 같은 성질이고, 올리고
 * 나면 지운다.
 *
 * **판단은 전부 순수 함수로 뺐다**(경로·정렬·파싱). 이 저장소의 테스트는 `node` 환경이라
 * 네트워크를 타는 부분은 묶을 수 없다 — 대신 그 부분을 얇게 유지한다.
 */

export type ShareMeta = { keyword: string; issuedAt: number };
export type ShareEntry = ShareMeta & { urls: string[] };

/** 한 토큰이 쓰는 폴더. **슬래시로 끝나야** 이름이 겹치는 다른 토큰을 끌어오지 않는다. */
export function sharePrefix(token: string): string {
  return `share/${token}/`;
}

export function imagePath(token: string, index: number): string {
  return `${sharePrefix(token)}${index + 1}.png`;
}

export function metaPath(token: string): string {
  return `${sharePrefix(token)}meta.json`;
}

/**
 * 목록을 **번호순**으로 세운다.
 *
 * 목록 API 가 어떤 순서로 주는지는 보장되지 않는다. 문자열 정렬로 두면 `10.png` 가 `2.png`
 * 앞에 서서 카드 순서가 뒤집힌다 — 올리고 나서야 알게 되는, 되돌릴 수 없는 실수다.
 */
export function orderImageUrls(blobs: readonly { pathname: string; url: string }[]): string[] {
  return blobs
    .map((b) => ({ n: Number(/(\d+)\.png$/.exec(b.pathname)?.[1] ?? NaN), url: b.url }))
    .filter((b) => Number.isFinite(b.n))
    .sort((a, b) => a.n - b.n)
    .map((b) => b.url);
}

/** 저장소가 깨졌거나 모양이 다르면 `null` — 화면이 터지느니 없는 것으로 본다. */
export function parseShareMeta(raw: unknown): ShareMeta | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.keyword !== "string" || typeof r.issuedAt !== "number") return null;
  return { keyword: r.keyword, issuedAt: r.issuedAt };
}

/** 올리고 나면 지운다 — 1회용이고, 남겨 두면 저장 용량만 먹는다. */
export async function deleteShare(token: string): Promise<void> {
  const { blobs } = await list({ prefix: sharePrefix(token) });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));
}

/**
 * 카드 이미지를 올리고 인스타그램이 가져갈 주소를 돌려준다.
 *
 * `addRandomSuffix: false` — 경로를 우리가 정한다. 토큰이 이미 UUID 라 추측할 수 없고,
 * 정해진 경로여야 나중에 번호로 찾아올 수 있다.
 */
export async function saveShare(token: string, images: Buffer[], meta: ShareMeta): Promise<string[]> {
  const opts = { access: "public", addRandomSuffix: false, contentType: "image/png" } as const;
  const uploaded = await Promise.all(
    images.map((buf, i) => put(imagePath(token, i), buf, { ...opts, allowOverwrite: true })),
  );
  await put(metaPath(token), JSON.stringify(meta), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
  return uploaded.map((b) => b.url);
}

/** 없거나 만료면 `null` — 호출 쪽에서 이유를 구분하지 않는다(존재 여부를 알려 주지 않으려고). */
export async function loadShare(token: string, now: number): Promise<ShareEntry | null> {
  const { blobs } = await list({ prefix: sharePrefix(token) });
  if (blobs.length === 0) return null;

  const metaBlob = blobs.find((b) => b.pathname === metaPath(token));
  if (!metaBlob) return null;

  const res = await fetch(metaBlob.url, { cache: "no-store" });
  if (!res.ok) return null;
  const meta = parseShareMeta(await res.json().catch(() => null));
  if (!meta || isTokenExpired(meta.issuedAt, now)) return null;

  const urls = orderImageUrls(blobs);
  return urls.length === 0 ? null : { ...meta, urls };
}
