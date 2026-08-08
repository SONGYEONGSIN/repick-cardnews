import type { NextConfig } from "next";

/**
 * 카피 생성은 `claude` 실행 파일을 **자식 프로세스로 띄운다**(`src/lib/claude-cli.ts`).
 *
 * Next 의 추적기는 `import` 를 따라가며 배포에 실을 파일을 고른다. 실행 파일은 `import` 로
 * 들어오지 않고 이름만 넘겨 `spawn` 하므로 **추적에 안 잡힌다** — 그대로 배포하면 서버에는
 * 그 파일이 없고 카피 생성이 ENOENT 로 죽는다. 그래서 여기서 명시적으로 실어 준다.
 *
 * 플랫폼별로 패키지가 갈리므로(`claude-code-linux-x64` 등) 이름을 하나로 못 박지 않는다.
 * 실제로 어느 것이 깔릴지는 빌드하는 기계가 정한다.
 */
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/@anthropic-ai/claude-code*/**"],
  },
};

export default nextConfig;
