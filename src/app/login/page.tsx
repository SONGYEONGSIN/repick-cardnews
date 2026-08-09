import { LoginForm } from "@/features/auth/LoginForm";
import { SectionHead } from "@/features/shell/StudioFrame";

/**
 * 로그인 — 서맘 스튜디오의 유일한 문이다.
 *
 * 인터넷에 올라가 있으므로 주소를 아는 사람은 누구나 여기까지 온다. 여기서 막히면 그다음은
 * 없다. **`/s/*`(인스타그램이 카드 이미지를 가져가는 길)만 이 문을 지나지 않는다.**
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center gap-8 px-6 py-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">서맘 스튜디오</h1>
        <p className="text-[15px] text-ink-2">사진을 카드뉴스로 만드는 작업실이에요.</p>
      </header>

      <section className="flex flex-col gap-4">
        <SectionHead title="들어가기" aside="이 기기에서 30일 동안 기억해요" />
        <LoginForm />
      </section>
    </main>
  );
}
