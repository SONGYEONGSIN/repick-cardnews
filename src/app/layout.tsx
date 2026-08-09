import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서맘 스튜디오 — 카드 만들기",
  description: "직접 작업한 사진으로 인스타 카드뉴스·정보전달 이미지를 만듭니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Do+Hyeon&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
