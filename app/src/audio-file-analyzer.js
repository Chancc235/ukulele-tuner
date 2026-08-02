import { STANDARD_HIGH_G } from "./tuning-config.js";
import { makeTuningResult, median, tuningDirection, frequencyAtCents } from "./tuning-math.js";

export const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 30;
export const RECOMMENDED_AUDIO_DURATION_SECONDS = Object.freeze({ minimum: 2, maximum: 10 });

const SUPPORTED_EXTENSIONS = new Set(["m4a", "mp3", "wav"]);
const WINDOW_SIZE = 4096;
const MAX_ANALYSIS_WINDOWS = 240;
const MINIMUM_CONFIDENCE = 0.75;
const MINIMUM_ACCEPTED_WINDOWS = 3;

export class AudioFileAnalysisError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "AudioFileAnalysisError";
    this.code = code;
  }
}

export function validateAudioFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isFinite(file.size)) {
    throw new AudioFileAnalysisError("invalid-file", "没有读取到有效的录音文件。");
  }
  if (file.size <= 0) {
    throw new AudioFileAnalysisError("empty-file", "录音文件是空的。");
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    throw new AudioFileAnalysisError("file-too-large", "录音不能超过 25 MB。");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasSupportedType = file.type?.startsWith("audio/") || SUPPORTED_EXTENSIONS.has(extension);
  if (!hasSupportedType) {
    throw new AudioFileAnalysisError("unsupported-format", "请选择 M4A、MP3 或 WAV 录音。");
  }
}

export function aggregateTuningResults(
  results,
  {
    minimumAcceptedWindows = MINIMUM_ACCEPTED_WINDOWS,
    configuration = STANDARD_HIGH_G
  } = {}
) {
  if (!Array.isArray(results) || results.length < minimumAcceptedWindows) {
    return null;
  }

  const groups = new Map();
  for (const result of results) {
    if (!result?.target?.note
        || !Number.isFinite(result.cents)
        || !Number.isFinite(result.confidence)) {
      continue;
    }
    const group = groups.get(result.target.note) ?? [];
    group.push(result);
    groups.set(result.target.note, group);
  }

  const candidates = [...groups.values()]
    .filter((group) => group.length >= minimumAcceptedWindows)
    .map((group) => ({
      group,
      count: group.length,
      confidenceSum: group.reduce((sum, result) => sum + result.confidence, 0)
    }))
    .sort((left, right) => right.count - left.count
      || right.confidenceSum - left.confidenceSum);

  const winningGroup = candidates[0]?.group;
  if (!winningGroup) {
    return null;
  }

  const target = winningGroup[0].target;
  const cents = median(winningGroup.map((result) => result.cents));
  const confidence = median(winningGroup.map((result) => result.confidence));
  const rms = median(winningGroup.map((result) => result.rms));
  if (cents === null || confidence === null || rms === null) {
    return null;
  }

  return Object.freeze({
    target,
    detectedFrequencyHz: frequencyAtCents(target.frequencyHz, cents),
    cents,
    direction: tuningDirection(cents, configuration.inTuneToleranceCents),
    confidence,
    rms,
    acceptedWindows: winningGroup.length
  });
}

export async function analyzeAudioFile(
  file,
  {
    detector,
    lockedTargetNote = null,
    configuration = STANDARD_HIGH_G,
    onProgress = () => {},
    signal,
    environment = globalThis
  }
) {
  validateAudioFile(file);
  if (!detector || typeof detector.detect !== "function") {
    throw new TypeError("A pitch detector is required");
  }

  const AudioContextConstructor = environment.AudioContext ?? environment.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new AudioFileAnalysisError("audio-unavailable", "此浏览器不能解码录音。");
  }

  const context = new AudioContextConstructor();
  try {
    throwIfAborted(signal);
    const encodedAudio = await file.arrayBuffer();
    throwIfAborted(signal);

    let audioBuffer;
    try {
      audioBuffer = await context.decodeAudioData(encodedAudio);
    } catch (error) {
      throw new AudioFileAnalysisError(
        "decode-failed",
        "无法解码录音。请使用语音备忘录默认 M4A、MP3 或 WAV。",
        { cause: error }
      );
    }

    if (!Number.isFinite(audioBuffer.duration) || audioBuffer.duration <= 0) {
      throw new AudioFileAnalysisError("empty-audio", "录音中没有可分析的音频。");
    }
    if (audioBuffer.duration > MAX_AUDIO_DURATION_SECONDS) {
      throw new AudioFileAnalysisError("audio-too-long", "录音不能超过 30 秒，建议只录 2–10 秒。");
    }

    const frameCount = audioBuffer.length;
    const sampleRateHz = audioBuffer.sampleRate;
    const availableStarts = Math.max(1, frameCount - WINDOW_SIZE + 1);
    const hopSize = Math.max(
      Math.floor(WINDOW_SIZE / 2),
      Math.ceil(availableStarts / MAX_ANALYSIS_WINDOWS)
    );
    const totalWindows = Math.max(1, Math.ceil(availableStarts / hopSize));
    const samples = new Float32Array(WINDOW_SIZE);
    const acceptedResults = [];
    let analyzedWindows = 0;

    for (let start = 0; start < availableStarts; start += hopSize) {
      throwIfAborted(signal);
      samples.fill(0);
      const copyCount = Math.min(WINDOW_SIZE, frameCount - start);

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
        const channelData = audioBuffer.getChannelData(channel);
        const scale = 1 / audioBuffer.numberOfChannels;
        for (let index = 0; index < copyCount; index += 1) {
          samples[index] += channelData[start + index] * scale;
        }
      }

      const estimate = detector.detect(samples, sampleRateHz);
      if (estimate && estimate.confidence >= MINIMUM_CONFIDENCE) {
        const result = makeTuningResult(estimate, { lockedTargetNote, configuration });
        if (result) {
          acceptedResults.push(result);
        }
      }

      analyzedWindows += 1;
      onProgress(Math.min(1, analyzedWindows / totalWindows));
      if (analyzedWindows % 12 === 0) {
        await yieldToMainThread(environment);
      }
    }

    const result = aggregateTuningResults(acceptedResults, { configuration });
    if (!result) {
      throw new AudioFileAnalysisError(
        "no-pitch",
        "没有找到稳定音高。请一次只拨一根弦，靠近手机重新录制 2–10 秒。"
      );
    }

    onProgress(1);
    return Object.freeze({
      result,
      durationSeconds: audioBuffer.duration,
      analyzedWindows,
      acceptedWindows: acceptedResults.length
    });
  } finally {
    if (context.state !== "closed") {
      await context.close().catch(() => {});
    }
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new AudioFileAnalysisError("aborted", "录音分析已取消。");
  }
}

function yieldToMainThread(environment) {
  return new Promise((resolve) => {
    environment.setTimeout(resolve, 0);
  });
}
