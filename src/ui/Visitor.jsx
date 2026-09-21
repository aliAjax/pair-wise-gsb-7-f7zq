import React, { useEffect, useState } from 'react';
import { LANGS } from '../domain/seed.js';
import { activeTrack, visibleLanguages } from '../domain/store.js';
import { calibrate, subtitleEnd, fmt, fmtDiff } from '../rules/timing.js';

// 访客界面：只读视图 —— 已发布展项 + 已确认语言 + 生效音轨
export default function Visitor({ exhibits, current, setSelected, view, setView }) {
  if (view === 'detail' && current) {
    return <Detail exhibit={current} onBack={() => setView('visitor')} />;
  }
  const published = exhibits.filter((x) => x.status === 'published');
  return (
    <div className="visitor">
      <header>
        <div className="brand"><span className="mark">M</span><span>潮汐美术馆</span></div>
        <button className="ghost" onClick={() => setView('edit')}>返回编辑</button>
      </header>
      <main className="visitor-main">
        <span className="eyebrow">VISITOR GUIDE / 2026</span>
        <h1>沿着作品，<em>走进</em>另一种时间。</h1>
        <p className="lead">当你靠近一件作品，它的故事就开始流动。选择一个展项开始探索。</p>
        <div className="visitor-grid">
          {published.map((x) => {
            const langs = visibleLanguages(x);
            return (
              <article className="visitor-card" key={x.id} onClick={() => { setSelected(x.id); setView('detail'); }}>
                <div className="art" style={{ background: x.color }}>
                  <span>{String(x.id).padStart(2, '0')}</span><i>↗</i>
                </div>
                <div className="card-meta">
                  <small>{x.room}</small>
                  <h3>{x.title}</h3>
                  <p>{x.desc}</p>
                  <div className="lang-badges">
                    {langs.map((l) => <span key={l}>◉ {LANGS[l] || l}</span>)}
                    {!langs.length && <span>导览准备中</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Detail({ exhibit, onBack }) {
  const langs = visibleLanguages(exhibit);
  const [lang, setLang] = useState(langs[0]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  const safeLang = langs.includes(lang) ? lang : langs[0];
  const L = safeLang ? exhibit.languages[safeLang] : null;
  const track = L ? activeTrack(L) : null;

  useEffect(() => { setT(0); setPlaying(false); }, [exhibit.id, safeLang]);
  useEffect(() => {
    if (!playing || !track) return;
    const iv = setInterval(() => {
      setT((x) => {
        const n = +(x + 0.1).toFixed(2);
        if (n >= track.duration) { setPlaying(false); return track.duration; }
        return n;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [playing, track && track.id]);

  const end = L ? subtitleEnd(L.subtitles) : 0;
  const dev = track ? calibrate(track.duration, L.subtitles).deviation : 0;
  const cue = L ? L.subtitles.find((s) => t >= s.start && t < s.end) : null;
  const toggle = () => {
    if (track && t >= track.duration) setT(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="visitor">
      <header>
        <div className="brand"><span className="mark">M</span><span>潮汐美术馆 · 导览</span></div>
        <button className="ghost" onClick={onBack}>← 全部展项</button>
      </header>
      <main className="detail">
        <div className="detail-art" style={{ background: exhibit.color }}>
          <span>{String(exhibit.id).padStart(2, '0')}</span>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{exhibit.room} / {exhibit.type}</span>
          <h1>{exhibit.title}</h1>
          <p>{exhibit.desc}</p>

          {langs.length > 1 && (
            <div className="lang-switch">
              {langs.map((l) => (
                <button key={l} className={l === safeLang ? 'on' : ''} onClick={() => setLang(l)}>
                  {LANGS[l] || l}
                </button>
              ))}
            </div>
          )}

          {track ? (
            <div className="player">
              <button className="audio" onClick={toggle}>
                {playing ? '❚❚ 暂停导览' : t > 0 && t < track.duration ? '▶ 继续播放' : '▶ 播放语音导览'}
              </button>
              <div className="progress"><i style={{ width: `${Math.min(100, (t / track.duration) * 100)}%` }} /></div>
              <div className="player-meta">
                <span>{fmt(t)} / {fmt(track.duration)}</span>
                <span>v{track.version} · 字幕末段 {fmt(end)} · 偏差 {fmtDiff(dev)}</span>
              </div>
            </div>
          ) : (
            <p className="no-audio">该展项的语音导览暂未上线。</p>
          )}

          {cue && <p className="cue-live">{cue.text}</p>}

          {L && track && L.subtitles.length > 0 && (
            <div className="sub-list">
              {L.subtitles.map((s) => (
                <div className={'sub-line' + (cue && cue.id === s.id ? ' current' : '')} key={s.id}>
                  <span>{fmt(s.start)}</span>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="qr">
            <div className="qr-box">▦</div>
            <div><strong>分享这个展项</strong><small>扫描二维码，在手机上继续阅读</small></div>
          </div>
        </div>
      </main>
    </div>
  );
}
