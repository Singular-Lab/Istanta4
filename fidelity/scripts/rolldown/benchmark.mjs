import { spawn, spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
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

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    cwd: process.cwd()
  })

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`)
  }
}

function measureBuild(env) {
  const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js")
  const start = performance.now()
  run(process.execPath, [viteBin, "build", "--mode", "production"], env)
  const end = performance.now()

  return Math.round(end - start)
}

function collectChunkStats() {
  const jsDir = path.resolve("dist", "client", "assets", "js")
  let files = []

  try {
    files = readdirSync(jsDir).filter((name) => name.endsWith(".js"))
  } catch {
    return {
      chunkCount: 0,
      totalJsBytes: 0,
      topChunks: []
    }
  }

  const chunks = files.map((file) => {
    const absolutePath = path.join(jsDir, file)
    const size = statSync(absolutePath).size

    return { file, size }
  })

  chunks.sort((a, b) => b.size - a.size)

  return {
    chunkCount: chunks.length,
    totalJsBytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
    topChunks: chunks.slice(0, 20)
  }
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "")
}

function measureDevReadyMs(env, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js")
    const port = env.VITE_BENCH_PORT || "41731"

    const child = spawn(
      process.execPath,
      [viteBin, "--host", "127.0.0.1", "--strictPort", "--port", port],
      {
        cwd: process.cwd(),
        env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    )

    let done = false
    let logBuffer = ""

    const finish = (err, value) => {
      if (done) return
      done = true

      if (!child.killed) {
        child.kill("SIGTERM")
      }

      if (err) {
        reject(err)
      } else {
        resolve(value)
      }
    }

    const onData = (chunk) => {
      const text = stripAnsi(chunk.toString())
      logBuffer += text

      const readyMatch = logBuffer.match(/ready in\s+([0-9.]+)\s*ms/i)
      if (readyMatch) {
        finish(null, Math.round(Number(readyMatch[1])))
      }
    }

    child.stdout.on("data", onData)
    child.stderr.on("data", onData)

    child.on("exit", (code) => {
      if (done) return
      if (code === 0) {
        finish(null, null)
      } else {
        finish(
          new Error(
            `Unable to measure dev startup. Vite exited with code ${code}. Logs:\n${logBuffer}`
          )
        )
      }
    })

    setTimeout(() => {
      finish(
        new Error(
          `Timeout waiting for Vite dev startup (${timeoutMs}ms). Partial logs:\n${logBuffer}`
        )
      )
    }, timeoutMs)
  })
}

function formatReport(metrics) {
  const top = metrics.topChunks.length
    ? metrics.topChunks.map((item) => `  - ${item.size} ${item.file}`).join("\n")
    : "  - none"

  return [
    `label: ${metrics.label}`,
    `timestamp: ${new Date().toISOString()}`,
    `lazy_barrel: ${metrics.lazyBarrel}`,
    `cold_build_ms: ${metrics.coldBuildMs}`,
    `warm_build_ms: ${metrics.warmBuildMs}`,
    `chunk_count: ${metrics.chunkCount}`,
    `total_js_bytes: ${metrics.totalJsBytes}`,
    `dev_ready_ms: ${metrics.devReadyMs ?? "n/a"}`,
    "top_20_chunks:",
    top
  ].join("\n")
}

const args = parseArgs(process.argv)
const label = args.label || "benchmark"
const lazyBarrel = args.lazybarrel === "true"

mkdirSync(path.resolve("reports", "rolldown"), { recursive: true })

const env = {
  ...process.env,
  VITE_EXPERIMENTAL_LAZY_BARREL: lazyBarrel ? "true" : "false"
}

run(process.execPath, [path.resolve("scripts", "checkRolldownBinding.mjs")], env)

rmSync(path.resolve("dist", "client"), { recursive: true, force: true })
const coldBuildMs = measureBuild(env)
const warmBuildMs = measureBuild(env)

const { chunkCount, totalJsBytes, topChunks } = collectChunkStats()

let devReadyMs = null
try {
  devReadyMs = await measureDevReadyMs(env)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[rolldown-benchmark] ${message}`)
}

const metrics = {
  label,
  lazyBarrel,
  coldBuildMs,
  warmBuildMs,
  chunkCount,
  totalJsBytes,
  topChunks,
  devReadyMs
}

const report = formatReport(metrics)
const safeLabel = label.replace(/[^a-zA-Z0-9._-]/g, "_")
const outputPath = path.resolve("reports", "rolldown", `${safeLabel}.txt`)

writeFileSync(outputPath, report)
console.log(`\n[rolldown-benchmark] Report written to ${outputPath}`)
console.log(readFileSync(outputPath, "utf8"))
