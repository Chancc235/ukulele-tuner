# UkeTune（暂定名）

一款为标准 High-G 尤克里里设计的零费用 PWA 调音器，仅面向 iOS 26 iPhone。它可以从 Safari 安装到主屏幕，支持实时麦克风调音和本地录音文件识别，并在首次加载后离线运行。

## 已确定范围

- 四根弦与四个实体弦钮：G4、C4、E4、A4。
- 自动识别，以及 G/C/E/A 四个手动锁弦按钮。
- 实时麦克风模式。
- “选择录音”备用模式；`.m4a/.mp3/.wav` 只在本机解码，不上传服务器。
- 显示频率、cents，以及“音高升高 / 准了 / 音高降低”。
- iOS 26 Safari PWA：主屏幕图标、standalone 显示、离线缓存。
- 不需要 Xcode、Apple Developer Program、TestFlight、服务器或付费域名。

不同琴头和绕弦方式的顺/逆时针方向可能相反，因此 App 只提示音高需要升高或降低，不写死旋钮旋转方向。

## 当前状态

本地 MVP 已完成：应用壳、四弦调音算法、实时麦克风、本地录音分析、离线缓存和免费部署工作流均已实现。自动测试 22/22 通过；下一步是取得 HTTPS 地址，并在目标 iOS 26 iPhone 上完成真实尤克里里、语音备忘录 M4A、安装和飞行模式验收。

先前的 Swift 原生探索保存在 `archive/native-ios-spike/`，没有删除，也不属于当前产品构建。

## 开发命令

项目采用浏览器原生 API 和 Node 内置测试工具，首版不引入第三方运行时依赖。

```bash
npm test
npm run check
npm run icons
npm run dev
```

本地开发地址默认是 `http://localhost:4173`。iPhone 真机麦克风和安装测试必须使用部署后的 HTTPS 地址。

项目没有第三方 npm 依赖，也没有修改本机 Node、Xcode 或系统工具版本。`npm run icons` 只运行仓库内的无依赖图标生成脚本。

## 文档

- [可行性分析](docs/00-feasibility.md)
- [产品需求](docs/01-product-requirements.md)
- [技术设计](docs/02-technical-design.md)
- [开发计划](docs/03-development-plan.md)
- [免费部署与安装](docs/04-distribution.md)
- [测试计划](docs/05-testing.md)
- [发布检查表](docs/06-release-checklist.md)
- [开发日志](docs/DEVLOG.md)
- [PWA 技术决策](docs/decisions/ADR-0002-pwa-platform.md)
- [当前状态](PROJECT_STATUS.md)
- [最新本地测试报告](docs/test-reports/2026-08-02-pwa-local-mvp.md)
- [首轮代码审查](docs/reviews/CR-001-pwa-local-mvp.md)

## 隐私原则

麦克风 PCM 和用户选择的录音只存在于当前页面内存。项目不提供上传接口，不保存录音，不接入广告、统计、远程字体或第三方脚本。托管平台只能看到普通静态页面请求，不能获得音频内容。
