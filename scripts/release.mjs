import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { cwd: root, stdio: "inherit" })
}

run("npm version patch -m \"chore: release v%s\"")

run("node scripts/sync-version.mjs")
run("git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock")

run("git commit --amend --no-edit")

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"))
run(`git tag -f "v${pkg.version}" HEAD`)

run("git push origin HEAD --follow-tags")