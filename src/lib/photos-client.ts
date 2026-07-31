import { compareFileNames, downscaleSize, THUMB_MAX, type Photo } from "@/lib/photos";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} 을 읽지 못했습니다`));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 해석하지 못했습니다"));
    img.src = dataUrl;
  });
}

function toThumb(img: HTMLImageElement): string {
  const size = downscaleSize(img.naturalWidth, img.naturalHeight, THUMB_MAX);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들지 못했습니다");
  ctx.drawImage(img, 0, 0, size.width, size.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function fileToPhoto(file: File): Promise<Photo> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  return {
    id: `${file.name}:${file.size}:${file.lastModified}`,
    name: file.name,
    dataUrl,
    thumbUrl: toThumb(img),
    width: img.naturalWidth,
    height: img.naturalHeight,
    bytes: file.size,
  };
}

/** readEntries 를 가진 최소 형태 — 실제 FileSystemDirectoryReader 가 그대로 들어맞고, 테스트는 가짜를 넣는다. */
type BatchReader<T> = {
  readEntries(onBatch: (entries: T[]) => void, onError: (err: DOMException) => void): void;
};

/**
 * readEntries 는 한 번에 100개 남짓만 주고 더 없을 때 빈 배열을 준다.
 * 한 번만 부르면 큰 폴더가 조용히 잘리므로 빈 배열이 올 때까지 반복해야 한다.
 */
export function readAllEntries<T>(reader: BatchReader<T>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const all: T[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        next();
      }, reject);
    next();
  });
}

// isFile/isDirectory 는 boolean 이라 타입이 좁혀지지 않는다 — 단언 대신 가드로 좁힌다.
function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}
function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function drainEntries(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];
  for (const entry of entries) {
    if (isFileEntry(entry)) {
      files.push(await entryToFile(entry));
    } else if (isDirectoryEntry(entry)) {
      files.push(...(await drainEntries(await readAllEntries(entry.createReader()))));
    }
  }
  return files;
}

/**
 * 드롭된 항목에서 폴더 안의 파일까지 펼쳐 낸다.
 * DataTransfer.files 에는 폴더의 "내용"이 없다 — 폴더는 확장자 없는 File 한 개로 들어와
 * 이미지 필터에서 버려지므로, entry API 로 디렉터리를 재귀 순회해야 폴더 드롭이 동작한다.
 * DataTransfer 는 drop 핸들러가 반환되면 무효화되므로 entry 목록은 호출 즉시(동기) 확보한다.
 */
export function entriesToFiles(items: DataTransferItemList): Promise<File[]> {
  const entries = Array.from(items)
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);
  return drainEntries(entries);
}

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

/** 폴더에서 온 파일은 순서가 보장되지 않으므로 파일명 자연 정렬로 순서를 정한다. */
export async function filesToPhotos(files: FileList | File[]): Promise<Photo[]> {
  const list = Array.from(files)
    .filter((f) => IMAGE_RE.test(f.name))
    .sort((a, b) => compareFileNames(a.name, b.name));
  return Promise.all(list.map(fileToPhoto));
}
