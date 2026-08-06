# 늘 켜 두는 맥에 올려 도메인으로 쓰기 — 구현 계획

> **에이전트에게:** 이 계획은 `superpowers:executing-plans` 또는
> `superpowers:subagent-driven-development` 로 태스크 단위로 실행한다. 체크박스(`- [ ]`)로 추적한다.

설계: `docs/superpowers/specs/2026-08-06-self-host-deploy-design.md`

**Goal:** 늘 켜져 있는 데스크톱 맥에서 프로덕션 빌드를 돌리고, Cloudflare 이름 있는 터널로
고정 도메인을 붙이고, Cloudflare Access 로 나만 들어가게 한다.

**Architecture:** 앱 코드는 바꾸지 않는다. 운영본을 별도 폴더에 clone 해 개발본과 `.next`·
데이터·포트를 분리하고, LaunchAgent 두 개(웹 서버·터널)로 상시 실행한다. 로그인은 앱이 아니라
Cloudflare Access 가 담당하며 `/s/*` 만 예외로 열어 인스타그램이 이미지를 가져가게 한다.

**Tech Stack:** Next.js 16 (`next start`) · cloudflared (named tunnel) · Cloudflare Access ·
macOS `launchd` (LaunchAgent) · `pmset`

## 이 계획의 성격

**대부분이 코드가 아니라 운영 설정이다.** 그래서 태스크마다 RED→GREEN 대신 **실측 통과 기준**을
둔다. 코드를 고치게 되는 유일한 경우는 Task 3 에서 빌드가 깨질 때이며, 그때는 저장소 규칙대로
RED→GREEN 을 적용한다.

각 단계 앞의 표시:
- **[나]** — 내가 실행한다
- **[사람]** — 사장님이 직접 해야 한다 (sudo 비밀번호 · 브라우저 로그인 · 대시보드 · 재부팅)

**기다릴 때는 `sleep` 을 쓰지 않는다.** 이 하네스는 앞단 `sleep` 을 막는다. 대신 조건이
찰 때까지 짧게 되묻는다 — 필요한 만큼만 기다리므로 더 빠르기도 하다:

```bash
# 예: 서버가 응답할 때까지 최대 40초
for i in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:3600/ && break
  perl -e 'select(undef,undef,undef,1)'
done
```

## Global Constraints

- **앱 코드 변경은 0줄이다.** `src/**` 를 고치게 되면 계획이 틀린 것이니 멈추고 보고한다
  (예외: Task 3 에서 빌드가 깨질 때)
- **`.env.local` 을 열지 않는다.** 값 옮기기는 사람이 한다. 값을 응답·로그·문서에 옮기지 않는다
- **`git add -A` 금지.** 만든 경로만 명시적으로 add 한다
- **Cloudflare 대시보드의 메뉴 이름·클릭 순서를 문서에 적지 않는다.** 확인하지 않은 값이고 자주
  바뀐다. 정책이 걸렸는지는 Task 7 의 검증으로만 판단한다
- 포트: **개발본 3500, 운영본 3600.** 둘이 동시에 돌아야 한다
- 운영본 웹 서버는 **`-H 127.0.0.1`** 로 묶는다. 같은 와이파이의 다른 기기가 Access 를 건너뛰고
  직접 들어오지 못하게 한다. 터널은 같은 맥에서 붙으므로 영향이 없다
- 문서·설정 변경도 **검증 없이 완료 선언하지 않는다**

## 경로 한눈에

| 무엇 | 어디 |
|---|---|
| 개발본 | `~/개발/build/repick-cardnews` (3500) |
| 운영본 | `~/repick-prod` (3600) |
| 예약 데이터 | `~/repick-data/scheduled` |
| 웹 서버 LaunchAgent | `~/Library/LaunchAgents/com.repick.web.plist` |
| 터널 LaunchAgent | `~/Library/LaunchAgents/com.repick.tunnel.plist` |
| 터널 설정 | `~/.cloudflared/config.yml` |
| 운영 문서 | `docs/deploy-setup.md` (Task 10 에서 만든다) |

---

### Task 1: `claude -p` 가 백그라운드 세션에서 도는가 — 위험 관문

**여기서 갈린다.** 실패하면 카피 생성이 통째로 죽고 설계를 다시 짜야 한다. **다른 것을
만들기 전에 이것부터 본다.**

