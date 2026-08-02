# Changelog

## Unreleased

### Added

- 建立 iOS 26 PWA 产品、技术、测试和部署文档。
- 规划实时麦克风与本地录音文件双入口。
- 增加 G/C/E/A 四个手动弦钮选择和自动模式要求。
- 建立持续测试、开发日志和 code review 记录机制。
- 实现 iPhone 竖屏优先的单页调音界面、Auto 和 G/C/E/A 四弦按钮。
- 实现 YIN 音高检测、cents、手动/自动目标、平滑、滞回和信号超时。
- 实现实时麦克风采集、停止、后台清理和权限失败回退。
- 实现 M4A/MP3/WAV 本机解码、进度、取消、窗口聚合和错误恢复。
- 实现 manifest、180/192/512 图标、Service Worker 离线缓存和更新提示。
- 增加 22 项自动测试、静态/隐私质量门和本地开发服务器。
- 增加测试后才发布 `app/` 的 GitHub Pages workflow。
- 完成首份本地测试报告和 CR-001 代码审查记录。

### Changed

- 主方案从 Swift 原生 App 改为零费用 PWA。
- 使用范围从“发送到另一台手机”收敛为一台 iPhone 自用。
- 修复录音末尾窗口计数、范围外音高旧读数、麦克风后台竞态和资源清理边界。

### Archived

- 将早期 Swift/YIN 原型和 Xcode 方案保存到 `archive/native-ios-spike/`。

### Deployed

- 公网预览版发布到 `https://chancc235.github.io/ukulele-tuner/`。
- GitHub Actions 远程核心测试、静态/隐私检查和 Pages deploy 全部通过。
