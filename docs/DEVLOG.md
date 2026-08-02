# 开发日志

## 2026-08-02：原生可行性探索

- 最初按原生 iOS 26 App 调研 SwiftUI、AVAudioEngine 和 TestFlight。
- 创建了纯 Swift YIN 算法探索和项目本地工具链方案。
- 该路线因用户后续选择零费用 PWA 而停止。
- 所有探索文件移入 `archive/native-ios-spike/`，没有删除。

## 2026-08-02：切换为零费用 PWA

### 用户决定

- 只使用一台 iOS 26 iPhone。
- 希望免费在线部署并添加到主屏幕。
- 需要实时麦克风调音。
- 麦克风不可用时，必须支持选择已有录音识别。
- 尤克里里有四个实体弦钮，界面要明确表示 G/C/E/A 四根弦。
- 开发过程中持续维护文档、定期功能测试和 code review。

### 技术决定

- 原生 HTML/CSS/JavaScript、Web Audio、Service Worker。
- 零第三方运行时依赖、零后端。
- 录音只在本机 `decodeAudioData`，不上传。
- GitHub Pages 作为默认免费部署，Cloudflare Pages 作为备选。
- ADR-0001 标记为 Superseded，ADR-0002 Accepted。

### 文档工作

- 产品、技术、开发、测试、发布和部署文档已全部改写为 PWA。
- 建立 `docs/test-reports/` 与 `docs/reviews/` 质量记录目录。
- 明确每个里程碑的测试和 review 门槛。

### 下一步

1. 创建 PWA 应用壳与本地开发命令。
2. 实现共享调音核心和自动测试。
3. 接入实时麦克风与本地录音分析。
4. 完成首轮 code review 和桌面功能验证。

## 2026-08-02：完成 PWA 本地 MVP

### 实现

- 建立不需要构建的静态 PWA：页面、响应式样式、manifest、四弦钮图标和 Service Worker。
- 完成 Auto + G/C/E/A 手动锁弦，标准 High-G 配置与共享 JSON 自动校对。
- 完成 YIN、cents、目标匹配、5 帧平滑、±5/±7 cents 滞回和 700 ms 信号超时。
- 完成实时麦克风约 20 Hz 分析循环、明确停止按钮、权限错误回退和后台资源释放。
- 完成本机录音选择、25 MB/30 秒限制、多声道下混、最多 240 窗口、进度、取消和稳定聚合。
- 录音数据没有上传、持久化或进入 Service Worker cache。
- 使用仓库内无依赖脚本生成 180/192/512 PNG；没有安装第三方包或改变本机工具版本。

### 测试

- `npm test`：22 passed，0 failed。
- `npm run check`：通过，包括 manifest、离线清单、JavaScript 语法、PNG 尺寸、CSP 和运行时网络 API 禁止规则。
- 本地 HTTP 冒烟：页面、manifest、worker、模块和图标均为 200 且 MIME 正确。
- 结果记录在 `docs/test-reports/2026-08-02-pwa-local-mvp.md`。

### Code review

- 完成 `CR-001-pwa-local-mvp.md`，关闭 3 个 P1 和 6 个 P2。
- 主要修复：范围外音高不清旧读数、麦克风启动中切后台竞态、资源清理容错、录音尾窗计数、CSS 状态选择器和文件输入焦点。
- 修复后完整自动测试再次通过。

### 部署准备

- 增加 GitHub Pages workflow，使用官方 `checkout@v6`、`setup-node@v6`、`configure-pages@v5`、`upload-pages-artifact@v4` 和 `deploy-pages@v4`。
- 工作流只在测试和静态检查通过后上传 `app/`。
- 尚未创建远程仓库或公网地址；需要用户在自己的 GitHub 账号中完成登录、公开仓库选择和 Pages 开启。

### 下一步

1. 本地 Git 仓库已经初始化为 `main`，归档 Swift 的 102 MB 构建缓存已确认被忽略；项目级作者使用 GitHub 隐私邮箱 `150511412+Chancc235@users.noreply.github.com`，不修改全局 Git 配置。
2. 用户准备 GitHub 账号/公开仓库，完成首次免费部署。
3. 在目标 iOS 26 iPhone 上执行真实麦克风、语音备忘录 M4A、主屏幕安装和飞行模式测试。
4. 根据真琴数据调校阈值，再做发布前 CR-002。
