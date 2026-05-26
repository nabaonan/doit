import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"))
const version = pkg.version

const tauriConfPath = resolve(root, "src-tauri", "tauri.conf.json")
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"))
tauriConf.version = version
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n")

const cargoPath = resolve(root, "src-tauri", "Cargo.toml")
const cargoContent = readFileSync(cargoPath, "utf-8")
const updatedCargo = cargoContent.replace(/^version\s*=\s*".*"/m, `version = "${version}"`)
writeFileSync(cargoPath, updatedCargo)

console.log(`Synced version ${version} to tauri.conf.json and Cargo.toml`)