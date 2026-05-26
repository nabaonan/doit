import { execSync } from "child_process"
import { appendFileSync } from "fs"

const tagName = process.env.GITHUB_REF_NAME

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim()
  } catch {
    return ""
  }
}

const allTags = run("git tag --sort=-v:refname")
const tags = allTags ? allTags.split("\n").filter(Boolean) : []

const prevTag = tags.filter((t) => t !== tagName)[0] || ""

let commits = ""
if (prevTag) {
  commits = run(`git log ${prevTag}..${tagName} --pretty=format:"%s"`)
} else {
  commits = run('git log --pretty=format:"%s"')
}

const lines = commits ? commits.split("\n").filter(Boolean) : []

const featPattern = /^(feat|feature)(\(.+\))?:\s*/i
const fixPattern = /^(fix|bugfix)(\(.+\))?:\s*/i

const feat = []
const fix = []
const other = []

for (const line of lines) {
  if (featPattern.test(line)) {
    feat.push(line.replace(featPattern, ""))
  } else if (fixPattern.test(line)) {
    fix.push(line.replace(fixPattern, ""))
  } else {
    other.push(line)
  }
}

let body = ""
if (feat.length > 0) {
  body += "## 🚀 新特性\n\n" + feat.map((s) => `- ${s}`).join("\n") + "\n"
}
if (fix.length > 0) {
  body += "\n## 🐛 缺陷修复\n\n" + fix.map((s) => `- ${s}`).join("\n") + "\n"
}
if (other.length > 0) {
  body += "\n## 📋 其他变更\n\n" + other.map((s) => `- ${s}`).join("\n")
}

const outputFile = process.env.GITHUB_OUTPUT
if (outputFile) {
  const delim = `RELNOTES_${Date.now()}`
  appendFileSync(outputFile, `body<<${delim}\n${body}\n${delim}\n`)
}

console.log("Release notes generated")