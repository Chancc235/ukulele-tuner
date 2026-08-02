# CR-001：PWA 本地 MVP

- 日期：2026-08-02
- 版本：0.1.0
- 状态：Completed locally
- 范围：UI、YIN/调音数学、实时麦克风、本地录音、PWA 缓存、隐私、开发服务器和文档
- 结论：没有遗留的代码级 P0/P1；发布仍受 iOS 26 真机验收门约束

## 审查发现

| ID | 级别 | 发现 | 处理与复测 |
| --- | --- | --- | --- |
| CR-001-01 | P1 | 已有结果后若持续检测到范围外音高，控制器不会清除旧读数。 | 对无法匹配的估计同样执行 700 ms 超时；增加控制器回归测试，通过。 |
| CR-001-02 | P1 | 麦克风仍在等待权限时切后台，完成后的异步回调可能把 UI 错误恢复成“运行中”。 | 增加 `isStarting`、generation 取消和启动后状态确认；后台时同时停止 starting/running 状态。 |
| CR-001-03 | P1 | 单个 Web Audio `disconnect()` 或 track `stop()` 异常可能中断后续资源清理。 | 每项资源独立容错，先清内部引用再停止所有 track 和关闭 context；生命周期测试通过。 |
| CR-001-04 | P2 | 录音分窗会在结尾多处理部分填零窗口，进度计数不准确。 | 循环边界改为 `availableStarts`；集成测试确认 5 个合法窗口。 |
| CR-001-05 | P2 | `too-high` 的 CSS 选择器漏写 `::before`，会把背景声明作用在卡片本体。 | 修正伪元素选择器；静态检查通过。 |
| CR-001-06 | P2 | 隐藏的文件 input 与可见 label 是兄弟节点，键盘焦点样式不能通过 `:focus-within` 生效。 | input 移入 label，保持 iPhone 文件选择行为并恢复焦点关系。 |
| CR-001-07 | P2 | 技术文档把实际 network-first 导航写成 cache-first，并把多声道平均写成只读第一声道。 | 文档已与实现同步。 |
| CR-001-08 | P2 | 本地服务器遇到非法百分号 URL 时，`decodeURIComponent` 可在错误处理外抛出。 | 路径解析加入 try/catch，非法 URL 返回 400。 |
| CR-001-09 | P2 | 隐私承诺只有人工约束，后续改动可能意外加入音频上传 API。 | 静态质量门禁止应用运行时代码使用常见网络发送 API；Service Worker 静态资源获取除外。 |

## 重点审查结论

### 正确性

- High-G 四弦配置与共享 JSON 一致。
- cents 方向和 ±5 cents 准音边界正确。
- 手动模式固定目标弦，自动模式只在四个目标中匹配。
- 用户文案只写“升高/降低”，未假定旋钮顺逆时针方向。

### 生命周期与错误恢复

- 停止和后台路径取消 RAF、断开节点、停止全部 track、关闭 AudioContext。
- 麦克风权限失败不会禁用录音文件入口。
- 文件分析支持取消，finally 关闭解码 AudioContext。
- 旧信号和不确定信号都不会无限保留旧结果。

### 隐私与供应链

- 无后端、统计、广告、第三方脚本、远程字体或运行时 npm 依赖。
- 音频 File、ArrayBuffer、AudioBuffer 和 PCM 不进入 Cache Storage。
- CSP 限制为 self，静态检查禁止运行时上传 API。
- 图标由项目内无依赖脚本生成。

### PWA 更新

- 相对 scope/start URL 可用于 GitHub Pages 子路径。
- 导航 network-first/offline fallback，静态资源 stale-while-revalidate。
- 新 worker 等待用户确认后激活，激活时清理旧版本 cache。

## 验证证据

- `npm test`：22 passed，0 failed。
- `npm run check`：passed。
- GitHub Pages workflow YAML：本机解析成功。
- 本地 HTTP：页面、manifest、worker、模块和图标均返回 200 与正确 MIME。
- 详细结果：[2026-08-02-pwa-local-mvp.md](../test-reports/2026-08-02-pwa-local-mvp.md)。

## 发布前未关闭的设备风险

这些不是已知代码缺陷，但只能用目标 iPhone 关闭：

- iOS 26 WebKit 的音频会话/麦克风重启行为。
- 真实语音备忘录 M4A 解码和文件选择。
- 真琴噪声、琴体泛音、手机距离下的准确度与稳定速度。
- 安装后离线冷启动及线上 Service Worker 升级。
