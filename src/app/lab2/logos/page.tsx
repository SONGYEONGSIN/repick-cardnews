import { LOGO_VARIANTS } from "./marks";

/**
 * 로고 시안 비교대.
 *
 * 로고는 큰 화면에서 예쁜 것보다 **작을 때 살아남는 것**이 중요하다. 그래서 56 / 32 / 20px
 * 세 크기를 나란히 두고, 어두운 바탕 반전까지 같이 본다 — 실제로는 사이드바(34px)와
 * 파비콘·모바일(20px 대)에서 주로 보인다.
 */
export default function LogoLabPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="flex flex-col gap-2 border-b border-hair px-8 py-7">
        <h1 className="text-[28px] font-black tracking-tight">로고 시안 6종</h1>
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          축은 색이 아니라 <span className="font-bold text-ink">무엇을 상징으로 삼는가</span>예요. 여섯이 서로 다른
          것을 말합니다. 작을 때 형태가 남는지가 로고의 조건이라 56 · 32 · 20px 을 나란히 두고 어두운 바탕 반전도
          같이 뒀어요.
        </p>
      </header>

      <ul className="flex flex-col">
        {LOGO_VARIANTS.map(({ id, name, Mark, concept, says, risk }) => (
          <li key={id} className="grid gap-6 border-b border-hair px-8 py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <h2 className="text-[19px] font-black tracking-tight">{name}</h2>

              <div className="flex items-end gap-7">
                <Mark size={56} label={`${name} 56px`} />
                <Mark size={32} label={`${name} 32px`} />
                <Mark size={20} label={`${name} 20px`} />
              </div>

              <div className="flex items-end gap-7 rounded-xl bg-ink px-5 py-4 text-surface">
                <Mark size={56} label={`${name} 반전 56px`} cut="fill-ink" />
                <Mark size={32} label={`${name} 반전 32px`} cut="fill-ink" />
                <Mark size={20} label={`${name} 반전 20px`} cut="fill-ink" />
              </div>
            </div>

            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] font-bold text-ink-2">형태</dt>
                <dd className="text-[15px] font-bold tracking-tight">{concept}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] font-bold text-ink-2">말하는 것</dt>
                <dd className="text-[15px] leading-relaxed">{says}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] font-bold text-ink-2">약점</dt>
                <dd className="text-[15px] leading-relaxed text-ink-2">{risk}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="px-8 py-8">
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          고르는 기준을 하나 제안하면 — <span className="font-bold text-ink">이름이 없어도 무엇을 만드는 곳인지 말하는가</span>
          입니다. 워드마크를 빼기로 했으니 마크가 그 몫까지 져야 해요. 그 기준이면 F(카드 해부도)와 A(기대어 선 두 장)가
          앞서고, C·E 는 이름이나 도구만 말하고 산출물은 말하지 않습니다.
        </p>
      </div>
    </div>
  );
}
