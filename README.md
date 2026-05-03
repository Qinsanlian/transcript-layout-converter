# 大学生成绩单版式转换器（一式两份）

> Academic Transcript Layout Converter — Bilingual (EN/中文)

一个纯浏览器端的成绩单版式与 GPA 辅助工具。支持 **中英文一键切换**，同一份数据可分别导出中/英文 PNG。

## ✨ 功能概览

- **中英双语界面**：左侧编辑，右侧实时预览，一键切换中/英文
- **自动 GPA 计算**：输入百分制成绩和学分，自动换算等级点、等级、质量分，学期与累计 GPA 即时更新
- **学业状态自动评定**：根据累计 GPA 与内置分档（优秀 / 良好 / 一般 / 偏低）自动生成评定
- **批量导入课程**：支持 CSV / Excel（.xlsx, .xls）文件导入，提供 CSV 模板下载，自动识别中英文表头
- **学信网验证码栏**：可选填，显示在成绩单安全区供审核方参照
- **完整性存证**：SHA-256 版式指纹、导出 QR 码绑定快照、多源 UTC 参考时间
- **防伪与隐私**：安全底纹、VOID 微印、双栈水印、授权框淡粉水印；敏感信息模糊预览，导出时自动恢复
- **本地合规日志**：所有操作通过 IndexedDB/localStorage 留存哈希，不上传服务器
- **导出 PNG**：包含完整安全链（哈希、二维码、UTC 时间）的成绩单图片

## 🚀 快速开始

```bash
# 启动本地服务（勿用 file:// 打开，二维码与部分 API 受限）
./serve.sh
# 或指定端口
./serve.sh 8888
```

然后在浏览器访问 `http://127.0.0.1:8765`。

## 📥 批量导入（Excel / CSV）

工具依赖 **SheetJS** 解析表格文件。默认通过 CDN 加载，**离线或内网环境**可按以下步骤使用本地文件：

1. 从 [SheetJS CDN](https://cdn.sheetjs.com/) 下载与 `index.html` 中版本一致的 `xlsx.full.min.js`
2. 将文件放在与 `index.html` 相同的目录下，命名为 `xlsx.full.min.js`
3. 在 `index.html` 中**删除**指向 CDN 的 `<script>` 行，并**仅保留**：
   ```html
   <script src="./xlsx.full.min.js"></script>
   ```
4. 该 `<script>` 须位于 `i18n.js` 之后、`script.js` 之前

支持的列名（中英文均可）：Subject/课程类型、Course Number/课号、Description/课程名称、Percent/百分制、Credits/学分。

## 🔧 开发与校验

- **静态检查**：`npm run smoke` 或 `node tools/smoke-check.mjs` – 校验 vendored 脚本哈希、DOM 关键节点与脚本顺序
- **语法检查**：`npm run check` – 对 `script.js` 和 `i18n.js` 进行语法检查
- **CI**：GitHub Actions 在推送到 `main/master` 或 PR 时自动运行 `npm run smoke`
- 浏览器手动测试：语言切换、批量导入、导出 PNG、隐私模糊等

## 📦 Vendored 脚本

| 文件 | 说明 | SHA-256 |
|------|------|---------|
| `html2canvas.min.js` | [html2canvas](https://html2canvas.hertzen.com) **1.4.1**（MIT） | `e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb` |
| `qrcode.min.js` | [davidshimjs/qrcodejs](https://github.com/davidshimjs/qrcodejs) 风格 min | `94a29cf772a183b1673f47cd91b8e80fa0044287eeb47a3c41f71fdac365898a` |

更换 vendor 后请重算哈希并同步更新 `tools/smoke-check.mjs` 与本表。

## 📄 许可

本项目基于 **Apache License, Version 2.0** 发布，详见 [LICENSE](LICENSE)。`index.html` 页头注释中的版权人与本说明一致。

