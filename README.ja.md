# Muses Canvas

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  日本語 |
  <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="./public/logo.svg" alt="Muses Canvas logo" width="160" />
</p>

<p align="center">
  <strong>A standalone AI creation workspace for generating images and videos on an infinite canvas.</strong>
</p>

<p align="center">
  <video src="./public/demo.mp4" controls width="960"></video>
</p>

## 概要

Muses Canvas は、無限キャンバスを中心に設計されたスタンドアロンの AI クリエイションワークスペースです。テキスト、画像、動画生成を 1 つの視覚空間にまとめることで、プロンプト、参照素材、出力結果、反復作業を同じ制作フローの中で扱えます。

このプロジェクトはローカルファーストかつ自己完結型を重視しています。コアとなるキャンバス体験にログインは不要で、ホスト型バックエンドにも依存せず、プロジェクトデータとメディアファイルをローカルディスクへ保存します。

## 特長

- AI による画像・動画制作のための無限キャンバスワークフロー
- テキスト、画像、動画ノードを 1 つのワークスペースで接続可能
- ローカルファーストで、コア体験にログイン不要
- 参照画像、プロンプトの流れ、生成結果を同じグラフ内で管理可能
- オープンソース向けに理解しやすく、拡張しやすい構成

## クイックスタート

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いてください。

## ビルド

```bash
npm run build
npm start
```

## 検証

```bash
npm run lint
npx tsc --noEmit
```

## ローカル保存

- キャンバスのグラフデータ: `data/projects/*.json`
- インポート済み / 生成済みメディア: `data/media/*`
- アセットライブラリのインデックス: `data/library.json`

## プロジェクト構成

- `app/`: Next.js App Router のページと API ルート
- `components/canvas/`: キャンバス固有の UI
- `components/canvas/workspace/`: Flow キャンバス、ノード描画、ツールバー、ワークスペース UI
- `lib/canvas/`: 共有キャンバス API とワークスペースのドメインロジック
- `lib/provider/`: プロバイダー設定とブラウザ向けヘルパー
- `lib/server/`: ローカル永続化、プロバイダー実行、メディア保存
- `store/`: 軽量な Zustand ストア

## 実行フロー

1. ページ層がワークスペースを描画し、更新処理を共有クライアント API に委譲します。
2. API ルートは薄く保たれ、実処理は共有サーバーモジュールへ渡されます。
3. サーバー側サービスは `data/` 配下のローカル JSON とメディアを読み書きします。
4. プロバイダーからの応答は正規化された後、UI 上のグラフに反映されます。

## 補足

- このリポジトリは、スタンドアロンで使えるキャンバス体験に焦点を当てています。
- プロジェクトデータとメディアは、ホスト型バックエンドではなくローカルに保存されます。
- 構成を責務ごとに整理しているため、今後のカスタマイズや拡張がしやすくなっています。
