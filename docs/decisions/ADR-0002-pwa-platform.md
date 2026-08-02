# ADR-0002：采用零费用 iOS 26 PWA

- 状态：Accepted
- 决定日期：2026-08-02

## 背景

产品只供一台 iOS 26 iPhone 自用。用户希望像 App 一样安装到手机，但不希望支付 Apple Developer Program、购买服务器或修改本机开发工具；同时要求实时麦克风失败时可以选择已有录音进行识别。

## 决定

- 采用可添加到主屏幕的 PWA，不制作原生 IPA。
- 使用原生 HTML、CSS、JavaScript 和 Web Audio API。
- 使用 `getUserMedia` 进行实时麦克风采集。
- 使用文件选择器 + `decodeAudioData` 在本机分析 `.m4a/.mp3/.wav`。
- 使用 Service Worker 缓存应用壳，首次成功加载后支持离线调音。
- 首版不使用前端框架、不接后端、不引入第三方运行时脚本。
- 默认以 GitHub Pages 免费 HTTPS 托管；网络实测不理想时可原样切换 Cloudflare Pages。

## 理由

- 不需要 Apple 开发者会员、Xcode、签名、TestFlight 或 90 天构建续期。
- Apple 在 iOS 26 中支持把网站作为 Web App 添加到主屏幕。
- Web Audio 足以处理 180–500 Hz 的尤克里里基频。
- 静态托管和本机音频计算可以保持零服务器成本。
- 本地录音分析既是权限拒绝时的备用入口，也能缓解少数 iOS 26 WebKit 麦克风会话异常。

## 代价

- 第一次必须通过 HTTPS 在 Safari 打开并手动添加到主屏幕。
- 浏览器无法像原生 AVAudioEngine 一样精细控制音频会话。
- iOS 可能在存储紧张或长期不用时清理网站缓存，需要重新联网打开。
- 免费境外托管在实际网络中的可达性需要真机验证。
- 前端源代码天然可由浏览器查看，即使代码仓库是私有的。

## 重新评估条件

只有当 PWA 在目标 iPhone 上无法达到准确度、麦克风可靠性或离线安装要求时，才重新评估原生 iOS 路线。在真机证据出现前，不同时维护两套产品。