**Files:**
- Create: `~/Library/LaunchAgents/com.repick.claude-probe.plist` (검사용, 끝나면 지운다)

- [ ] **Step 1: [나] 검사용 LaunchAgent 를 만든다**

```bash
cat > ~/Library/LaunchAgents/com.repick.claude-probe.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.repick.claude-probe</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>claude -p '정확히 이 한 단어만 답해: 성공' > /tmp/claude-probe.out 2> /tmp/claude-probe.err</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
PLIST
```

`/bin/zsh -lc` 를 거치는 이유: 로그인 셸의 `PATH` 를 받아야 `claude` 를 찾는다. LaunchAgent 의
기본 `PATH` 에는 없다.

- [ ] **Step 2: [나] 띄우고 결과를 본다**

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.repick.claude-probe.plist
for i in $(seq 1 90); do
  [ -s /tmp/claude-probe.out ] && break
  perl -e 'select(undef,undef,undef,1)'
done
cat /tmp/claude-probe.out; echo "--- 오류 ---"; cat /tmp/claude-probe.err
```

**통과 기준:** `/tmp/claude-probe.out` 에 `성공` 이 있다.
**실패 기준:** 비어 있거나, `.err` 에 인증·자격 관련 오류가 있다.

- [ ] **Step 3: [나] 검사용 agent 를 지운다**

```bash
launchctl bootout gui/$(id -u)/com.repick.claude-probe 2>/dev/null
rm -f ~/Library/LaunchAgents/com.repick.claude-probe.plist /tmp/claude-probe.out /tmp/claude-probe.err
```

- [ ] **Step 4: 실패했다면 여기서 멈추고 보고한다**

계획을 계속 진행하지 않는다. 카피 생성이 안 되는 서버는 올릴 이유가 없다.

**커밋 없음** — 저장소를 건드리지 않는다.

**주의:** 이 검사는 **지금 로그인된 세션**에서 도는 것만 증명한다. 재부팅 뒤에도 되는지는
Task 9 에서 다시 본다.

---

### Task 2: 운영본을 clone 하고 설정한다

**Files:**
- Create: `~/repick-prod/` (clone)
- Create: `~/repick-data/scheduled/`
- Create: `~/repick-prod/.env.local` **([사람] 이 만든다)**

- [ ] **Step 1: [나] 운영본을 clone 하고 의존성을 깐다**

```bash
git clone ~/개발/build/repick-cardnews ~/repick-prod
cd ~/repick-prod && git remote set-url origin https://github.com/<소유자>/<저장소>.git
git fetch origin && git checkout main && git reset --hard origin/main
npm ci
```

`<소유자>/<저장소>` 는 개발본에서 `git remote get-url origin` 으로 읽어 그대로 쓴다.

- [ ] **Step 2: [나] 예약 데이터 폴더를 만든다**

```bash
mkdir -p ~/repick-data/scheduled
```

- [ ] **Step 3: [사람] 운영본 `.env.local` 을 만든다**

개발본 `~/개발/build/repick-cardnews/.env.local` 을 `~/repick-prod/.env.local` 로 복사한 뒤
**두 줄만** 고친다. (나는 이 파일을 열지 않는다.)

```
REPICK_SCHEDULE_ROOT=/Users/<사용자>/repick-data/scheduled
PUBLIC_BASE_URL=https://<도메인>
```

`<사용자>` 는 `echo $HOME` 이 알려 주는 실제 경로로 적는다 — **`.env.local` 은 `~` 나 `$HOME`
을 풀어 주지 않는다.** 전체 경로를 그대로 써야 한다.

`PUBLIC_BASE_URL` 은 Task 6 에서 도메인이 정해진 뒤 채운다. 그 전까지는 개발본 값을 그대로 둔다.

- [ ] **Step 4: [나] 두 줄이 들어갔는지 값 없이 확인한다**

```bash
grep -c '^REPICK_SCHEDULE_ROOT=' ~/repick-prod/.env.local
grep -c '^PUBLIC_BASE_URL=' ~/repick-prod/.env.local
```

**통과 기준:** 둘 다 `1`. 값은 출력하지 않는다.

**커밋 없음** — 저장소 밖 작업이다.

---

### Task 3: 운영본에서 프로덕션 빌드가 되는지 본다

**이 저장소에서 `npm run build` 를 한 번도 돌려 본 적이 없다.**

**Files:**
- 없음 (빌드가 깨지면 그때 `src/**` 를 고친다)

- [ ] **Step 1: [나] 빌드한다**

```bash
cd ~/repick-prod && npm run build > /tmp/repick-build.log 2>&1; echo "exit=$?"
tail -30 /tmp/repick-build.log
```

출력을 파일로 보내는 이유는 빌드 로그가 길어 컨텍스트를 덮기 때문이다.

**통과 기준:** `exit=0`.

- [ ] **Step 2: 깨졌다면 고친다 — 여기만 코드를 만진다**

`/tmp/repick-build.log` 의 오류 전문을 읽고 원인을 짚는다. 찍어맞추지 않는다.
**수정은 개발본(`~/개발/build/repick-cardnews`)에서 한다.** 판단 로직이면 실패하는 테스트를
먼저 쓰고(RED) 고친다(GREEN). 고친 뒤:

```bash
cd ~/개발/build/repick-cardnews
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | wc -c   # 0 이어야 한다
git add <고친 파일들>
git commit -m "fix: 프로덕션 빌드가 깨지던 <원인> 수정"
```

그다음 운영본에 반영하고 다시 빌드한다:

```bash
cd ~/repick-prod && git fetch origin && git reset --hard origin/main && npm run build
```

- [ ] **Step 3: [나] 운영본을 손으로 한 번 띄워 본다**

```bash
cd ~/repick-prod && npx next start -H 127.0.0.1 -p 3600 > /tmp/repick-manual.log 2>&1 &
for i in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:3600/ && break
  perl -e 'select(undef,undef,undef,1)'
done
curl -s -o /dev/null -w "/ %{http_code}\n" http://127.0.0.1:3600/
curl -s -o /dev/null -w "/info %{http_code}\n" http://127.0.0.1:3600/info
curl -s -o /dev/null -w "개발본 %{http_code}\n" http://127.0.0.1:3500/
```

**통과 기준:** 둘 다 `200`. 개발본(3500)도 그대로 살아 있어야 한다.

- [ ] **Step 4: [나] 손으로 띄운 것을 끈다**

```bash
pkill -f "next start -H 127.0.0.1 -p 3600"
```

Task 5 에서 LaunchAgent 가 다시 띄운다.

---

### Task 4: 맥이 잠들지 않게 하고 자동 로그인을 켠다

**Files:** 없음 (시스템 설정)

- [ ] **Step 1: [사람] 잠자기를 끈다**

지금 `sleep 1` 이라 방치하면 1분 뒤 잠든다. 터미널에 `!` 를 붙여 이 세션에서 실행하면 결과가
바로 보인다:

```
! sudo pmset -a sleep 0
```

- [ ] **Step 2: [나] 반영됐는지 확인한다**

```bash
pmset -g | grep -E "^ sleep"
```

**통과 기준:** `sleep 0` (뒤에 `sleep prevented by ...` 가 붙어 있어도 값이 `0` 이어야 한다).

- [ ] **Step 3: [사람] 자동 로그인을 켠다**

시스템 설정 → 사용자 및 그룹 → 자동 로그인. **왜 필요한가:** LaunchAgent 는 사용자 세션에서만
돈다. 재부팅 뒤 아무도 로그인하지 않으면 서버도 터널도 안 올라온다. `claude -p` 의 로컬 자격도
사용자 세션에 묶여 있다.

FileVault 가 켜져 있으면 자동 로그인이 막힐 수 있다. 그 경우 재부팅 뒤 **한 번은 사람이
로그인해야 한다** — Task 9 에서 어느 쪽인지 확인하고 Task 10 문서에 사실대로 적는다.

---

### Task 5: 웹 서버를 LaunchAgent 로 등록한다

**Files:**
- Create: `~/Library/LaunchAgents/com.repick.web.plist`

- [ ] **Step 1: [나] plist 를 만든다**

```bash
cat > ~/Library/LaunchAgents/com.repick.web.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.repick.web</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd $HOME/repick-prod || exit 1; exec npx next start -H 127.0.0.1 -p 3600</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/repick-data/web.log</string>
  <key>StandardErrorPath</key><string>$HOME/repick-data/web.err.log</string>
</dict>
</plist>
PLIST
```

`KeepAlive` 가 죽은 프로세스를 다시 띄운다. 로그를 `~/repick-data/` 에 두는 이유는 `/tmp` 가
재부팅 때 비워지기 때문이다.

**`&&` 를 쓰지 않고 `|| exit 1;` 을 쓴 이유:** plist 는 XML 이라 `&` 를 그대로 못 넣는다
(`&amp;` 로 써야 한다). 세미콜론이면 그 함정을 아예 피한다.

- [ ] **Step 2: [나] 띄우고 응답을 본다**

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.repick.web.plist
for i in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:3600/ && break
  perl -e 'select(undef,undef,undef,1)'
done
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3600/
```

**통과 기준:** `200`.

- [ ] **Step 3: [나] 죽이면 다시 뜨는지 본다**

```bash
pkill -f "next start -H 127.0.0.1 -p 3600"
for i in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:3600/ && break
  perl -e 'select(undef,undef,undef,1)'
done
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3600/
```

**통과 기준:** 다시 `200`. 이게 안 되면 `KeepAlive` 가 안 걸린 것이다.

- [ ] **Step 4: [나] 다른 기기에서 못 들어오는지 본다**

```bash
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1)
curl -s -m 5 -o /dev/null -w "%{http_code}\n" "http://$IP:3600/" || echo "닿지 않음(정상)"
```

**통과 기준:** `000` 또는 닿지 않음. `200` 이면 `-H 127.0.0.1` 이 안 걸린 것이다.

---

### Task 6: 이름 있는 터널을 만들어 도메인에 붙인다

**Files:**
- Create: `~/.cloudflared/config.yml`
- Create: `~/Library/LaunchAgents/com.repick.tunnel.plist`
- Modify: `~/repick-prod/.env.local` (`PUBLIC_BASE_URL`) **([사람])**

- [ ] **Step 1: [사람] Cloudflare 에 로그인해 자격을 받는다**

```
! cloudflared tunnel login
```

브라우저가 열린다. 쓸 도메인을 고르면 자격 파일이 `~/.cloudflared/` 에 떨어진다.

- [ ] **Step 2: [나] 터널을 만들고 도메인을 연결한다**

```bash
cloudflared tunnel create repick
cloudflared tunnel route dns repick <도메인>
cloudflared tunnel list
```

`<도메인>` 은 사장님이 정한다(예: `카드뉴스.내도메인.com` 형태의 하위 도메인). `tunnel list` 에
나온 **터널 ID** 를 다음 단계에서 쓴다.

- [ ] **Step 3: [나] 설정 파일을 쓴다**

```bash
cat > ~/.cloudflared/config.yml <<YAML
tunnel: repick
credentials-file: $HOME/.cloudflared/<터널ID>.json
ingress:
  - hostname: <도메인>
    service: http://127.0.0.1:3600
  - service: http_status:404
YAML
```

마지막 `http_status:404` 는 cloudflared 가 요구하는 기본 규칙이다 — 없으면 뜨지 않는다.

- [ ] **Step 4: [나] 터널을 LaunchAgent 로 등록한다**

```bash
cat > ~/Library/LaunchAgents/com.repick.tunnel.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.repick.tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>exec cloudflared tunnel run repick</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/repick-data/tunnel.log</string>
  <key>StandardErrorPath</key><string>$HOME/repick-data/tunnel.err.log</string>
</dict>
</plist>
PLIST
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.repick.tunnel.plist
for i in $(seq 1 60); do
  grep -q "Registered tunnel connection" ~/repick-data/tunnel.err.log 2>/dev/null && break
  perl -e 'select(undef,undef,undef,1)'
done
tail -3 ~/repick-data/tunnel.err.log
```

cloudflared 는 진행 상황을 표준 오류로 낸다 — `tunnel.err.log` 가 비어 있으면 뜨지 않은 것이다.

- [ ] **Step 5: [나] 도메인으로 응답이 오는지 본다**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<도메인>/
```

**통과 기준:** `200`. (Access 는 아직 안 걸었으므로 이 시점에는 **누구나 열린다** — 다음
태스크에서 바로 막는다. 그 전에 주소를 남에게 알리지 않는다.)

- [ ] **Step 6: [사람] `PUBLIC_BASE_URL` 을 도메인으로 바꾼다**

`~/repick-prod/.env.local` 의 `PUBLIC_BASE_URL=https://<도메인>` (끝에 `/` 없이).

- [ ] **Step 7: [나] 웹 서버를 다시 띄워 새 값을 읽게 한다**

```bash
launchctl kickstart -k gui/$(id -u)/com.repick.web
for i in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:3600/ && break
  perl -e 'select(undef,undef,undef,1)'
done
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3600/
```

**통과 기준:** `200`.

---

### Task 7: Access 로 막고, `/s/*` 만 연다

**Files:** 없음 (Cloudflare 설정)

- [ ] **Step 1: [사람] Access 정책 두 개를 만든다**

| 대상 | 정책 |
|---|---|
| `<도메인>` 전체 | 내 이메일만 통과 |
| `<도메인>` 의 `/s` 경로 | **우회(bypass)** — 누구나 |

경로가 더 구체적인 규칙이 이깁니다. 화면 메뉴 이름은 여기 적지 않는다 — 아래 검증이 판단
기준이다.

- [ ] **Step 2: [나] 화면이 막히는지 본다**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L https://<도메인>/
```

**통과 기준:** `200` 이 아니다(302 또는 Access 로그인 화면). 앱 화면이 그대로 나오면 **막히지
않은 것이다.**

- [ ] **Step 3: [나] 이미지 경로는 열리는지 본다 — 이게 핵심 검증이다**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<도메인>/s/존재하지않는토큰/1.png"
```

**통과 기준:** **`404`** — 앱까지 도달했다는 뜻이다.
**실패:** `302`/로그인 화면이면 우회가 안 걸렸고, **예약 발행이 전부 실패한다.**

- [ ] **Step 4: [사람] 브라우저로 로그인해서 들어가 본다**

`https://<도메인>/` 에서 이메일 확인을 거친 뒤 화면이 뜨는지 본다.

- [ ] **Step 5: [나] API 도 로그인 뒤에만 열리는지 본다**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<도메인>/api/instagram-status
```

**통과 기준:** `200` 이 아니다. `200` 이면 API 가 밖에 열려 있는 것이다.

---

### Task 8: 실제로 한 건 예약해서 올린다

**Files:** 없음

- [ ] **Step 1: [사람] 브라우저에서 카드를 만들고 2~3분 뒤로 예약한다**

폰이든 맥이든 상관없다. 사진 → 카피 → 카드 → 내보내기 → 인스타그램 → 예약 업로드.

- [ ] **Step 2: [나] 스케줄러가 집어가는지 본다**

```bash
tail -20 ~/repick-data/web.err.log
ls ~/repick-data/scheduled/
```

- [ ] **Step 3: [사람] 인스타그램에 실제로 올라왔는지 확인한다**

**통과 기준:** 게시물이 보인다. 이게 이번 작업의 진짜 성공 기준이다 — 나머지는 전부 이걸
위한 준비다.

- [ ] **Step 4: 실패했다면 원인을 로그에서 짚는다**

`web.err.log` 의 `[예약 게시 실패]` 줄에 이유가 한국어로 남는다. 터널·주소·토큰 중 어느
것인지 구분해서 알려 준다. 찍어맞추지 않는다.

---

### Task 9: 재부팅해도 스스로 올라오는지 본다

**Files:** 없음

- [ ] **Step 1: [사람] 맥을 재부팅한다**

- [ ] **Step 2: [나] 로그인 없이 올라왔는지 본다**

```bash
for i in $(seq 1 120); do
  curl -sf -o /dev/null http://127.0.0.1:3600/ && break
  perl -e 'select(undef,undef,undef,1)'
done
launchctl print gui/$(id -u)/com.repick.web 2>/dev/null | grep -E "state|pid" | head -3
curl -s -o /dev/null -w "로컬 %{http_code}\n" http://127.0.0.1:3600/
curl -s -o /dev/null -w "도메인 %{http_code}\n" -L https://<도메인>/
```

**통과 기준:** 로컬 `200`, 도메인은 Access 화면(200 아님).

- [ ] **Step 3: [나] 재부팅 뒤에도 `claude -p` 가 도는지 다시 본다**

Task 1 은 **이미 로그인된 세션**만 증명했다. 재부팅 뒤 자동 로그인 세션에서도 되는지가 진짜
질문이다. 브라우저에서 카피를 한 번 만들어 본다. 또는:

```bash
/bin/zsh -lc "claude -p '정확히 이 한 단어만 답해: 성공'"
```

**통과 기준:** `성공`. 안 되면 Task 4 의 자동 로그인/FileVault 문제이므로 Task 10 문서에
"재부팅 뒤 사람이 한 번 로그인해야 한다" 를 사실대로 적는다.

---

### Task 10: 운영 문서를 남긴다

**Files:**
- Create: `docs/deploy-setup.md`
- Modify: `CLAUDE.md` ("반드시 읽을 것" 목록에 한 줄)

- [ ] **Step 1: [나] `docs/deploy-setup.md` 를 쓴다**

담을 것 — **실제로 한 것만 적는다. 안 해 본 것을 적지 않는다.**

- 경로 표(개발본/운영본/데이터/plist/터널 설정)와 포트(3500/3600)
- 배포 절차 (복사해서 쓰는 블록):
  ```bash
  cd ~/repick-prod && git fetch origin && git reset --hard origin/main
  npm ci && npm run build
  launchctl kickstart -k gui/$(id -u)/com.repick.web
  ```
- Access 정책 두 줄과 **`/s/*` 는 404 가 나와야 한다**는 검증법
- 안 될 때 어디를 보나: `~/repick-data/web.err.log`, `tunnel.err.log`
- `claude -p` 자격이 만료되면 **맥에서 직접 다시 로그인해야 한다** (밖에서는 못 고친다)
- 재부팅 뒤 사람 로그인이 필요한지 여부 (Task 9 결과 그대로)

- [ ] **Step 2: [나] `CLAUDE.md` 에 한 줄 넣는다**

"반드시 읽을 것" 목록에 `- 서버를 옮기거나 배포를 건드리면 → docs/deploy-setup.md` 를 넣는다.

- [ ] **Step 3: [나] 검증하고 커밋한다**

```bash
cd ~/개발/build/repick-cardnews
npx vitest run 2>&1 | tail -3
npx tsc --noEmit 2>&1 | wc -c
git add docs/deploy-setup.md CLAUDE.md
git commit -m "docs: 운영 서버 설정과 배포 절차"
```

---

### Task 11: 폰에서 쓸 만한지 본다 — 사람만 할 수 있다

**Files:** 없음 (고칠 것이 나오면 별도 작업으로 분리한다)

- [ ] **Step 1: [사람] 폰으로 `https://<도메인>` 에 들어가 끝까지 해 본다**

보는 것:
1. **사진 넣기가 되는가** — `Dropzone.tsx:76` 이 폴더 통째 선택(`webkitdirectory`)인데 iOS
   사파리는 이 속성을 무시한다. 무시되면 일반 사진 선택으로 떨어져 **아마 동작하지만 확인한
   적이 없다**
2. **작업대 화면이 쓸 만한가** — `design:audit` 폭 스위프는 `/`·`/info` 만 훑는다. 사진과
   카드가 있어야 열리는 화면은 자동으로 안 잡힌다
3. 카드가 화면 밖으로 나가지 않는가

- [ ] **Step 2: [나] 결과를 정리한다**

고칠 것이 나오면 **이 계획에서 고치지 않는다.** 별도 작업으로 분리한다 — 이번 범위는 "올리는
것" 이고, 폰 화면 개선은 다른 문제다.

---

## 사람이 확인해야 하는 것 (요약)

- 인스타그램에 **실제로 올라오는가** (Task 8) — 이것이 성공 기준이다
- 재부팅 뒤 **스스로 올라오는가**, 그때 `claude -p` 도 도는가 (Task 9)
- **폰에서 쓸 만한가** (Task 11)

## 멈춰야 하는 지점

- **Task 1 실패** — `claude -p` 가 백그라운드에서 안 돌면 설계를 다시 짠다
- **Task 7 Step 3 실패** — `/s/*` 가 안 열리면 예약 발행이 전부 실패한다. 고치기 전에 진행하지 않는다
- **`src/**` 를 고치게 되는 상황** (Task 3 빌드 오류 제외) — 계획이 틀린 것이니 보고한다
