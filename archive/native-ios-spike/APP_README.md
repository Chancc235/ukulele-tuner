# iOS App 层

这里将放置最低支持 iOS 26 的 SwiftUI 工程，平台能力包括：

- `AVAudioSession` / `AVAudioEngine`：麦克风采集与音频中断处理。
- SwiftUI：单页调音界面和权限状态。
- Core Haptics 或 UIKit feedback generator：调准后的单次触觉反馈。
- TestFlight：发送邀请链接给另一台 iPhone 安装。

完整 Xcode 尚未安装，因此当前先在 `core/` 建立可由 Swift Package Manager 独立测试的调音核心。取得项目固定的 Xcode 26.3 后创建 App target 并依赖该核心包；所有 Xcode 命令使用 `scripts/with-project-xcode.sh`，不切换全局工具链。平台决定见 `docs/decisions/ADR-0001-platform-strategy.md`。
