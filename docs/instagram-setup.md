# 인스타그램 계정 연결하기

이 앱이 카드를 인스타그램에 바로 올리려면 준비가 필요합니다. 순서대로 하시면 됩니다.

이 문서는 **Instagram Login 방식**(`graph.instagram.com`) 기준입니다. 앱 코드가 그 방식으로
짜여 있습니다. 인터넷에서 흔히 보이는 "페이스북 페이지를 연결하라"는 안내는 **다른 방식**
(Facebook Login)의 것이라 여기서는 필요 없습니다.

> 이 절차는 2026-08-02 에 계정 `ys040607` 로 **실제 게시까지 성공한** 경로입니다.
> 앱 검수는 필요 없었습니다 — 본인 계정에만 올리는 경우 대시보드가 그 단계를 건너뛰라고 안내합니다.

---

## 0. 미리 알아 둘 것

- **60일마다 토큰을 갱신**해야 합니다(8단계). 안 하면 어느 날 갑자기 게시가 실패합니다.
- **공개 주소가 필요합니다**(7단계). 인스타 서버가 우리 PC 에서 사진을 **가져가는** 방식이라,
  게시하는 동안에는 사진이 인터넷에서 닿는 상태가 됩니다. 게시할 때만 켜는 걸 권합니다.
- 앱 시크릿과 토큰은 **`.env.local` 에만** 두세요. 채팅·이슈·스크린샷에 붙여넣지 마세요.

---

## 1. 인스타 계정을 프로페셔널로 바꾸기

개인 계정은 API 게시가 **안 됩니다.**

인스타 앱 → 프로필 → 설정 → 계정 → **프로페셔널 계정으로 전환** (비즈니스 또는 크리에이터).

---

## 2. Meta 개발자 등록과 앱 만들기

1. https://developers.facebook.com 에서 개발자 등록
2. **내 앱 → 앱 만들기**
3. 앱 유형은 **비즈니스(Business)** 를 고릅니다 — 다른 유형이면 나중에 갈아엎어야 합니다

---

## 3. Instagram 제품 추가

앱 대시보드에서 **Instagram** 제품을 추가하고, **API setup with Instagram login** 쪽을 고릅니다.

여기서 **Instagram 앱 ID** 와 **Instagram 앱 시크릿** 을 받습니다. 시크릿은 이때만 보이니
안전한 곳에 적어 두세요.

---

## 4. 권한 두 개

필요한 권한(scope)은 이 둘입니다.

| 권한 | 무엇에 쓰나 |
|---|---|
| `instagram_business_basic` | 계정 기본 정보 조회 |
| `instagram_business_content_publish` | 카드 올리기 |

본인 계정에만 올릴 거라면 보통 앱 심사 없이 개발 단계에서 쓸 수 있습니다. 다만 대시보드의
권한 상태가 **어떻게 표시되는지 확인**하세요 — Advanced Access 가 필요하다고 나오면 심사를
거쳐야 합니다.

---

## 5. 내 계정을 테스터로 추가

앱 대시보드에서 **본인 인스타 계정을 테스터로 추가**하고, 인스타 앱에서 **초대를 수락**합니다.
(인스타 앱 → 설정 → 웹사이트 권한 / 비즈니스 도구 쪽에 초대가 옵니다.)

이걸 안 하면 다음 단계에서 로그인은 되는데 권한이 안 붙습니다.

---

## 6. 토큰 받기 — 대시보드에서 한 번에

**Instagram → API 설정 → "1. 액세스 토큰 생성"** 으로 갑니다.

5단계에서 연결한 계정이 목록에 보입니다. 그 줄의 **"토큰 생성"** 을 누르면 **장기 토큰(60일)**
이 바로 나옵니다. 복사해서 안전한 곳에 두세요.

> 이 방법이 실제로 확인된 가장 짧은 길입니다. OAuth 로 코드를 받아 단기 → 장기로 교환하는
> 절차(아래 부록)는 **하지 않아도 됩니다.**

---

## 7. 계정 ID 확인

6단계와 **같은 화면**에 있습니다. 계정 이름(예: `ys040607`) 바로 아래 적힌 **숫자**가
계정 ID 입니다. 그대로 복사하면 됩니다.

토큰으로 직접 확인하고 싶으면:

```bash
curl -G https://graph.instagram.com/me \
  -d fields=user_id,username \
  -d access_token=<토큰>
```

