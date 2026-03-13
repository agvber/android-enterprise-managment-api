# Android Management Console (AMM) - 개발 문서

## 개요

Android Management API를 웹 UI로 감싸서, 개발자가 직접 API를 호출하지 않고도 Android 기기를 관리할 수 있는 정적 웹 애플리케이션입니다.

- **프레임워크**: Next.js 16 (App Router) + TypeScript
- **스타일링**: Tailwind CSS 4
- **차트**: Recharts
- **빌드 방식**: 정적 HTML 출력 (`next export`) — 서버 불필요
- **인증**: Google OAuth2 (Authorization Code Flow)
- **API 통신**: 브라우저에서 직접 Google REST API 호출 (서버 프록시 없음)

---

## 디렉토리 구조

```
amm/
├── out/                          # 빌드 결과물 (정적 HTML/JS/CSS)
├── src/
│   ├── app/
│   │   ├── globals.css           # Tailwind CSS 임포트
│   │   ├── layout.tsx            # 루트 레이아웃 (HTML head, body)
│   │   ├── page.tsx              # 로그인 페이지 (/)
│   │   └── dashboard/
│   │       └── page.tsx          # 메인 대시보드 (/dashboard)
│   ├── components/
│   │   └── PolicyVisualEditor.tsx # 정책 비주얼 편집기 컴포넌트
│   └── lib/
│       └── google-api.ts         # Google API 클라이언트 (인증 + 모든 API 호출)
├── .env.local                    # 환경변수 (NEXT_PUBLIC_BASE_URL)
├── next.config.ts                # Next.js 설정 (output: "export")
├── postcss.config.mjs            # PostCSS + Tailwind 설정
├── tsconfig.json                 # TypeScript 설정
└── package.json                  # 의존성 및 스크립트
```

---

## 파일별 상세 설명

### `src/lib/google-api.ts` (264줄)

**역할**: Google API와의 모든 통신을 담당하는 클라이언트 라이브러리

| 섹션 | 함수 | 설명 |
|------|------|------|
| **인증** | `getAuthUrl()` | Google OAuth2 인증 URL 생성 |
| | `exchangeCode(code)` | Authorization Code → Access Token 교환 |
| | `refreshAccessToken(refreshToken)` | Refresh Token으로 Access Token 갱신 |
| **토큰 관리** | `saveAuth(tokens)` | localStorage에 토큰 저장 |
| | `clearAuth()` | 토큰 삭제 (로그아웃) |
| | `isAuthenticated()` | 인증 여부 확인 |
| | `getAccessToken()` | 유효한 Access Token 반환 (자동 갱신 포함) |
| **API 헬퍼** | `amApi(path, options)` | Android Management API REST 호출 래퍼 |
| **GCP 프로젝트** | `listProjects()` | Cloud Resource Manager API로 프로젝트 목록 조회 |
| **Enterprise** | `listEnterprises(projectId)` | 프로젝트의 Enterprise 목록 조회 |
| | `getEnterprise(name)` | Enterprise 상세 조회 |
| | `createSignupUrl(projectId, callbackUrl)` | Enterprise 가입 URL 생성 |
| | `completeEnterpriseSignup(...)` | Enterprise 가입 완료 |
| **기기** | `listDevices(enterpriseName)` | 기기 목록 조회 |
| | `getDevice(deviceName)` | 기기 상세 조회 (전체 필드) |
| | `deleteDevice(deviceName)` | 기기 삭제 |
| | `issueCommand(deviceName, command)` | 기기 명령 전송 (잠금/재부팅 등) |
| **정책** | `listPolicies(enterpriseName)` | 정책 목록 조회 |
| | `getPolicy(policyName)` | 정책 상세 조회 |
| | `upsertPolicy(policyName, policy)` | 정책 생성/수정 (PATCH) |
| | `deletePolicy(policyName)` | 정책 삭제 |
| **등록 토큰** | `createEnrollmentToken(enterprise, policy)` | QR코드용 Enrollment Token 생성 |

