import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:픽 카드 스튜디오",
  description: "키워드로 인스타 카드뉴스·정보전달 이미지를 생성합니다.",
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
