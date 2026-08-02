# PWA 发布检查表

## 版本与范围

- [x] `CHANGELOG.md` 和页面版本已更新。
- [x] Service Worker cache version 为首发 `uketune-v1`。
- [x] 只包含 High-G G/C/E/A；没有未验收范围。
- [x] 四个弦钮按钮和自动模式均存在。

## 自动质量门

- [x] `npm test` 全部通过。
- [x] `npm run check` 全部通过。
- [x] 最新测试报告已写入 `docs/test-reports/`。
- [x] 最新 code review 已写入 `docs/reviews/`。
- [x] P0/P1 review 问题全部关闭并复测。

## 调音与输入

- [x] 四目标合成音误差 ≤±3 cents。
- [x] 强二次泛音、静音和低音量测试通过。
- [ ] 实时开始/停止/后台清理通过。
- [ ] 麦克风拒绝后显示录音入口。
- [ ] M4A/WAV/MP3 本地分析通过。
- [ ] 文件大小、时长和解码错误处理通过。
- [ ] Network 面板确认无音频上传。

## PWA

- [x] manifest 名称、scope、start_url、display、图标正确。
- [x] Apple Touch、192、512 和 maskable 图标存在。
- [x] Service Worker 只缓存静态应用壳。
- [ ] 新版本可更新，旧 cache 可清理。
- [x] CSP 不允许第三方运行时脚本。
- [ ] iOS 26 添加到主屏幕和飞行模式启动通过。

## 部署

- [x] GitHub Actions 使用固定主版本的官方 actions。
- [x] 测试 job 通过后 deploy job 才运行。
- [x] Pages 使用 HTTPS。
- [ ] Wi-Fi 和蜂窝网络可打开。
- [x] 发布 URL、commit、版本和回滚点已记录。

## 发布记录

```text
版本：0.1.0 public preview
Git commit/tag：fa01bce（首次成功部署，无 tag）
Service Worker cache：uketune-v1
部署平台：GitHub Pages
发布 URL：https://chancc235.github.io/ukulele-tuner/
自动测试报告：docs/test-reports/2026-08-03-github-pages-success.md
Code review：docs/reviews/CR-001-pwa-local-mvp.md
iPhone / iOS：Pending target iOS 26 device
离线验证：Pending target device
已知问题：尚未完成真实 M4A/MP3、真琴和 iOS 26 音频生命周期验收
回滚点：399a0a1（本地 MVP 基线）
```
