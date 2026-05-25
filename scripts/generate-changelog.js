import { execSync } from "child_process"
import { writeFileSync, readFileSync, existsSync } from "fs"

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim()
}

function getCommitMessages(previousTag, currentTag) {
  const range = previousTag ? `${previousTag}..${currentTag}` : currentTag
  try {
    return run(`git log ${range} --pretty=format:"%s|||%h|||%an"`)
  } catch {
    return ""
  }
}

function categorizeCommit(message) {
  const categories = {
    feat: { title: "新功能", pattern: /^(feat|feature)(\(.+\))?:/i },
    fix: { title: "Bug 修复", pattern: /^(fix|bugfix)(\(.+\))?:/i },
    perf: { title: "性能优化", pattern: /^perf(\(.+\))?:/i },
    refactor: { title: "重构", pattern: /^refactor(\(.+\))?:/i },
    style: { title: "样式调整", pattern: /^style(\(.+\))?:/i },
    docs: { title: "文档更新", pattern: /^docs(\(.+\))?:/i },
    test: { title: "测试", pattern: /^test(\(.+\))?:/i },
    build: { title: "构建/工具", pattern: /^(build|chore|ci)(\(.+\))?:/i },
  }

  for (const [key, { title, pattern }] of Object.entries(categories)) {
    if (pattern.test(message)) {
      return { category: key, title }
    }
  }
  return { category: "other", title: "其他变更" }
}

function formatCommitLine(message, hash, author) {
  const cleanMessage = message.replace(
    /^(feat|feature|fix|bugfix|perf|refactor|style|docs|test|build|chore|ci)(\(.+\))?:\s*/i,
    ""
  )
  return `- ${cleanMessage} (\`${hash}\` by @${author})`
}

function generateChangelog(commits) {
  if (!commits || commits.length === 0) {
    return "暂无变更记录\n"
  }

  const grouped = {}
  for (const commit of commits) {
    const { category, title } = categorizeCommit(commit.message)
    if (!grouped[category]) {
      grouped[category] = { title, items: [] }
    }
    grouped[category].items.push(commit)
  }

  const order = ["feat", "fix", "perf", "refactor", "style", "docs", "test", "build", "other"]
  let output = ""

  for (const key of order) {
    const group = grouped[key]
    if (!group || group.items.length === 0) continue
    output += `### ${group.title}\n\n`
    for (const item of group.items) {
      output += `${formatCommitLine(item.message, item.hash, item.author)}\n`
    }
    output += "\n"
  }

  return output
}

function main() {
  const tags = run("git tag --sort=-v:refname")
    .split("\n")
    .filter(Boolean)

  if (tags.length === 0) {
    console.log("No tags found, skipping changelog generation")
    return
  }

  const currentTag = tags[0]
  const previousTag = tags.length > 1 ? tags[1] : null

  const log = getCommitMessages(previousTag, currentTag)
  if (!log) {
    console.log("No commits found between tags")
    return
  }

  const commits = log.split("\n").filter(Boolean).map((line) => {
    const [message, hash, author] = line.split("|||")
    return { message, hash, author }
  })

  const date = new Date().toISOString().split("T")[0]
  const versionName = currentTag.replace(/^v/, "v")

  const changelogContent = generateChangelog(commits)

  const header = `## ${versionName} (${date})\n\n${changelogContent}---\n\n`

  let existingContent = ""
  if (existsSync("CHANGELOG.md")) {
    existingContent = readFileSync("CHANGELOG.md", "utf-8")
    const titleEnd = existingContent.indexOf("\n## ")
    if (titleEnd !== -1) {
      existingContent = existingContent.substring(titleEnd)
    }
  }

  const fullContent = `# Changelog\n\n${header}${existingContent}`
  writeFileSync("CHANGELOG.md", fullContent, "utf-8")

  console.log(`Changelog updated for ${currentTag}`)
}

main()