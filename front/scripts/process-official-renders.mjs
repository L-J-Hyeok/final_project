#!/usr/bin/env node
/**
 * User-supplied official render ingestion & optimization script.
 *
 * - Reads unmodified originals from `front/assets-source/official-renders/originals/`
 *   Supported filename / directory patterns:
 *     1) `originals/<모델번호>__<색상>.<png|jpg|jpeg|webp>` (e.g. `SM-S928N__티타늄-그레이.png`)
 *     2) `originals/<모델번호>/<색상>.<png|jpg|jpeg|webp>` (e.g. `A3296/데저트-티타늄.png`)
 * - Preserves originals untouched.
 * - Writes processed WebP/PNG outputs to `front/public/images/official/optimized/`.
 * - Updates `front/src/data/user-official-renders.json` only with validated existing files
 *   (prevents 404s) and generates `front/assets-source/official-renders/processing-report.json`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONT_DIR = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONT_DIR, '..')

const ORIGINALS_DIR = path.join(FRONT_DIR, 'assets-source/official-renders/originals')
const MANUAL_REVIEW_DIR = path.join(FRONT_DIR, 'assets-source/official-renders/manual-review')
const METADATA_PATH = path.join(FRONT_DIR, 'assets-source/official-renders/metadata.json')
const REPORT_PATH = path.join(FRONT_DIR, 'assets-source/official-renders/processing-report.json')
const OPTIMIZED_DIR = path.join(FRONT_DIR, 'public/images/official/optimized')
const REGISTRY_PATH = path.join(FRONT_DIR, 'src/data/user-official-renders.json')
const DB_SMARTPHONES_PATH = path.join(REPO_ROOT, 'backend/data/normalized-smartphones.json')
const PY_PROCESSOR = path.join(FRONT_DIR, 'scripts/remove_bg.py')

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function normalizeColorKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase()
}

function slugifySafe(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset'
}

function loadCanonicalCatalog() {
  const modelMap = new Map()
  if (!fs.existsSync(DB_SMARTPHONES_PATH)) return modelMap
  const db = JSON.parse(fs.readFileSync(DB_SMARTPHONES_PATH, 'utf8'))
  const byKey = new Map()
  for (const m of db.smartphones || []) {
    byKey.set(m.smartphone_key, {
      category: 'smartphone',
      brand: String(m.brand || '').toLowerCase(),
      modelName: m.model_name,
      domesticModelNumber: normalizeCode(m.domestic_model_number),
      colors: new Set()
    })
  }
  for (const v of db.smartphone_variants || []) {
    const entry = byKey.get(v.smartphone_key)
    if (entry && v.color) entry.colors.add(v.color)
  }
  for (const entry of byKey.values()) {
    if (entry.domesticModelNumber) {
      modelMap.set(entry.domesticModelNumber, entry)
    }
  }
  return modelMap
}

function discoverOriginalFiles() {
  if (!fs.existsSync(ORIGINALS_DIR)) return []
  const items = []
  const entries = fs.readdirSync(ORIGINALS_DIR, { withFileTypes: true })
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue
    if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase()
      if (!ALLOWED_EXTS.has(ext)) {
        items.push({
          validName: false,
          filePath: path.join(ORIGINALS_DIR, ent.name),
          relPath: ent.name,
          reason: `지원하지 않는 파일 형식입니다 (${ext || '확장자 없음'}). (.png, .jpg, .jpeg, .webp 만 지원)`
        })
        continue
      }
      const base = ent.name.slice(0, -ext.length)
      const sep = base.indexOf('__')
      if (sep <= 0) {
        items.push({
          validName: false,
          filePath: path.join(ORIGINALS_DIR, ent.name),
          relPath: ent.name,
          reason: '파일명 형식 오류: <모델번호>__<색상>.<확장자> 형식이어야 합니다.'
        })
        continue
      }
      const modelCode = normalizeCode(base.slice(0, sep))
      let rawColor = base.slice(sep + 2).replace(/-/g, ' ').trim()
      // Safely strip optional trailing direction marker (__front / __back) if present
      rawColor = rawColor.replace(/__(?:front|back|정면|후면)$/i, '').trim()
      items.push({
        validName: true,
        modelCode,
        rawColor,
        filePath: path.join(ORIGINALS_DIR, ent.name),
        relPath: ent.name
      })
    } else if (ent.isDirectory()) {
      const modelCode = normalizeCode(ent.name)
      const subDir = path.join(ORIGINALS_DIR, ent.name)
      for (const sub of fs.readdirSync(subDir, { withFileTypes: true })) {
        if (!sub.isFile() || sub.name.startsWith('.')) continue
        const ext = path.extname(sub.name).toLowerCase()
        if (!ALLOWED_EXTS.has(ext)) continue
        let rawColor = sub.name.slice(0, -ext.length).replace(/-/g, ' ').trim()
        rawColor = rawColor.replace(/__(?:front|back|정면|후면)$/i, '').trim()
        items.push({
          validName: true,
          modelCode,
          rawColor,
          filePath: path.join(subDir, sub.name),
          relPath: path.join(ent.name, sub.name)
        })
      }
    }
  }
  return items
}

function matchCanonicalColor(canonicalEntry, rawColor) {
  const norm = normalizeColorKey(rawColor)
  if (!canonicalEntry) return null
  for (const dbColor of canonicalEntry.colors) {
    if (normalizeColorKey(dbColor) === norm) return dbColor
  }
  return null
}

function main() {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true })
  fs.mkdirSync(MANUAL_REVIEW_DIR, { recursive: true })
  fs.mkdirSync(OPTIMIZED_DIR, { recursive: true })

  const metadata = fs.existsSync(METADATA_PATH)
    ? JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'))
    : {}
  const canonicalCatalog = loadCanonicalCatalog()
  const discovered = discoverOriginalFiles()

  const registryEntries = {}
  const manualReview = []
  const reportItems = []

  // Remove stale generated artifacts only inside OPTIMIZED_DIR (never touch ORIGINALS_DIR!)
  const producedAbsPaths = new Set()

  const validCandidates = []

  for (const item of discovered) {
    if (!item.validName) {
      manualReview.push({
        relPath: item.relPath,
        reason: item.reason
      })
      continue
    }

    const dbMeta = canonicalCatalog.get(item.modelCode)
    const userMeta = metadata[item.relPath] || metadata[`${item.modelCode}__${item.rawColor}`] || {}

    // Model validation against DB
    if (!dbMeta && !userMeta.category && !userMeta.modelName) {
      manualReview.push({
        relPath: item.relPath,
        modelCode: item.modelCode,
        rawColor: item.rawColor,
        reason: `DB 미등록 모델: '${item.modelCode}'는 데이터베이스에 등록된 국내 모델번호가 아닙니다. (수동 검토 대상)`
      })
      continue
    }

    // Color validation against DB
    let canonicalColor = userMeta.color
    if (!canonicalColor && dbMeta) {
      canonicalColor = matchCanonicalColor(dbMeta, item.rawColor)
    }

    if (!canonicalColor) {
      manualReview.push({
        relPath: item.relPath,
        modelCode: item.modelCode,
        rawColor: item.rawColor,
        reason: `DB 미등록 색상: '${item.rawColor}' 색상은 해당 모델의 DB 등록 색상(${dbMeta ? Array.from(dbMeta.colors).join(', ') : '없음'})과 일치하지 않습니다.`
      })
      continue
    }

    let mtime = 0
    try {
      mtime = fs.statSync(item.filePath).mtimeMs
    } catch {
      mtime = 0
    }

    validCandidates.push({
      ...item,
      canonicalColor,
      dbMeta,
      userMeta,
      mtime
    })
  }

  // Deduplicate: If multiple candidate files exist for the same modelCode + canonicalColor,
  // choose the newest file as the representative image, and isolate the older duplicates into manualReview.
  const grouped = new Map()
  for (const item of validCandidates) {
    const key = `${item.modelCode}::${item.canonicalColor}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key).push(item)
  }

  const itemsToProcess = []
  for (const list of grouped.values()) {
    if (list.length === 1) {
      itemsToProcess.push(list[0])
    } else {
      list.sort((a, b) => b.mtime - a.mtime)
      const selected = list[0]
      itemsToProcess.push(selected)
      for (let i = 1; i < list.length; i++) {
        manualReview.push({
          relPath: list[i].relPath,
          modelCode: list[i].modelCode,
          color: list[i].canonicalColor,
          reason: `동일 모델·색상에 대한 중복 파일 감지: 최신 파일(${selected.relPath})을 대표 이미지로 처리하고 해당 파일은 안전하게 격리 보존했습니다.`
        })
      }
    }
  }

  for (const item of itemsToProcess) {
    const { dbMeta, userMeta, canonicalColor } = item
    const brand = (userMeta.brand || dbMeta?.brand || '').toLowerCase()
    const modelName = userMeta.modelName || dbMeta?.modelName || item.modelCode
    const category = (userMeta.category || dbMeta?.category || 'smartphone').toLowerCase()

    const safeModelSlug = slugifySafe(item.modelCode)
    const safeColorSlug = slugifySafe(canonicalColor)
    const outBase = path.join(OPTIMIZED_DIR, safeModelSlug, `${safeModelSlug}__${safeColorSlug}`)

    const pyArgs = [PY_PROCESSOR, '--input', item.filePath, '--output-base', outBase]
    if (userMeta.allowBgRemoval === false) pyArgs.push('--no-bg-removal')

    let proc
    try {
      const stdout = execFileSync('python3', pyArgs, { encoding: 'utf8' }).trim()
      proc = JSON.parse(stdout)
    } catch (err) {
      manualReview.push({
        relPath: item.relPath,
        modelCode: item.modelCode,
        color: canonicalColor,
        reason: `이미지 처리 스크립트 실행 실패: ${err.message}`
      })
      continue
    }

    if (!fs.existsSync(proc.outputPath)) {
      manualReview.push({
        relPath: item.relPath,
        modelCode: item.modelCode,
        color: canonicalColor,
        reason: '생성된 출력 파일이 디스크에서 확인되지 않았습니다.'
      })
      continue
    }

    producedAbsPaths.add(path.resolve(proc.outputPath))
    const publicRel = '/' + path.relative(path.join(FRONT_DIR, 'public'), proc.outputPath).replace(/\\/g, '/')

    if (!registryEntries[item.modelCode]) {
      registryEntries[item.modelCode] = {
        category,
        brand: brand || undefined,
        domesticModelNumbers: [item.modelCode],
        modelNames: modelName ? [modelName.toLowerCase()] : [],
        colors: {}
      }
    }

    registryEntries[item.modelCode].colors[canonicalColor] = {
      url: publicRel,
      aliases: [item.rawColor, normalizeColorKey(canonicalColor)].filter(
        (v, idx, arr) => v && v !== canonicalColor && arr.indexOf(v) === idx
      ),
      orientation: proc.orientation,
      transparent: proc.transparent,
      format: proc.format,
      width: proc.width,
      height: proc.height,
      sourceName: userMeta.sourceName || '사용자 제공 제조사 공식 렌더',
      sourceUrl: userMeta.sourceUrl || null,
      licenseNote: userMeta.licenseNote || '사용자 직접 제공 공식 자산 (원본 별도 보존)',
      bgRemovalStatus: proc.status
    }

    if (proc.needsManualReview) {
      manualReview.push({
        relPath: item.relPath,
        modelCode: item.modelCode,
        color: canonicalColor,
        outputUrl: publicRel,
        status: proc.status,
        reason: proc.reason
      })
    }

    reportItems.push({
      original: item.relPath,
      modelCode: item.modelCode,
      color: canonicalColor,
      outputUrl: publicRel,
      ...proc
    })
  }

  // Prune stale generated files in OPTIMIZED_DIR that no longer match an original
  function pruneDir(dir) {
    if (!fs.existsSync(dir)) return
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        pruneDir(full)
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full)
      } else if (ent.isFile() && !ent.name.startsWith('.') && !producedAbsPaths.has(path.resolve(full))) {
        fs.unlinkSync(full)
      }
    }
  }
  pruneDir(OPTIMIZED_DIR)

  const generatedAt = new Date().toISOString()
  const registryPayload = {
    schemaVersion: '1.0.0',
    generatedAt,
    entries: registryEntries,
    manualReview
  }
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registryPayload, null, 2) + '\n')

  const reportPayload = {
    generatedAt,
    originalsCount: discovered.length,
    registeredModelsCount: Object.keys(registryEntries).length,
    manualReviewCount: manualReview.length,
    items: reportItems,
    manualReview
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(reportPayload, null, 2) + '\n')

  console.log(
    `[process-official-renders] Originals: ${discovered.length}, Models registered: ${Object.keys(registryEntries).length}, Manual review: ${manualReview.length}`
  )
}

main()
