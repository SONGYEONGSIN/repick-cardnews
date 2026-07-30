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

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

/** 폴더에서 온 파일은 순서가 보장되지 않으므로 파일명 자연 정렬로 순서를 정한다. */
export async function filesToPhotos(files: FileList | File[]): Promise<Photo[]> {
  const list = Array.from(files)
    .filter((f) => IMAGE_RE.test(f.name))
    .sort((a, b) => compareFileNames(a.name, b.name));
  return Promise.all(list.map(fileToPhoto));
}
