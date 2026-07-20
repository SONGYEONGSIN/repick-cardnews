export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function outputDir(type: "informationsend" | "cardnews", keyword: string, mmdd: string): string {
  return `${type}/${slugify(keyword)}-${mmdd}`;
}

export function outputFile(dir: string, index: number): string {
  return `${dir}/${index}.png`;
}
