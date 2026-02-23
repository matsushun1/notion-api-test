import "dotenv/config"
import { Client, isFullBlock, isFullDatabase, isFullDataSource, isFullPageOrDataSource } from "@notionhq/client"
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const notion = new Client({ auth: process.env.NOTION_TOKEN! })

const DATABASE_ID = process.env.NOTION_DATABASE_ID!

const lines: string[] = []

function log(msg: string):void {
  console.log(msg)
  lines.push(msg)
}

function saveToFile(): void {
  const dir = join(process.cwd(), 'testdata')
  mkdirSync(dir, { recursive: true })

  const fileName = `notion-inspect-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`
  const filePath = join(dir, fileName)

  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  console.log(`\nファイルに保存しました: ${filePath}`)
}

async function inspectDatabase() {
  // DBのプロパティスキーマを取得
  const db = await notion.databases.retrieve({ database_id: DATABASE_ID })

  if (!isFullDatabase(db)) {
    throw new Error('データベースの完全な情報を取得できませんでした')
  }

  log('=== DB名 ===')
  log(db.title[0]?.plain_text ?? '')

  log('=== Data Sources ===')
  const dataSources = db.data_sources

  for (const dsRef of dataSources) {
    log(`\n--- Data Source: ${dsRef.name} (${dsRef.id}) ---`)

    // 各data sourceのプロパティ定義を取得
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: dsRef.id
    })

    if (!isFullDataSource(dataSource)) continue

    log('\n=== プロパティ一覧 ===')
    log(JSON.stringify(dataSource.properties, null, 2))

    log('\n=== レコードサンプル（最大3件）===')
    const records = await notion.dataSources.query({
      data_source_id: dsRef.id,
      page_size: 3,
      filter: { property: 'Status', select: { equals: 'Doing' }},
      sorts: [{property: 'Date Created', direction: 'descending'}]
    })

    for (const page of records.results) {
      if (!isFullPageOrDataSource(page)) continue
      log(`\n--- Page ID: ${page.id} ---`)
      log(JSON.stringify(page.properties, null, 2))

      log('--- ブロック（本文）---')
      await fetchBlocks(page.id)
    }
  }

  saveToFile()
}

async function fetchBlocks(blockId: string, depth = 0): Promise<void> {
  const indent = "  ".repeat(depth)
  const response = await notion.blocks.children.list({ block_id: blockId })
  const ignoreTypes = ['code', 'image', 'video', 'file', 'audio']

  for (const block of response.results) {
    if (!isFullBlock(block) || ignoreTypes.includes(block.type)) continue

    // ブロックの種類ごとにテキスト抽出
    const type = (block as Record<string, unknown>)[block.type]
    const richText = (type as { rich_text?: Array<{ plain_text: string }> })?.rich_text
    const text = richText?.map((t) => t.plain_text).join('') ?? ''
    log(`${indent}[${block.type}] ${text}`)

    // 子ブロックがある場合は再帰的に取得
    if (block.has_children) {
      await fetchBlocks(block.id, depth + 1)
    }
  }
}

inspectDatabase().catch(console.error)