- `user_id` → 앱에 넣을 **계정 ID**
- `username` → 앱의 "연결 확인" 이 보여 줄 이름. 여기 나온 계정이 맞는지 보세요

---

## 8. 공개 주소 만들기 (터널)

인스타 서버가 우리 PC 의 사진을 가져가야 해서, 3500 포트가 밖에서 닿아야 합니다.

`cloudflared` 예:

```bash
cloudflared tunnel --url http://localhost:3500
```

실행하면 `https://xxxx.trycloudflare.com` 같은 주소가 나옵니다. 그게 **공개 주소**입니다.

> 이 터널이 켜져 있는 동안에는 공유 링크가 인터넷에서도 열립니다. 게시가 끝나면 끄세요.
> 공유 링크 자체는 30분 뒤 만료되고, 토큰을 모르면 열 수 없습니다.

---

## 9. `.env.local` 에 넣기

저장소 루트에 `.env.local` 을 만들고(이미 있으면 덧붙이고):

```
PUBLIC_BASE_URL=https://xxxx.trycloudflare.com
INSTAGRAM_BUSINESS_ACCOUNT_ID=<7단계의 user_id>
INSTAGRAM_ACCESS_TOKEN=<6-3 의 장기 토큰>
```

이 파일은 git 에 올라가지 않습니다. 넣은 뒤 **dev 서버를 다시 시작**하세요.

---

## 10. 앱에서 확인

`/cardnews` → 카드 만들기 → 내보내기 화면 → 인스타 게시 패널에서 **연결 확인** 을 누릅니다.

- 잘 되면 연결된 계정 이름이 보입니다. **그 계정이 맞는지 확인하세요**
- 안 되면 무엇이 문제인지 한국어로 나옵니다

여기까지 되면 **인스타에 올리기** 버튼이 켜집니다.

---

## 60일마다 할 일

장기 토큰은 60일 뒤 만료됩니다. **24시간 이상 지난** 장기 토큰은 갱신할 수 있습니다:

```bash
curl -G https://graph.instagram.com/refresh_access_token \
  -d grant_type=ig_refresh_token \
  -d access_token=<지금 쓰는 장기 토큰>
```

나온 값으로 `.env.local` 의 토큰을 바꾸고 dev 서버를 다시 시작하세요.

---

## 잘 안 될 때

| 증상 | 볼 곳 |
|---|---|
| 연결 확인이 "토큰이 만료됐거나 권한이 없어요" | 6단계를 다시. 5단계(테스터 수락)를 건너뛰었을 수 있습니다 |
| "인스타그램이 사진을 가져가지 못했어요" | 8단계 터널이 꺼졌거나 `PUBLIC_BASE_URL` 이 틀림. 브라우저로 그 주소를 직접 열어 보세요 |
| "오늘 게시 한도를 다 썼어요" | 24시간에 100건 제한입니다 |
| 계정 이름이 다른 계정으로 나옴 | 6-1 에서 다른 계정으로 로그인했습니다. 다시 받으세요 |

---

## 부록 — OAuth 로 토큰 받기 (보통은 필요 없음)

6단계의 "토큰 생성" 버튼이 안 보이거나, 남의 계정에 올리는 앱을 만들 때만 이 길을 씁니다.

**6-1.** 대시보드의 **Business Login** 설정에서 리디렉션 URI 를 등록하고, 거기 나오는 로그인
URL 을 브라우저에서 엽니다. 로그인하면 리디렉션 주소 뒤에 `?code=...` 가 붙어 돌아옵니다.
그 `code` 를 복사하세요. **몇 분 안에 만료되니 바로 다음으로 갑니다.**

**6-2. 코드 → 단기 토큰(1시간)**

```bash
curl -X POST https://api.instagram.com/oauth/access_token \
  -F client_id=<인스타 앱 ID> \
  -F client_secret=<인스타 앱 시크릿> \
  -F grant_type=authorization_code \
  -F redirect_uri=<등록한 리디렉션 URI> \
  -F code=<6-1 에서 받은 code>
```

**6-3. 단기 → 장기 토큰(60일)**

```bash
curl -G https://graph.instagram.com/access_token \
  -d grant_type=ig_exchange_token \
  -d client_secret=<인스타 앱 시크릿> \
  -d access_token=<6-2 의 단기 토큰>
```

---

## 참고

- [Instagram Platform — Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- [Instagram API with Instagram Login — Get Started](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started)
- [Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login)
