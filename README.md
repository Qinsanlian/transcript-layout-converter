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
# 大学生成绩单版式转换器（一式两份）

> Academic Transcript Layout Converter — Bilingual (EN/中文)

一个纯浏览器端的成绩单版式与 GPA 辅助工具。支持**中英文一键切换**，同一份数据可分别导出中/英文 PNG。

## 它能做什么

- **双语成绩单**：左侧编辑，右侧实时预览，一键切换中/英文界面
- **自动 GPA 计算**：输入百分制成绩和学分，自动换算等级点和 GPA
- **学期与累计汇总**：支持单/双学期模式，自动计算学期 GPA 和累计 GPA
- **学信网验证码栏**：可选填，显示在成绩单安全区供审核方核验
- **完整性存证**：SHA-256 哈希、导出 QR 码、UTC 参考时间
- **防伪与隐私**：安全底纹、水印、VOID 微印、模糊预览模式
- **本地合规日志**：所有操作本地留存，不上传服务器
- **导出 PNG**：一键导出带完整安全链的成绩单图片

## 快速开始

```bash
# 启动本地服务（勿用 file:// 打开，部分功能受限）
./serve.sh
# 或指定端口
./serve.sh 8888
