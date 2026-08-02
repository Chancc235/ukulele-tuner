# 调音核心

这里是与 SwiftUI、AVAudioEngine 和签名分发无关的 Swift Package，可直接嵌入 iOS 26 App：

- 输入：单声道 PCM 音频帧、采样率、时间戳。
- 中间结果：频率、置信度、音量等级。
- 输出：目标弦、音分偏差、偏低/准确/偏高状态。

已包含：

- 标准 High-G 四弦频率模型。
- Hz 与 cents 换算、自动目标匹配、手动锁弦判断。
- 首版 YIN 基频检测器。
- 纯正弦、偏移音高、强二次泛音和静音单元测试。

在项目根目录运行项目自带的零依赖算法校验：

```bash
scripts/test-core.sh
```

当前 Command Line Tools 不包含 XCTest/Swift Testing 运行库，所以脚本执行 `UkeTuneCoreChecks`；取得项目固定的 Xcode 26.3 后，同时运行 `core/Tests` 中的标准测试。标准音基准见 `spec/standard-high-g.json`；算法设计和验收方法分别见 `docs/02-technical-design.md` 与 `docs/05-testing.md`。后续 AVAudioEngine 提供 4096-sample 单声道帧，核心返回 `PitchEstimate` 和 `TuningResult`。
