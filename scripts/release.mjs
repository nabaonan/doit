import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const isMinor = process.argv.includes("--minor") || process.argv.includes("-m")
const bumpType = isMinor ? "minor" : "patch"

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { cwd: root, stdio: "inherit" })
}

run(`npm version ${bumpType} -m "chore: release v%s"`)

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"))

run("git push origin HEAD --follow-tags")

console.log(`Released v${pkg.version}`)
