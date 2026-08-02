# 可行性分析：零费用 iOS 26 PWA

更新日期：2026-08-02

## 结论

可行，且比原生 App 更符合“一台 iPhone 自用、不花钱”的目标。iOS 26 Safari 可以把网站作为 Web App 添加到主屏幕；应用可使用 Web Audio API 读取麦克风，或解码用户主动选择的录音文件。Service Worker 能缓存全部静态文件，使调音功能在首次加载后离线运行。

不需要 Apple Developer Program、Xcode、TestFlight、App Store、服务器数据库或付费域名。

## 安装形态

免费 HTTPS 部署后，用户在 iPhone 上执行：

```text
Safari 打开链接
  -> 分享
  -> 添加到主屏幕
  -> 打开为 Web App
  -> 添加
```

主屏幕会出现 UkeTune 图标，打开时使用 standalone 窗口。它是 Apple 官方支持的 Web App 安装方式，但不是 App Store 安装。

## 两条音频入口

### 实时麦克风

- 用户点击“开始实时调音”后才调用 `navigator.mediaDevices.getUserMedia`。
- 麦克风属于安全上下文能力，真机必须使用 HTTPS。
- Web Audio 提供实际采样率和 PCM 帧，YIN 算法在本地计算频率。
- 进入后台、页面隐藏、用户停止或发生错误时，立即停止所有 audio tracks。

### 本地录音识别

- 用户点击“选择录音”，通过系统文件选择器选择 `.m4a/.mp3/.wav`。
- 页面读取 `File` 的 ArrayBuffer，用 `AudioContext.decodeAudioData` 解码。
- PCM 仍只在浏览器内存中计算；没有 HTTP 上传请求和服务端存储。
- 首版要求每段录音 2–10 秒、只拨一根弦 2–3 次，结果更可靠。
- iOS 26“语音备忘录”可以把录音以 `.m4a` 保存到“文件”后选择。

“上传录音”在产品文案中改称“选择录音（本机分析）”，避免误导用户以为文件会离开手机。

## 调音可行性

标准 High-G 四根弦：

| 弦 | 频率 |
| --- | ---: |
| G4 | 391.995 Hz |
| C4 | 261.626 Hz |
| E4 | 329.628 Hz |
| A4 | 440.000 Hz |

这些频率非常适合手机音频采样。4096 samples 的分析窗口在 48 kHz 下约 85 ms；配合 20 Hz 左右的更新、YIN 基频检测和连续帧平滑，第一条反馈 300 ms 内、稳定反馈 500 ms 内是现实目标。

最大技术风险是弦乐泛音造成倍频误判，而不是浏览器能否听见声音。首版采用 YIN、180–500 Hz 频段限制、置信度门限、中位数平滑和目标切换滞回来处理。

## 四个弦钮的产品表达

实体尤克里里有四个调音旋钮，每个控制一根弦。App 提供 `自动 / G / C / E / A` 五个选择，其中 G/C/E/A 是四个明确的弦钮目标。

弦序按持琴状态从第 4 弦到第 1 弦表示为 G–C–E–A。不同琴头结构和绕线方式会改变顺/逆时针的实际效果，因此 App 只显示“音高需要升高/降低”，不宣称统一的旋转方向。取得用户琴头照片后可以做匹配实体布局的视觉版本，但不影响首版算法。

## 离线能力

- 首次访问需要网络，以下载应用壳并注册 Service Worker。
- 安装成功后，HTML/CSS/JavaScript/manifest/icons 都从 Cache Storage 读取。
- 调音算法、麦克风和文件解码不依赖网络。
- 录音文件不会放入 Service Worker cache。
- 新版本需要联网一次取得更新；旧缓存仍作为失败回退。

iOS 可能在存储紧张或长期未使用时清理网站数据，因此不能承诺永久离线。重新打开部署链接即可恢复。

## 免费托管

首选 GitHub Pages：GitHub Free 的公开仓库可免费托管静态 HTML/CSS/JavaScript，并提供 HTTPS。项目规模极小，远低于其限制。

如果不接受公开仓库，可切换 Cloudflare Pages 免费计划并连接私有仓库；不过发布到浏览器的 JavaScript 仍可查看。两种服务在用户实际网络中的速度都需要 iPhone 真机测试。

## 已知限制与缓解

| 限制 | 影响 | 缓解 |
| --- | --- | --- |
| 麦克风必须经用户授权 | 拒绝后不能实时调音 | 清楚的恢复说明 + 本地录音入口 |
| iOS 26 有 WebKit 音频会话异常报告 | 极少情况下实时采集失败 | 停止/重试、刷新提示、本地录音入口 |
| PWA 缓存可能被系统清理 | 暂时失去离线使用 | 保留链接并重新加载 |
| 免费境外托管可达性不确定 | 首次安装或更新慢 | GitHub Pages/Cloudflare Pages 互换并实测 |
| 文件格式解码由 Safari 决定 | 个别编码可能无法打开 | 首选语音备忘录 `.m4a`，并支持 WAV/MP3 |
| 长录音计算量大 | 页面短时卡顿 | 25 MB / 30 秒硬限制，只分析有效窗口 |

## 官方资料

- [Apple：iOS 26 将网站作为 Web App 添加到主屏幕](https://support.apple.com/en-bw/guide/iphone/iphea86e5236/26/ios/26)
- [W3C：Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
- [WebKit：AudioWorklet / Web Audio 支持](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/)
- [Apple：语音备忘录导出到“文件”](https://support.apple.com/en-hk/guide/iphone/iph831c37815/26/ios/26)
- [WebKit：iOS 26 音频会话重置问题报告](https://bugs.webkit.org/show_bug.cgi?id=319706)
- [GitHub Pages 免费范围](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare Pages 免费限制](https://developers.cloudflare.com/pages/platform/limits/)

