# 中国学术成绩单格式转换器（第二次修订）

静态网页成绩单版式与 GPA 辅助工具（`package.json` 工程名：`transcript-layout-converter-bilingual`）。请用 `serve.sh` 或任意 HTTP 根目录指向本文件夹打开（勿用 `file://`，二维码与部分授时接口受限）。

## 开发 / 校验

- **静态检查（无依赖）**：`npm run smoke` 或 `node tools/smoke-check.mjs`  
  校验 vendored 脚本 SHA-256、`index.html` 关键节点与脚本顺序、`i18n.js` 接线。
- **语法快速检查**：`npm run check`（`node --check` 于 `script.js` / `i18n.js`）。
- **CI**：推送或 PR 至 `main` / `master` 时，GitHub Actions 会运行 `npm run smoke`。
- 浏览器手测：语言切换、Excel/CSV 导入、导出 PNG、隐私模糊开关。

## SheetJS（Excel/CSV 导入）

默认自 CDN 加载（见 `index.html` 中 `cdn.sheetjs.com` 的 `xlsx.full.min.js`）。**离线或内网**可改为本地文件：

1. 从 [SheetJS CDN 发行页](https://cdn.sheetjs.com/) 下载与当前版本一致的 `xlsx.full.min.js`（或与 `index.html` 中 URL 版本一致的全量构建）。
2. 将文件保存到与本 `index.html` **同一目录**，命名为 `xlsx.full.min.js`。
3. 在 `index.html` 中**删除**指向 `cdn.sheetjs.com` 的 `<script>` 行，并**仅保留**一行：

   ```html
   <script src="./xlsx.full.min.js"></script>
   ```

4. 该行须仍位于 `./i18n.js` 之后、`./script.js` 之前。`npm run smoke` 要求 **CDN 与本地二选一**，不可同时存在两处引用。

## 第三方脚本（vendored）

| 文件 | 说明 | 校验 |
|------|------|------|
| `html2canvas.min.js` | [html2canvas](https://html2canvas.hertzen.com) **1.4.1**（文件头含版权与版本） | `shasum -a 256 html2canvas.min.js` → `e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb` |
| `qrcode.min.js` | [davidshimjs/qrcodejs](https://github.com/davidshimjs/qrcodejs) 风格 **min**（全局 `QRCode`）；首行含简短注释 | `shasum -a 256 qrcode.min.js` → `94a29cf772a183b1673f47cd91b8e80fa0044287eeb47a3c41f71fdac365898a` |

更换 vendor 后请重算 SHA-256 并同步更新本表与 `tools/smoke-check.mjs` 中的期望值。

## 许可

见仓库根目录 `LICENSE`（Apache-2.0）。`index.html` 页头注释中的版权人与本说明一致。
