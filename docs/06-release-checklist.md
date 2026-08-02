# PWA 发布检查表

## 版本与范围

- [ ] `CHANGELOG.md` 和页面版本已更新。
- [ ] Service Worker cache version 已递增。
- [ ] 只包含 High-G G/C/E/A；没有未验收范围。
- [ ] 四个弦钮按钮和自动模式均存在。

## 自动质量门

- [ ] `npm test` 全部通过。
- [ ] `npm run check` 全部通过。
- [ ] 最新测试报告已写入 `docs/test-reports/`。
- [ ] 最新 code review 已写入 `docs/reviews/`。
- [ ] P0/P1 review 问题全部关闭并复测。

## 调音与输入

- [ ] 四目标合成音误差 ≤±3 cents。
- [ ] 强二次泛音、静音和低音量测试通过。
- [ ] 实时开始/停止/后台清理通过。
- [ ] 麦克风拒绝后显示录音入口。
- [ ] M4A/WAV/MP3 本地分析通过。
- [ ] 文件大小、时长和解码错误处理通过。
- [ ] Network 面板确认无音频上传。

## PWA

- [ ] manifest 名称、scope、start_url、display、图标正确。
- [ ] Apple Touch、192、512 和 maskable 图标存在。
- [ ] Service Worker 只缓存静态应用壳。
- [ ] 新版本可更新，旧 cache 可清理。
- [ ] CSP 不允许第三方运行时脚本。
- [ ] iOS 26 添加到主屏幕和飞行模式启动通过。

## 部署

- [ ] GitHub Actions 使用固定主版本的官方 actions。
- [ ] 测试 job 通过后 deploy job 才运行。
- [ ] Pages 强制 HTTPS。
- [ ] Wi-Fi 和蜂窝网络可打开。
- [ ] 发布 URL、commit、版本和回滚点已记录。

## 发布记录

```text
版本：
Git commit/tag：
Service Worker cache：
部署平台：
发布 URL：
自动测试报告：
Code review：
iPhone / iOS：
离线验证：通过 / 失败
已知问题：
回滚点：
```

