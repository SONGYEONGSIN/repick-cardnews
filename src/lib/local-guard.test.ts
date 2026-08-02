import { describe, it, expect } from "vitest";
import { isLocalHost } from "@/lib/local-guard";

describe("isLocalHost", () => {
  it("localhost(포트 포함)를 로컬로 인정한다", () => {
    expect(isLocalHost("localhost:3500")).toBe(true);
  });

  it("localhost(포트 없음)를 로컬로 인정한다", () => {
    expect(isLocalHost("localhost")).toBe(true);
  });

  it("127.0.0.1(포트 포함)을 로컬로 인정한다", () => {
    expect(isLocalHost("127.0.0.1:3500")).toBe(true);
  });

  it("127.0.0.1(포트 없음)을 로컬로 인정한다", () => {
    expect(isLocalHost("127.0.0.1")).toBe(true);
  });

  it("IPv6 루프백([::1])을 로컬로 인정한다", () => {
    expect(isLocalHost("[::1]:3500")).toBe(true);
    expect(isLocalHost("[::1]")).toBe(true);
  });

  it("대소문자를 가리지 않는다", () => {
    expect(isLocalHost("LOCALHOST:3500")).toBe(true);
  });

  it("집 네트워크(LAN) IP는 로컬이 아니다", () => {
    expect(isLocalHost("192.168.0.5:3500")).toBe(false);
    expect(isLocalHost("10.0.0.7:3500")).toBe(false);
    expect(isLocalHost("172.16.4.2:3500")).toBe(false);
  });

  it("외부 도메인은 로컬이 아니다", () => {
    expect(isLocalHost("evil.com")).toBe(false);
    expect(isLocalHost("example.ngrok-free.app")).toBe(false);
  });

  it("localhost/127.0.0.1을 포함만 하는 위장 호스트는 통과시키지 않는다", () => {
    expect(isLocalHost("localhost.evil.com")).toBe(false);
    expect(isLocalHost("127.0.0.1.evil.com")).toBe(false);
    expect(isLocalHost("evil.com/localhost")).toBe(false);
  });

  it("null·undefined·빈 문자열·공백은 로컬이 아니다", () => {
    expect(isLocalHost(null)).toBe(false);
    expect(isLocalHost(undefined)).toBe(false);
    expect(isLocalHost("")).toBe(false);
    expect(isLocalHost("   ")).toBe(false);
  });

  it("손상되거나 여러 값을 쑤셔넣은 헤더 값은 안전하게 거부한다", () => {
    expect(isLocalHost("localhost, evil.com")).toBe(false);
    expect(isLocalHost("127.0.0.1:3500:extra")).toBe(false);
    expect(isLocalHost("0.0.0.0:3500")).toBe(false);
  });
});
