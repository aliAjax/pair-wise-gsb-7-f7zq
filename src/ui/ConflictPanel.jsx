import React from 'react';
import { fmt, fmtDiff } from '../rules/timing.js';

// 冲突清单：展项 / 语言 / 时长差 / 触发限制（含越界位置）
export default function ConflictPanel({ conflicts, onClear }) {
  if (!conflicts.length) return null;
  return (
    <div className="conflict-panel">
      <div className="conflict-head">
        <strong>冲突清单 · {conflicts.length}</strong>
        <button onClick={onClear}>清空</button>
      </div>
      <div className="conflict-list">
        {conflicts.map((c) => (
          <div className="conflict-row" key={c.id}>
            <div className="who">
              <strong>{c.exhibitTitle}</strong>
              <span className="conf-lang">{c.langLabel}</span>
            </div>
            <div className="conf-meta">
              <span>时长差 <b>{c.durationDiff == null ? '—' : fmtDiff(c.durationDiff)}</b></span>
              {c.position != null && <span>越界位置 <b>{fmt(c.position)}</b></span>}
            </div>
            <p>{c.ruleText}{c.message ? `：${c.message}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
