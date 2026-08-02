# 测试报告：GitHub Pages 公网预览

- 日期：2026-08-03（Asia/Shanghai）
- 应用版本：0.1.0
- Commit：`fa01bce`
- Actions run：`30756052345`
- 发布地址：<https://chancc235.github.io/ukulele-tuner/>
- 结论：远程质量门、部署和公开静态资源验收通过；iOS 26 真机验收待执行

## GitHub Actions

| Job / 步骤 | 结果 |
| --- | --- |
| Node.js 22 setup | Pass |
| 22 项核心测试 | Pass |
| 静态与隐私检查 | Pass |
| Pages artifact upload | Pass |
| GitHub Pages deploy | Pass |

## 线上 HTTP 验收

| 路径 | HTTP | Content-Type |
| --- | ---: | --- |
| `/` | 200 | `text/html` |
| `/manifest.webmanifest` | 200 | `application/manifest+json` |
| `/sw.js` | 200 | `application/javascript` |
| `/app.js` | 200 | `application/javascript` |
| `/icons/icon-180.png` | 200 | `image/png` |

页面内容确认：

- Auto 与 G4/C4/E4/A4 四个目标按钮存在。
- 本机录音选择入口存在。
- 明确显示音频只在当前设备内存中分析，不保存、不上传。
- Service Worker 为 `uketune-v1`，关键应用壳和分析模块位于预缓存清单。

## Pending：目标 iPhone

- iOS 26 Safari 与主屏幕 Web App。
- 麦克风允许、拒绝、停止、后台和重新开始。
- 语音备忘录 M4A、真实 MP3/WAV。
- 飞行模式冷启动和本地录音分析。
- Wi-Fi/蜂窝网络可达性。
- 真琴与独立调音器准确度对照。

