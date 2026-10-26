import { readFileSync } from "node:fs"
import path from "node:path"

function parseArgs(argv) {
  const args = {}

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]

    if (!key.startsWith("--")) continue

    if (!value || value.startsWith("--")) {
      args[key.slice(2)] = "true"
      continue
    }

    args[key.slice(2)] = value
    i += 1
  }

  return args
}

function parseReport(filePath) {
  const text = readFileSync(filePath, "utf8")
  const lines = text.split(/\r?\n/)
  const result = {}

  for (const line of lines) {
    const separatorIndex = line.indexOf(":")
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    result[key] = value
  }

  return {
    path: filePath,
    label: result.label || path.basename(filePath),
    warmBuildMs: Number(result.warm_build_ms || 0),
    totalJsBytes: Number(result.total_js_bytes || 0),
    chunkCount: Number(result.chunk_count || 0)
  }
}

function pctDelta(next, base) {
  if (!base) return 0
  return ((next - base) / base) * 100
}

const args = parseArgs(process.argv)
const baselinePath = path.resolve(args.baseline || "reports/rolldown/baseline.txt")
const candidatePath = path.resolve(args.candidate || "reports/rolldown/post.txt")
const buildThreshold = Number(args.buildThresholdPct || 5)
const bundleThreshold = Number(args.bundleThresholdPct || 3)

const baseline = parseReport(baselinePath)
const candidate = parseReport(candidatePath)

const buildDelta = pctDelta(candidate.warmBuildMs, baseline.warmBuildMs)
const bundleDelta = pctDelta(candidate.totalJsBytes, baseline.totalJsBytes)

const summary = [
  `baseline: ${baseline.label} (${baseline.path})`,
  `candidate: ${candidate.label} (${candidate.path})`,
  `warm_build_ms: ${baseline.warmBuildMs} -> ${candidate.warmBuildMs} (${buildDelta.toFixed(2)}%)`,
  `total_js_bytes: ${baseline.totalJsBytes} -> ${candidate.totalJsBytes} (${bundleDelta.toFixed(2)}%)`,
  `chunk_count: ${baseline.chunkCount} -> ${candidate.chunkCount}`,
  `thresholds: build<=${buildThreshold}% bundle<=${bundleThreshold}%`
]

console.log(summary.join("\n"))

const violations = []
if (buildDelta > buildThreshold) {
  violations.push(
    `Build regression over threshold: ${buildDelta.toFixed(2)}% > ${buildThreshold}%`
  )
}

if (bundleDelta > bundleThreshold) {
  violations.push(
    `Bundle regression over threshold: ${bundleDelta.toFixed(2)}% > ${bundleThreshold}%`
  )
}

if (violations.length > 0) {
  console.error(`\n[rolldown-compare] FAILED\n${violations.join("\n")}`)
  process.exit(1)
}

console.log("\n[rolldown-compare] PASSED")
