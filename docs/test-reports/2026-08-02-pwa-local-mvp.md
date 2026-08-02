# 测试报告：PWA 本地 MVP

- 日期：2026-08-02
- 版本：0.1.0
- 范围：High-G 核心、稳定器、麦克风资源生命周期、本地录音分析、PWA 静态结构、本地 HTTP 响应
- 环境：macOS，Node.js v25.9.0
- 结论：本地自动质量门通过；公网与 iOS 26 真机验收待执行

## 自动测试

命令：

```bash
npm test
```

结果：22 passed，0 failed。

覆盖：

- JSON 规格与 G4/C4/E4/A4 JavaScript 配置一致。
- cents 换算、±5 cents 边界、自动和手动目标弦。
- 四个目标纯正弦、目标上下 10 cents、强二次泛音、静音、低音量和 NaN。
- 目标切换防抖、准音滞回和 700 ms 旧信号清理。
- 无效音高持续出现时旧读数也会过期。
- 麦克风帧读取，以及 RAF、节点、track、AudioContext 全量清理。
- AudioContext 尚在 resume 时停止，不会继续弹出麦克风权限请求。
- 文件类型/大小、窗口聚合、取消、解码上下文关闭。
- 录音分窗只分析完整可用起点；测试夹具得到 5/5 个预期窗口。

## 静态与隐私检查

命令：

```bash
npm run check
```

结果：通过。

检查内容：

- manifest 的 scope、start URL、standalone、竖屏和图标声明。
- 180/192/512 PNG 签名与实际尺寸。
- Service Worker 预缓存包含全部必要应用壳。
- 全部应用 JavaScript 可由 Node 解析。
- CSP 存在，不加载跨域脚本。
- 除 Service Worker 获取静态资源外，运行时代码不存在 `fetch`、XHR、WebSocket、EventSource 或 `sendBeacon` 上传入口。

## 本地 HTTP 冒烟

使用 `npm run dev` 启动 `127.0.0.1:4173`，检查结果：

| 路径 | 状态 | Content-Type |
| --- | ---: | --- |
| `/` | 200 | `text/html` |
| `/manifest.webmanifest` | 200 | `application/manifest+json` |
| `/sw.js` | 200 | `text/javascript` |
| `/app.js` | 200 | `text/javascript` |
| `/src/yin-pitch-detector.js` | 200 | `text/javascript` |
| `/icons/icon-180.png` | 200 | `image/png` |

512 图标已人工查看，四个弦钮清晰可辨。

## 测试中发现并修复

- 录音循环曾额外处理末尾不完整窗口，导致进度分母和实际窗口数不一致；已限制为合法窗口起点并复测。
- 浮点 cents 中位数会保留正常的二进制小数误差；断言改为数值容差，产品显示仍四舍五入到 0.1 cents。
- 无法匹配目标弦的连续估计曾不会触发旧读数过期；控制器已统一执行超时检查并新增回归测试。

## Pending：必须在目标设备完成

- iOS 26 Safari 和主屏幕 Web App 的真实麦克风允许/拒绝/重试。
- 真实尤克里里 G/C/E/A 与独立参考调音器对照。
- 语音备忘录 `.m4a`、真实 MP3/WAV 选择和解码。
- 添加到主屏幕、飞行模式冷启动、Service Worker 更新。
- Wi-Fi 与蜂窝网络访问最终 HTTPS 地址。
- Safari/主屏幕 App 的 Network 面板或代理确认音频零上传。
