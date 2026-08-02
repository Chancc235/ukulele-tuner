# PWA 技术设计

## 1. 技术栈

- HTML5、现代 CSS、原生 ES modules。
- Web Audio API：`AudioContext`、`AnalyserNode`、`decodeAudioData`。
- Media Capture：`navigator.mediaDevices.getUserMedia`。
- PWA：Web App Manifest、Service Worker、Cache Storage。
- 测试：Node 内置 `node:test` 和 `assert`。
- 托管：GitHub Pages 静态 HTTPS；无后端。

首版不采用 React/Vue、音频 npm 包、远程字体、CDN 脚本或分析 SDK，降低缓存、隐私和供应链复杂度。

## 2. 模块结构

```text
app/
  index.html
  styles.css
  app.js
  manifest.webmanifest
  sw.js
  icons/
  src/
    tuning-config.js
    tuning-math.js
    yin-pitch-detector.js
    pitch-stabilizer.js
    microphone-source.js
    audio-file-analyzer.js
    tuner-controller.js
```

单向数据流程：

```text
麦克风帧 / 解码录音帧
  -> YIN PitchEstimate
  -> 自动或手动目标弦匹配
  -> 置信度过滤与时序平滑/聚合
  -> cents / 状态
  -> DOM 渲染
```

UI 不直接实现 DSP；麦克风和文件分析共享完全相同的检测器与调音数学。

## 3. 调音核心

### 标准目标

配置只包含 High-G：G4/C4/E4/A4、A4 = 440 Hz、准确阈值 ±5 cents。JSON 规格和 JavaScript 配置由自动测试校对。

### cents

```text
cents = 1200 * log2(detectedHz / targetHz)
```

自动模式在对数频率空间寻找最近目标；距所有目标超过 250 cents 时返回不确定。手动模式固定目标弦。

### YIN

- 输入：单声道 `Float32Array`、实际 sample rate。
- 窗口：4096 samples。
- 范围：180–500 Hz。
- 预处理：去直流、RMS gate。
- YIN threshold 初值：0.15。
- 周期估计：cumulative mean normalized difference + 抛物线插值。
- 输出：frequency、confidence、rms；无效时返回 `null`。

### 稳定器

- 最近 5 个可信 cents 取中位数。
- 轻量 EMA 平滑。
- 目标弦切换需连续多帧确认。
- 进入“准了”使用 ±5 cents，退出使用 ±7 cents。
- 信号丢失 500–800 ms 后清空。

## 4. 实时麦克风

1. 用户点击按钮，确保 `AudioContext.resume()` 发生在用户手势内。
2. 请求单声道音频，并把 `echoCancellation/noiseSuppression/autoGainControl` 设为首选关闭；浏览器可忽略这些 hint。
3. `MediaStreamAudioSourceNode` 连接 `AnalyserNode`，不连接扬声器，避免反馈。
4. `requestAnimationFrame` 驱动，但用时间戳把 DSP 限制到约 20 Hz。
5. 每次从 AnalyserNode 读取 4096 samples，送入共享 pipeline。
6. 停止时取消 RAF、disconnect nodes、停止全部 tracks、关闭 AudioContext。

监听 `visibilitychange/pagehide`，页面不可见时停止。任何异常都转成用户可读状态，并显示录音入口。

## 5. 本地录音分析

1. `<input type="file" accept="audio/*,.m4a,.mp3,.wav">` 获取用户主动选择的 `File`。
2. 在读取前检查 25 MB 上限。
3. `file.arrayBuffer()` 后由 `decodeAudioData` 解码。
4. 单声道直接分析，多声道逐样本平均下混。
5. 超过 30 秒直接拒绝；使用 4096 window，基础 hop 为 2048，并把总窗口限制在 240 个以内。
6. 过滤低 RMS、低 confidence 和范围外窗口。
7. 按目标弦分组；首版选择可信窗口最多的目标，取 frequency/cents 中位数。
8. 每处理若干窗口主动 yield 给事件循环，避免长任务锁死 UI。
9. 完成后丢弃 ArrayBuffer/AudioBuffer/PCM 引用。

文件不会经过 `fetch`、XHR、表单提交或 Service Worker cache。

## 6. PWA 与缓存

- manifest 使用相对 `start_url` 和 `scope`，兼容 GitHub Pages 子路径。
- `display: standalone`、`orientation: portrait-primary`。
- 提供 180、192、512 PNG 图标和 maskable 版本。
- Service Worker 只缓存版本化的应用壳文件。
- 导航采用 network-first + cache fallback；静态资源使用 stale-while-revalidate。
- 激活新 worker 时清理旧 cache，并在页面显示可用更新。
- 不缓存跨域请求；当前产品没有跨域运行时资源。

## 7. 安全与隐私

- 页面设置严格 Content Security Policy，只允许 self 的脚本、样式和媒体 blob。
- 不使用 `eval`、内联远程脚本或第三方 iframe。
- 不持久化麦克风或文件样本。
- 不把文件名写入日志或 localStorage。
- localStorage 只允许保存非敏感 UI 偏好，如上次手动目标。
- 部署必须强制 HTTPS。

## 8. 可访问性

- 状态同时通过文字、颜色、位置表达。
- 主读数使用 `aria-live="polite"`，避免每帧过度播报。
- 四弦按钮有明确 `aria-pressed`。
- 支持动态字体、safe-area、深色外观和 reduced motion。
- 触控目标至少约 44×44 CSS px。

## 9. 错误恢复

| 错误 | 恢复 |
| --- | --- |
| 浏览器不支持 mediaDevices | 直接显示录音入口 |
| NotAllowedError | 权限说明 + 录音入口 |
| NotFoundError | 提示没有可用麦克风 + 录音入口 |
| AudioContext 启动失败 | 停止清理、允许重试、录音入口 |
| 录音无法解码 | 建议导出默认 M4A/WAV/MP3 |
| 没有可信音高 | 建议单弦、靠近、缩短录音、手动选弦 |
| Service Worker 注册失败 | 保持在线可用并显示离线不可用提示 |