**OAuth 설정**:
- Client ID/Secret: Google Android Management API 샘플용 공개 클라이언트
- Redirect URI: `https://google.github.io/android-management-api-samples/oauth_callback.html`
- Scopes: `androidmanagement` + `cloud-platform.read-only`

---

### `src/app/page.tsx` (94줄)

**역할**: 로그인 페이지 (`/`)

**동작 흐름**:
1. `isAuthenticated()` 확인 → 인증됨이면 `/dashboard`로 리다이렉트
2. "Google 계정으로 인증" 버튼 → 새 탭에서 Google 로그인
3. 콜백 페이지에 표시된 Authorization Code를 입력란에 붙여넣기
4. `exchangeCode()` → `saveAuth()` → `/dashboard`로 이동

---

### `src/app/layout.tsx` (19줄)

**역할**: HTML 루트 레이아웃

- `<html lang="ko">` 한국어 설정
- Tailwind CSS (`globals.css`) 임포트
- 메타데이터: "Android Management Console"

---

### `src/app/dashboard/page.tsx` (1370줄)

**역할**: 메인 대시보드 — 4개 탭으로 구성된 SPA

#### 레이아웃
- **좌측 사이드바**: 탭 네비게이션 + Enterprise 이름 표시 + 로그아웃
- **우측 메인 영역**: 선택된 탭의 콘텐츠
- **토스트 메시지**: 우상단 성공/에러 알림
- **로딩 바**: 상단 파란색 프로그레스 바

#### 탭 1: Enterprise 설정
- **GCP 프로젝트 선택**: 자동 조회된 프로젝트 목록에서 클릭 선택 또는 직접 입력
- **Enterprise 조회**: 선택한 프로젝트의 Enterprise 목록 조회 → 클릭 선택
- **새 Enterprise 생성**: Signup URL 생성 → 등록 완료 흐름

#### 탭 2: 기기 관리
- **검색**: IMEI, S/N, 모델명, 기기 이름 등 실시간 텍스트 검색
- **필터**: 상태별(ACTIVE/PROVISIONING 등), 정책별 드롭다운 필터
- **기기 카드**: 브랜드, 모델, Android 버전, S/N, IMEI, 정책, 등록일 표시
- **명령 버튼**: 상세 / 잠금 / 재부팅 / 비밀번호 리셋 / 삭제 (모두 confirm 다이얼로그)
- **상세 패널** (우측 슬라이드오버):
  - 상태: 업타임(마지막 부팅 기준 계산), 마지막 보고/동기화 시각
  - 하드웨어: 제조사, 모델, S/N, RAM, 저장소
  - 소프트웨어: Android 버전, API Level, 보안 패치, 커널, 부트로더
  - 네트워크: IMEI, MEID, Wi-Fi MAC, 통신사
  - 정책: 적용 정책, 버전
  - 디스플레이: 해상도, 밀도, 리프레시율
  - 보안: 보안 상태, 위험 요소
  - **CPU 사용률 추이 그래프**: 코어별 라인 + 평균 (Recharts LineChart)
  - **코어별 CPU 사용률 바 차트**: 현재 시점 (Recharts BarChart)
  - **온도 추이 그래프**: 배터리/CPU/GPU/스킨 온도 (Recharts LineChart)
  - 전원 이벤트: 최근 10개 (부팅/셧다운/배터리 등)
  - 정책 미준수 항목: 빨간색 경고 카드
  - 원본 JSON: 펼쳐서 raw 데이터 확인

#### 탭 3: 정책 관리
- **편집 모드 전환**: UI 편집 ↔ JSON 직접 편집 탭
- **UI 편집**: `PolicyVisualEditor` 컴포넌트 (아래 참조)
- **JSON 편집**: textarea에서 직접 수정
- **정책 목록**: 등록된 정책 리스트 → 편집(불러오기) / 삭제 (모두 confirm)

#### 탭 4: 기기 등록
- **정책 선택**: 등록된 정책 목록에서 클릭 선택 또는 직접 입력
- **토큰 생성**: Enrollment Token + QR 코드 생성
- **등록 가이드**: Factory Reset → 6번 탭 → QR 스캔 절차 안내

