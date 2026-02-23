import "dotenv/config";
import { Client, isFullDatabase, isFullDataSource, isFullPageOrDataSource } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN! })

const DATABASE_ID = process.env.NOTION_DATABASE_ID!

async function inspectDatabase() {
  // DBのプロパティスキーマを取得
  const db = await notion.databases.retrieve({ database_id: DATABASE_ID })

  if (!isFullDatabase(db)) {
    throw new Error('データベースの完全な情報を取得できませんでした')
  }

  console.log('=== DB名 ===')
  console.log(db.title[0]?.plain_text ?? '')

  console.log('=== Data Sources ===')
  const dataSources = db.data_sources

  for (const dsRef of dataSources) {
    console.log(`\n--- Data Source: ${dsRef.name} (${dsRef.id}) ---`)

    // 各data sourceのプロパティ定義を取得
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: dsRef.id
    })

    if (!isFullDataSource(dataSource)) continue

    console.log('\n=== プロパティ一覧 ===')
    console.log(JSON.stringify(dataSource.properties, null, 2))

    console.log("\n=== レコードサンプル（最大3件）===")
    const records = await notion.dataSources.query({ data_source_id: dsRef.id, page_size: 3 });

    for (const page of records.results) {
      if (!isFullPageOrDataSource(page)) continue
      console.log(`\n--- Page ID: ${page.id} ---`)
      console.log(JSON.stringify(page.properties, null, 2))
    }
  }
}

inspectDatabase().catch(console.error)
