# 修复 PDF 中文乱码计划

## 问题分析

`jsPDF` 默认只包含 Helvetica/Times/Courier 等 Latin 字体，无法渲染 CJK 字符。需要在生成 PDF 前注册并加载一个中文字体。

## 解决方案

嵌入一个轻量中文字体到 jsPDF 中：

1. 将 TTF 字体文件转为 base64 字符串
2. 通过 `doc.addFileToVFS()` + `doc.addFont()` 注册字体
3. 通过 `doc.setFont()` 使用该字体渲染中文

## 修改文件

### 1. `src/utils/pdfFont.ts` — **新建**

存放中文字体的 base64 编码。选取一个支持中文的轻量字体，转为 base64 后大约 2-5MB。

具体步骤：
1. 下载 `NotoSansSC-Regular` 或类似开源中文字体（TTF 格式）
2. 读取 TTF 文件的二进制内容，转为 base64 字符串
3. 导出为常量供 ReportDialog 使用

```ts
// src/utils/pdfFont.ts
export const CJK_FONT_BASE64 = "AAEAAAAKAIAAAwAg..."; // 字体 base64 数据
export const CJK_FONT_NAME = "NotoSansSC-Regular.ttf";
export const CJK_FONT_FAMILY = "NotoSansSC";
```

### 2. `src/components/ReportDialog.vue` — **修改 `buildPDFDoc()`**

在创建 PDF 文档后、渲染中文文本前，注册字体：

```ts
import { CJK_FONT_BASE64, CJK_FONT_NAME, CJK_FONT_FAMILY } from "../utils/pdfFont";

function buildPDFDoc(): jsPDF {
  const doc = new jsPDF();

  // 注册中文字体
  doc.addFileToVFS(CJK_FONT_NAME, CJK_FONT_BASE64);
  doc.addFont(CJK_FONT_NAME, CJK_FONT_FAMILY, "normal");

  // 设置中文字体
  doc.setFont(CJK_FONT_FAMILY);

  // ... 后续 PDF 内容构建
  return doc;
}
```

## 字体文件获取

### 方案 A：从 npm 安装

```bash
npm install @fontsource/noto-sans-sc
```

然后读取 `node_modules/@fontsource/noto-sans-sc/files/*.ttf` 转为 base64。

### 方案 B：手动下载后内联

直接下载字体文件放到 `src/assets/`，通过构建工具读取。

### 推荐：方案 A + 构建脚本

写一个 Node.js 脚本 `scripts/generate-font-base64.mjs`，读取字体文件生成 base64 字符串写入 `src/utils/pdfFont.ts`。

## 实现步骤

1. `npm install @fontsource/noto-sans-sc` 安装字体包
2. 创建 `scripts/generate-font-base64.mjs` — 读取 TTF 生成 base64 到 `src/utils/pdfFont.ts`
3. 运行脚本生成 `src/utils/pdfFont.ts`
4. 在 `buildPDFDoc()` 中注册并使用字体
5. 验证 PDF 输出中文正常

## 注意事项

- base64 字体约 2-5MB，会增加构建产物大小（约 1-2MB gzip 后）
- 字体仅在导出 PDF 时使用，不影响运行时性能
- 需要确认 phi字体文件路径正确