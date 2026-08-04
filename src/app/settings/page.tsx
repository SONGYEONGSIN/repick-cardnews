import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { InstagramSettings } from "@/features/settings/InstagramSettings";

/**
 * 설정 — 만들기 흐름과 **따로** 두는 것들. 지금은 인스타그램 연결(토큰)뿐이다.
 *
 * 게시 화면 안에 있던 토큰 갱신을 여기로 뺐다. 올릴 때마다 보게 되는 자리에 "가끔 한 번"
 * 하는 일이 섞여 있어 무엇을 먼저 눌러야 할지 흐렸다.
 */
export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[880px] flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link href="/" className={`flex w-fit items-center gap-1.5 text-[14px] font-bold text-ink-2 hover:text-ink ${FOCUS_RING}`}>
          <ArrowLeft size={15} aria-hidden="true" />
          만들기로 돌아가기
        </Link>
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">설정</h1>
      </header>
      <InstagramSettings />
    </main>
  );
}
