import { createRequire } from "node:module"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

const require = createRequire(import.meta.url)
const adviceOnly = process.argv.includes("--advice")

function isMusl() {
  if (process.platform !== "linux") return false
  try {
    const report = process.report?.getReport?.()
    return !report?.header?.glibcVersionRuntime
  } catch {
    return false
  }
}

function getExpectedBindingPackage() {
  const platform = process.platform
  const arch = process.arch

  if (platform === "win32") {
    if (arch === "x64") return "@rolldown/binding-win32-x64-msvc"
    if (arch === "arm64") return "@rolldown/binding-win32-arm64-msvc"
    return null
  }

  if (platform === "darwin") {
    if (arch === "x64") return "@rolldown/binding-darwin-x64"
    if (arch === "arm64") return "@rolldown/binding-darwin-arm64"
    return null
  }

  if (platform === "linux") {
    const musl = isMusl()

    if (arch === "x64") {
      return musl
        ? "@rolldown/binding-linux-x64-musl"
        : "@rolldown/binding-linux-x64-gnu"
    }

    if (arch === "arm64") {
      return musl
        ? "@rolldown/binding-linux-arm64-musl"
        : "@rolldown/binding-linux-arm64-gnu"
    }

    if (arch === "arm") {
      return musl
        ? "@rolldown/binding-linux-arm-musleabihf"
        : "@rolldown/binding-linux-arm-gnueabihf"
    }

    if (arch === "riscv64") {
      return musl
        ? "@rolldown/binding-linux-riscv64-musl"
        : "@rolldown/binding-linux-riscv64-gnu"
    }

    return null
  }

  if (platform === "freebsd") {
    if (arch === "x64") return "@rolldown/binding-freebsd-x64"
    if (arch === "arm64") return "@rolldown/binding-freebsd-arm64"
    return null
  }

  return null
}

function findInstalledBindings() {
  const bindingsDir = path.resolve("node_modules", "@rolldown")
  if (!existsSync(bindingsDir)) return []

  return readdirSync(bindingsDir)
    .filter((name) => name.startsWith("binding-"))
    .map((name) => `@rolldown/${name}`)
}

const expectedBinding = getExpectedBindingPackage()
const installedBindings = findInstalledBindings()

if (!expectedBinding) {
  console.warn(
    `[rolldown-binding-check] Unsupported runtime: ${process.platform}/${process.arch}. Skipping strict binding check.`
  )
  process.exit(0)
}

try {
  require.resolve(`${expectedBinding}/package.json`)
  console.log(
    `[rolldown-binding-check] OK: found ${expectedBinding} for ${process.platform}/${process.arch}.`
  )
  process.exit(0)
} catch {
  const lines = [
    "[rolldown-binding-check] Missing Rolldown native binding for current runtime.",
    `Expected: ${expectedBinding}`,
    `Runtime: ${process.platform}/${process.arch}${
      process.platform === "linux" ? (isMusl() ? " (musl)" : " (glibc)") : ""
    }`
  ]

  if (installedBindings.length > 0) {
    lines.push(`Installed bindings: ${installedBindings.join(", ")}`)
  } else {
    lines.push("Installed bindings: none")
  }

  lines.push(
    "",
    "Suggested clean reinstall flow (important for shared Windows/WSL workspaces):",
    "1) Close any running dev/build process.",
    "2) Remove node_modules and package-lock.json.",
    "3) Reinstall dependencies from the runtime where you execute Node (Windows shell or WSL shell).",
    "4) Re-run: npm run check:rolldown-binding"
  )

  const output = lines.join("\n")

  if (adviceOnly) {
    console.warn(output)
    process.exit(0)
  }

  console.error(output)
  process.exit(1)
}
