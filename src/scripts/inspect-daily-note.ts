import 'dotenv/config'
import { Client, isFullDataSource, isFullPageOrDataSource, isFullBlock } from '@notionhq/client'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const token = process.env.NOTION_TOKEN!
const databaseId = process.env.NOTION_DAILY_NOTE_DB_ID!

const notion = new Client({ auth: token })

async function fetchBlocks(blockId: string, depth = 0): Promise<string[]> {
  const indent = '  '.repeat(depth)
  const response = await notion.blocks.children.list({ block_id: blockId })
  const ignoreTypes = ['code', 'image', 'video', 'file', 'audio']
  const lines: string[] = []

  for (const block of response.results) {
    if (!isFullBlock(block) || ignoreTypes.includes(block.type)) continue

    const typeData = (block as Record<string, unknown>)[block.type]
    const richText = (typeData as { rich_text?: Array<{ plain_text: string }> })?.rich_text
    const text = richText?.map((t) => t.plain_text).join('') ?? ''

    lines.push(`${indent}[${block.type}] ${text}`)

    if (block.has_children) {
      const childLines = await fetchBlocks(block.id, depth + 1)
      lines.push(...childLines)
    }
  }

  return lines
}

function extractDateLabel(properties: Record<string, unknown>): string {
  const dateProp = (properties['日付'] as { date?: { start?: string } } | undefined)?.date
  return dateProp?.start ?? '不明な日付'
}

function saveToFile(filename: string, content: string): void {
  const dir = join(process.cwd(), 'testdata')
  mkdirSync(dir, { recursive: true })
  const filepath = join(dir, filename)
  writeFileSync(filepath, content, 'utf-8')
  console.log(`保存しました: ${filepath}`)
}

async function inspectDailyNotes(): Promise<void> {
  const db = await notion.databases.retrieve({ database_id: databaseId })
  const dataSources = (db as unknown as { data_sources: Array<{ id: string; name: string }> }).data_sources

  for (const dsRef of dataSources) {
    console.log('id: ', dsRef.id)
    const dataSource = await notion.dataSources.retrieve({ data_source_id: dsRef.id })
    if (!isFullDataSource(dataSource)) continue

    const records = await notion.dataSources.query({
      data_source_id: dsRef.id,
      sorts: [{ property: '日付', direction: 'ascending' }],
    })

    const allLines: string[] = ['# デイリーノート - 今日やったこと', '']

    for (const page of records.results) {
      if (!isFullPageOrDataSource(page)) continue

      const dateLabel = extractDateLabel(page.properties as Record<string, unknown>)
      console.log(`取得中: ${dateLabel}`)

      allLines.push(`${'='.repeat(10)}`)
      allLines.push(`📅 ${dateLabel}`)
      allLines.push('')

      const blockLines = await fetchBlocks(page.id)
      allLines.push(...blockLines)
      allLines.push('')
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    saveToFile(`daily-notes-${timestamp}.txt`, allLines.join('\n'))
  }
}

inspectDailyNotes().catch(console.error)
