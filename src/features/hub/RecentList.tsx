import type { LedgerEntry } from "@/lib/ledger";
import { Badge } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = {
  cardnews: "카드뉴스",
  informationsend: "정보전달",
};

export function RecentList({ rows }: { rows: readonly LedgerEntry[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-3">아직 만든 게 없어요. 위에서 주제를 정하고 시작해 보세요.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hair-soft">
      {rows.map((row) => (
        <li key={`${row.ts}-${row.keyword}`} className="flex items-center gap-3 py-2.5">
          <Badge tone="neutral">{TYPE_LABEL[row.type] ?? row.type}</Badge>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.keyword}</span>
          <span className="flex-none tabular-nums text-xs text-ink-3">{row.count}장</span>
          <span className="flex-none tabular-nums text-xs text-ink-3">{row.ts.slice(0, 10)}</span>
        </li>
      ))}
    </ul>
  );
}
