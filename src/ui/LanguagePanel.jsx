import React, { useState } from 'react';
import { LANGS, TRACK_STATE } from '../domain/seed.js';
import {
  addLanguage,
  setSubtitles,
  submitTrack,
  activateTrack,
  discardTrack,
  recheckLanguage,
  confirmLanguage,
} from '../domain/store.js';
import { calibrate, subtitleEnd, fmt, fmtDiff, TOLERANCE_SEC } from '../rules/timing.js';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// 单个展项的语言 · 字幕 · 音轨校时面板
export default function LanguagePanel({ exhibit, run, notify }) {
  const langKeys = Object.keys(exhibit.languages);
  const [tab, setTab] = useState(langKeys[0]);
  const [newLang, setNewLang] = useState('');
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [replaceFor, setReplaceFor] = useState(null);
  const [reason, setReason] = useState('');

  const activeLang = exhibit.languages[tab] ? tab : langKeys[0];
  const L = exhibit.languages[activeLang];
  if (!L) return null;

  const end = subtitleEnd(L.subtitles);
  const pending = L.tracks.filter((t) => t.state === 'pending');
  const active = L.tracks.find((t) => t.state === 'active');
  const withdrawn = exhibit.status === 'withdrawn';
  const addable = Object.keys(LANGS).filter((l) => !exhibit.languages[l]);
  const sorted = [...L.tracks].sort((a, b) => b.version - a.version);

  const setCue = (id, patch) =>
    run(setSubtitles, exhibit.id, activeLang, L.subtitles.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addCue = () => {
    const last = L.subtitles[L.subtitles.length - 1];
    const start = last ? last.end : 0;
    run(setSubtitles, exhibit.id, activeLang, [
      ...L.subtitles,
      { id: `c${Date.now()}`, start, end: start + 5, text: '' },
    ]);
  };
  const delCue = (id) =>
    run(setSubtitles, exhibit.id, activeLang, L.subtitles.filter((s) => s.id !== id));

  const submit = () => {
    const d = num(duration);
    if (!d) return notify('请填写音轨时长（秒）');
    const r = run(submitTrack, exhibit.id, activeLang, { url: url.trim(), duration: d });
    if (r.conflicts.length) notify('音轨被退回或触发限制，详见冲突清单');
    else {
      notify('音轨已通过校时，进入待发布');
      setUrl('');
      setDuration('');
    }
  };

  const tryActivate = (t) => {
    // 已发布展项的音轨冻结：替换生效版需先填写原因
    if (exhibit.status === 'published' && active) {
      setReplaceFor(t.id);
      setReason('');
      return;
    }
    const r = run(activateTrack, exhibit.id, activeLang, t.id, '');
    notify(r.conflicts.length ? '激活被拦截，详见冲突清单' : `v${t.version} 已生效`);
  };

  const confirmReplace = () => {
    const t = L.tracks.find((x) => x.id === replaceFor);
    const r = run(activateTrack, exhibit.id, activeLang, replaceFor, reason);
    if (r.conflicts.length) return notify('替换被拦截，详见冲突清单');
    setReplaceFor(null);
    setReason('');
    notify(`已替换为 v${t?.version}，旧版已归档保留`);
  };

  const doRecheck = () => {
    const r = run(recheckLanguage, exhibit.id, activeLang);
    notify(r.conflicts.length ? `校时退回 ${r.conflicts.length} 处越界，详见冲突清单` : '全部待发布音轨通过校时');
  };

  return (
    <div className="lang-panel">
      <div className="preview-heading">
        <span>语言 · 字幕 · 音轨</span>
        <span className="hint">每语言仅一条待发布 · 同语种仅一版生效</span>
      </div>

      <div className="lang-tabs">
        {langKeys.map((l) => (
          <button key={l} className={'lang-tab' + (l === activeLang ? ' on' : '')} onClick={() => setTab(l)}>
            {LANGS[l] || l}
            {!exhibit.languages[l].confirmed && <span className="dot">●</span>}
          </button>
        ))}
        {addable.length > 0 && (
          <span className="lang-add">
            <select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
              <option value="">＋ 语言</option>
              {addable.map((l) => (
                <option key={l} value={l}>{LANGS[l]}</option>
              ))}
            </select>
            {newLang && (
              <button onClick={() => { run(addLanguage, exhibit.id, newLang); setNewLang(''); notify(`已添加语言 ${LANGS[newLang]}`); }}>
                添加
              </button>
            )}
          </span>
        )}
      </div>

      {!L.confirmed && (
        <div className="banner warn">
          <span>该语言在撤展后尚未重新确认，访客端暂不展示。</span>
          <button onClick={() => { run(confirmLanguage, exhibit.id, activeLang); notify('已确认该语言的音轨与字幕'); }}>
            确认音轨与字幕
          </button>
        </div>
      )}
      {withdrawn && (
        <div className="banner dark">
          <span>展项已撤展，全部语言音轨已下架。恢复展出后需逐语言确认。</span>
        </div>
      )}

      <div className="timing-bar">
        <span>字幕末段 <b>{fmt(end)}</b></span>
        <span>允许窗口 <b>{fmt(end)} – {fmt(end + TOLERANCE_SEC)}</b></span>
        <span>待发布 <b>{pending.length}</b> / 1</span>
        <span>生效版本 <b>{active ? `v${active.version}` : '—'}</b></span>
        <button className="recheck" onClick={doRecheck}>↻ 重新校时</button>
      </div>

      <div className="sub-editor">
        <div className="sub-head"><span>开始(s)</span><span>结束(s)</span><span>字幕文本</span><span></span></div>
        {L.subtitles.map((s) => (
          <div className="cue-row" key={s.id}>
            <input type="number" step="0.5" min="0" value={s.start} onChange={(e) => setCue(s.id, { start: num(e.target.value) })} />
            <input type="number" step="0.5" min="0" value={s.end} onChange={(e) => setCue(s.id, { end: num(e.target.value) })} />
            <input value={s.text} placeholder="字幕文本…" onChange={(e) => setCue(s.id, { text: e.target.value })} />
            <button className="del" onClick={() => delCue(s.id)}>✕</button>
          </div>
        ))}
        <button className="add-cue" onClick={addCue}>＋ 添加字幕行</button>
      </div>

      <div className="track-form">
        <input placeholder="音轨 URL，https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input type="number" step="0.5" min="0" placeholder="时长(秒)" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <button onClick={submit}>提交音轨</button>
      </div>

      <div className="track-list">
        {!L.tracks.length && <span className="hint">暂无音轨版本</span>}
        {sorted.map((t) => {
          const dev = calibrate(t.duration, L.subtitles).deviation;
          const ok = dev >= 0 && dev <= TOLERANCE_SEC;
          return (
            <div className={'track-card ' + t.state} key={t.id}>
              <div className="track-head">
                <span className="v">v{t.version}</span>
                <span className={'badge ' + t.state}>{TRACK_STATE[t.state]}</span>
                <span className="dur">{fmt(t.duration)}</span>
                <span className={'dev ' + (ok ? 'ok' : 'bad')}>偏差 {fmtDiff(dev)}</span>
                {t.state === 'active' && exhibit.status === 'published' && (
                  <span className="frozen-note">❄ 已冻结</span>
                )}
              </div>
              {t.url && <div className="track-url">{t.url}</div>}
              <div className="track-meta">
                {t.createdAt}
                {t.replacedBy ? ` · 已被 v${t.replacedBy} 替换` : ''}
              </div>
              {t.reason && <div className="track-meta">替换原因:{t.reason}</div>}
              {(t.violations || []).map((v, i) => (
                <div className="violation" key={i}>
                  越界位置 <b>{fmt(v.position)}</b> · {v.message}
                </div>
              ))}
              {replaceFor === t.id ? (
                <div className="replace-box">
                  <small>展项已发布，音轨冻结。当前生效版 v{active?.version} 将归档保留，请填写替换原因（必填）：</small>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：口播重录 / 字幕修订" />
                  <div className="row">
                    <button disabled={!reason.trim()} onClick={confirmReplace}>确认替换并生效</button>
                    <button onClick={() => setReplaceFor(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <div className="track-actions">
                  {t.state === 'pending' && <button onClick={() => tryActivate(t)}>设为生效</button>}
                  {(t.state === 'pending' || t.state === 'rejected') && (
                    <button className="dim" onClick={() => { run(discardTrack, exhibit.id, activeLang, t.id); notify(`v${t.version} 已移除`); }}>
                      废弃
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
