# Android Enterprise Management API 웹 콘솔

브라우저에서 바로 Android 기기를 관리할 수 있는 정적 웹 애플리케이션입니다.
서버 없이 Google Android Management API를 호출하여 기기 관리, 정책 설정, 디바이스 등록을 수행합니다.

## 바로 사용하기

**https://agvber.github.io/android-enterprise-managment-api/**

별도 설치 없이 위 링크에서 바로 사용할 수 있습니다.

## 주요 기능

- **Google OAuth 로그인** — 브라우저에서 직접 인증, 토큰 자동 갱신
- **엔터프라이즈 관리** — GCP 프로젝트 선택, 엔터프라이즈 생성 및 등록
- **디바이스 관리** — 검색/필터, 상세 정보 조회, 원격 잠금/재부팅/초기화
- **하드웨어 모니터링** — CPU 사용률, 온도 추이 차트, 전원 이벤트 이력
- **정책 비주얼 에디터** — 앱 관리, 보안, 비밀번호, 시스템 업데이트 등 정책을 UI로 편집
- **디바이스 등록** — 등록 토큰 생성, QR 코드 발급

## 사전 준비

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Android Management API 활성화
3. OAuth 2.0 클라이언트 설정 (또는 앱 내 기본 제공 클라이언트 사용)

## 로컬 개발

```bash
npm install
npm run dev
```

## 문서

- [사용 가이드](USAGE.md) — 설정부터 기기 등록까지 단계별 안내
- [개발 문서](DOCS.md) — API 레퍼런스, 파일 구조, 인증 흐름

## 기술 스택

Next.js 16 | TypeScript | Tailwind CSS 4 | Recharts
