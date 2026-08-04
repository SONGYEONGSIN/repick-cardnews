import { INFO_FORMATS, type InfoFormat } from "@/lib/schema";
import type { Theme } from "@/templates/themes";

/**
 * 아직 템플릿이 없는 형식의 **자리 표시**.
 *
 * 형식은 스키마·생성부터 붙이고 템플릿을 하나씩 만든다(계획 Task 3~6). 그 사이에 고른 형식이
 * 빈 카드로 나오면 무엇이 잘못됐는지 알 수 없으므로, **아직 못 그린다는 사실을 카드에 적는다.**
 * 템플릿이 다 붙으면 이 파일은 지운다.
 */
export function UnsupportedFormatBody({ format, theme }: { format: InfoFormat; theme: Theme }) {
  const label = INFO_FORMATS.find((f) => f.id === format)?.label ?? format;
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <span style={{ fontSize: 40, lineHeight: 1.4, color: theme.fg, opacity: 0.7 }}>
        &lsquo;{label}&rsquo; 형식은 아직 그릴 수 없어요
      </span>
    </div>
  );
}
