// 校时规则层：纯函数，不依赖界面与存储。
// 一条音轨合法 ⇔ 字幕末段 ≤ 音轨时长 ≤ 字幕末段 + 容差。

export const TOLERANCE_SEC = 2;

export const RULE_TEXT = {
  COVERAGE: '录音时长必须覆盖字幕末段',
  TOLERANCE: `音轨与字幕末段偏差不得超过 ${TOLERANCE_SEC} 秒`,
  SINGLE_PENDING: '每种语言仅允许一条待发布音轨',
  SINGLE_ACTIVE: '同语种仅允许一版生效',
  FROZEN: '已发布音轨已冻结，替换须填写原因并保留旧版',
  RECONFIRM: '恢复展出后需重新确认音轨与字幕',
  RETIRE_ACTIVE: '生效或下架中的版本不可删除',
};

// 字幕末段时间（所有字幕行 end 的最大值）
export const subtitleEnd = (subtitles = []) =>
  subtitles.reduce((m, s) => Math.max(m, +s.end || 0), 0);

// 校时：返回 { ok, deviation, end, violations:[{rule, position, message}] }
export function calibrate(duration, subtitles) {
  const end = subtitleEnd(subtitles);
  const deviation = +(duration - end).toFixed(2);
  const violations = [];

  if (deviation < 0) {
    // 未覆盖：标出第一段超出录音末尾的字幕位置
    const missed = [...subtitles]
      .filter((s) => s.end > duration)
      .sort((a, b) => a.end - b.end)[0];
    violations.push({
      rule: 'COVERAGE',
      position: missed ? missed.start : end,
      message: `录音在 ${fmt(duration)} 结束，未覆盖字幕末段 ${fmt(end)}`,
    });
  }
  if (deviation > TOLERANCE_SEC) {
    // 超长：标出允许窗口关闭的位置（末段 + 容差）
    violations.push({
      rule: 'TOLERANCE',
      position: +(end + TOLERANCE_SEC).toFixed(2),
      message: `音轨超出字幕末段 ${deviation.toFixed(1)}s，允许窗口于 ${fmt(end + TOLERANCE_SEC)} 关闭`,
    });
  }
  return { ok: violations.length === 0, deviation, end, violations };
}

// mm:ss
export const fmt = (sec) => {
  const s = Math.max(0, Math.round(+sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// 带符号的时长差，如 +1.5s / -4.0s
export const fmtDiff = (d) => `${d > 0 ? '+' : ''}${Number(d || 0).toFixed(1)}s`;
