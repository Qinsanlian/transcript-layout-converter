# 大学生成绩单转换器（一式两份）

静态网页成绩单版式与 GPA 辅助工具：用 `serve.sh` 或任意 HTTP 根目录指向本文件夹（勿用 `file://` 打开，二维码与部分 API 受限）。

## 开发 / 校验

- **极简静态检查（无依赖）**：`npm run smoke` 或 `node tools/smoke-check.mjs`
- 可选：在本地起服务后用浏览器手测语言切换与导出。

## 第三方脚本（vendored）

| 文件 | 说明 | 校验 |
|------|------|------|
| `html2canvas.min.js` | [html2canvas](https://html2canvas.hertzen.com) **1.4.1**（文件头含版权与版本） | `shasum -a 256 html2canvas.min.js` → `e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb` |
| `qrcode.min.js` | [davidshimjs/qrcodejs](https://github.com/davidshimjs/qrcodejs) 风格 **min**（全局 `QRCode`）；首行含简短注释 | `shasum -a 256 qrcode.min.js` → `94a29cf772a183b1673f47cd91b8e80fa0044287eeb47a3c41f71fdac365898a` |

更换 vendor 后请重算 SHA-256 并同步更新本表与 `tools/smoke-check.mjs` 中的期望值。

## 许可

见仓库根目录 `LICENSE`（Apache-2.0）。`index.html` 页头注释中的版权人与本说明一致。
