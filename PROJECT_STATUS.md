# 项目状态

- 项目：UkeTune（暂定名）
- 更新日期：2026-08-02
- 产品平台：iOS 26 Safari PWA
- 当前里程碑：M6 免费部署
- 状态：本地 MVP 完成，待公网和 iOS 26 验收

## 已完成

- 确认只供一台 iOS 26 iPhone 自用。
- 确认标准 High-G：G4/C4/E4/A4，对应四根弦和四个弦钮。
- 确认实时麦克风 + 本地录音文件双入口。
- 确认音频完全在浏览器本机处理。
- 确认首版采用原生 HTML/CSS/JavaScript，零第三方运行时依赖。
- 确认免费 HTTPS 静态托管；默认候选为 GitHub Pages。
- 原生 Swift 探索已保留到 `archive/native-ios-spike/` 并退出活跃路线。
- 完成自适应单页界面、Auto + G/C/E/A 四弦按钮和四弦钮图标。
- 完成 YIN、cents、目标匹配、平滑、准音滞回和旧信号超时。
- 完成实时麦克风开始/停止/后台清理和权限错误回退。
- 完成本机 M4A/MP3/WAV 选择、大小/时长校验、解码、进度、取消和窗口聚合。
- 完成 manifest、Service Worker 离线应用壳、更新提示和 CSP。
- 完成 GitHub Pages 测试后部署 workflow。
- 本地 Git 仓库已初始化为 `main`；使用 GitHub 隐私邮箱为 `Chancc235` 配置项目级作者身份，尚未连接远程仓库。
- 自动测试 22/22、静态/隐私检查和本地 HTTP 冒烟通过。
- 完成 CR-001；代码级 P0/P1 均已关闭并复测。

## 正在进行

- 准备 GitHub 公开仓库和首次 Pages 发布。
- 准备目标 iPhone 的真实音频、安装、离线和网络验收。

## 部署前需要用户完成

- 准备 GitHub 账号，并确认接受公开仓库；如不接受则改用 Cloudflare Pages。不要把密码、验证码或恢复码发给项目。
- 部署后在目标 iPhone 的 Safari 完成添加到主屏幕和麦克风授权。
- 用真实尤克里里与独立参考调音器完成最终准确度验收。

## 本机环境

- Node.js：v25.9.0。
- npm：11.12.1。
- PWA 首版没有第三方 npm 依赖，不需要安装 Xcode、升级 macOS 或修改全局工具链。

## 尚未宣称通过

- 目标 iPhone 的 iOS 26 Safari/主屏幕 App 测试。
- 真实麦克风、真实尤克里里和独立调音器准确度对照。
- 语音备忘录 M4A、真实 MP3/WAV 解码。
- 公网 HTTPS、Wi-Fi/蜂窝可达性和飞行模式冷启动。
