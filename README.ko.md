# Muses Canvas

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  <a href="./README.ja.md">日本語</a> |
  한국어
</p>

<p align="center">
  <img src="./public/logo.svg" alt="Muses Canvas logo" width="160" />
</p>

<p align="center">
  <strong>A standalone AI creation workspace for generating images and videos on an infinite canvas.</strong>
</p>

<p align="center">
  <a href="./public/demo.mp4">
    <img src="./public/demo-preview.svg" alt="Muses Canvas 데모 영상 보기" width="960" />
  </a>
</p>

## 소개

Muses Canvas는 무한 캔버스를 중심으로 설계된 독립형 AI 크리에이티브 워크스페이스입니다. 텍스트, 이미지, 비디오 생성을 하나의 시각적 공간에 통합해 프롬프트, 레퍼런스, 결과물, 반복 작업을 같은 제작 흐름 안에서 이어갈 수 있습니다.

이 프로젝트는 로컬 우선과 독립 실행을 중요하게 생각합니다. 핵심 캔버스 경험에 로그인도 필요 없고, 호스팅 백엔드에도 의존하지 않으며, 프로젝트 데이터와 미디어 파일은 로컬 디스크에 저장됩니다.

## 주요 특징

- AI 이미지 및 비디오 제작을 위한 무한 캔버스 워크플로
- 텍스트, 이미지, 비디오 노드를 하나의 워크스페이스에서 연결 가능
- 로컬 우선 구조로 핵심 기능에 로그인 불필요
- 레퍼런스 이미지, 프롬프트 흐름, 생성 결과를 하나의 그래프 안에서 관리
- 오픈소스 협업과 확장에 적합한 구조

## 빠른 시작

```bash
npm install
npm run dev
```

`http://localhost:3000` 을 열면 됩니다.

## 빌드

```bash
npm run build
npm start
```

## 검증

```bash
npm run lint
npx tsc --noEmit
```

## 로컬 저장소

- 캔버스 그래프 데이터: `data/projects/*.json`
- 가져오거나 생성한 미디어: `data/media/*`
- 에셋 라이브러리 인덱스: `data/library.json`

## 프로젝트 구조

- `app/`: Next.js App Router 페이지와 API 라우트
- `components/canvas/`: 캔버스 전용 UI
- `components/canvas/workspace/`: Flow 표면, 노드 렌더링, 툴바, 워크스페이스 UI
- `lib/canvas/`: 공용 캔버스 API 및 워크스페이스 도메인 로직
- `lib/provider/`: 모델 제공자 설정과 브라우저 측 헬퍼
- `lib/server/`: 로컬 저장, 모델 실행, 미디어 저장
- `store/`: 가벼운 Zustand 스토어

## 실행 흐름

1. 페이지 레이어가 워크스페이스를 렌더링하고 변경 작업을 공용 클라이언트 API에 위임합니다.
2. API 라우트는 얇게 유지되고 실제 작업은 공용 서버 모듈로 전달됩니다.
3. 서버 서비스는 `data/` 아래의 로컬 JSON과 미디어 파일을 읽고 씁니다.
4. 모델 응답은 정규화된 뒤 UI의 그래프 상태에 반영됩니다.

## 참고

- 이 저장소는 독립적으로 실행 가능한 캔버스 경험에 초점을 맞추고 있습니다.
- 프로젝트 데이터와 미디어는 호스팅 백엔드 대신 로컬에 저장됩니다.
- 구조가 역할별로 나뉘어 있어 이후 커스터마이징과 확장이 더 쉽습니다.
