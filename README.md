# notion-api-test

## このプロジェクトの役割
notion-apiのテスト用途

## 実行手順

1. 依存関係のインストール
```bash
npm install
```

2. 環境変数の設定
`.env`ファイルをプロジェクトルートに作成し、Notion APIキー等を設定してください。
```
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your notion database_id_here
```

3. スクリプトの実行
```bash
npx tsx scripts/your-script.ts
```
