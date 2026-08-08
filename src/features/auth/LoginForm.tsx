"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FOCUS_RING } from "@/components/ui";

// 기존 입력칸(`HashtagInput.tsx:93`)과 같은 모양. 새 규격을 만들지 않는다.
const INPUT =
  "w-full rounded-lg border border-hair px-3 py-2 text-[15px] transition-colors duration-200 " +
  `placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:text-ink-disabled ${FOCUS_RING} motion-reduce:transition-none`;

/**
 * 비밀번호 한 칸. 여기서 판단하는 것은 없다 — 서버가 맞다고 하면 쿠키가 심겨 있고, 그때
 * 원래 가려던 곳으로 보낸다.
 */
export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // replace 라서 뒤로 가기로 로그인 화면에 다시 오지 않는다.
        router.replace("/");
        router.refresh();
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      const message =
        typeof body === "object" && body !== null && "error" in body && typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.";
      setError(message);
    } catch {
      setError("서버에 닿지 못했어요. 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-hair p-6">
      <Field label="비밀번호" htmlFor="password" hint="이 스튜디오를 쓸 수 있는 사람만 아는 값이에요">
        <input
          id="password"
          type="password"
          value={password}
          autoComplete="current-password"
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy || password.length === 0}>
          {busy ? "확인하는 중이에요…" : "들어가기"}
        </Button>
      </div>
    </form>
  );
}