#### 헬퍼 함수/컴포넌트
- `getUptime()`: powerManagementEvents에서 마지막 BOOT_COMPLETED 찾아 업타임 계산
- `formatBytes()`: 바이트 → GB/MB 변환
- `Section`: 기기 상세의 섹션 래퍼
- `Row`: key-value 한 줄 표시

---

### `src/components/PolicyVisualEditor.tsx` (680줄)

**역할**: 정책을 UI로 편집할 수 있는 비주얼 에디터

JSON 객체를 받아서 UI로 보여주고, 변경 시 JSON 객체를 콜백으로 반환합니다.

#### 섹션별 설정 항목

| 섹션 | 설정 항목 |
|------|----------|
| **앱 관리** | 전체 기본 권한 정책, 앱별: 패키지명, 설치 유형(6종), 기본 권한 정책, 자동 업데이트 모드, 최소 버전, 알림 차단, 관리 설정(JSON), 개별 권한(permission별 허용/거부), 위임 범위(8종 체크박스), 앱 트랙(베타/테스트) |
| **보안** | 화면 캡처 차단, 카메라 차단, 디버깅 허용, 초기화 차단, 안전 부팅 차단, 암호화 정책 |
| **비밀번호** | 비밀번호 품질(8종), 최소 길이, 최소 영문/숫자/기호 수, 만료일, 재사용 금지, 최대 실패 횟수 |
| **기기 기능** | Bluetooth, USB 파일전송, Wi-Fi 설정, 설정 앱, 앱 제거, SMS, 셀 브로드캐스트, 외부 저장소, 상태표시줄, 위치 설정(4종) |
| **시스템 업데이트** | 업데이트 유형(자동/시간대/연기), 시간대 지정 시 시작/종료 시간 |
| **상태 보고** | 하드웨어/소프트웨어/메모리/네트워크/디스플레이/전원이벤트/앱 보고 토글 |
| **잠금화면** | 카메라, 알림, 생체인식, 전체 비활성화 |

#### 내부 컴포넌트
- `EditorSection`: 접을 수 있는 섹션 래퍼
- `Toggle`: on/off 토글 스위치
- `SelectField`: 드롭다운 선택
- `NumberField`: 숫자 입력

---

## 인증 흐름

```
[사용자] → Google OAuth 로그인 → [google.github.io 콜백 페이지]
         ← Authorization Code 표시 ←
[사용자] → Code 붙여넣기 → [브라우저에서 직접]
         → POST oauth2.googleapis.com/token → Access Token 수신
         → localStorage에 저장
         → 이후 모든 API 호출에 Bearer Token 사용
         → 토큰 만료 시 Refresh Token으로 자동 갱신
```

---

## 빌드 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 정적 빌드 (out/ 폴더에 생성)
npm run build

# 정적 파일 서빙 (file:// 프로토콜 불가, HTTP 서버 필요)
npx serve out
```

**주의**: `file://`로 직접 열 수 없습니다. Google OAuth 토큰 교환 시 CORS 정책 때문에 HTTP 서버(`npx serve`, nginx 등)로 서빙해야 합니다.

---

## 사용하는 Google API

| API | 엔드포인트 베이스 | 용도 |
|-----|-------------------|------|
| Android Management API v1 | `androidmanagement.googleapis.com/v1` | Enterprise, 기기, 정책, 등록 토큰 관리 |
| Cloud Resource Manager API v1 | `cloudresourcemanager.googleapis.com/v1` | GCP 프로젝트 목록 조회 |
| Google OAuth2 | `oauth2.googleapis.com/token` | 토큰 교환 및 갱신 |

---

## 주요 데이터 저장소

모든 데이터는 **localStorage**에 저장됩니다 (서버/DB 없음):

| 키 | 내용 |
|----|------|
| `amm_auth` | OAuth 토큰 (access_token, refresh_token, expires_at) |
| `amm_enterprise` | 선택된 Enterprise 이름 |
| `amm_project_id` | 선택된 GCP 프로젝트 ID |
