// 访客界面层：只读，从同一份领域状态派生，保证刷新后与工作台一致。
import React,{useMemo,useState} from 'react';
import {LANGS,langName} from '../domain/data.js';
import {fmtSec,publishedOf,subOf} from '../domain/rules.js';

// 访客可见：展项已发布 + 该语言有生效音轨
function visibleLangs(state,exhibitId){
  return LANGS.map(l=>l.code).filter(code=>publishedOf(state,exhibitId,code));
}

export function VisitorHome({state,onOpen,onBack}){
  const live=state.exhibits.filter(x=>x.status==='已发布');
  return <div className="visitor"><header><div className="brand"><span className="mark">M</span><span>潮汐美术馆</span></div><button className="ghost" onClick={onBack}>返回编辑</button></header>
    <main className="visitor-main"><span className="eyebrow">VISITOR GUIDE / 2026</span>
      <h1>沿着作品，<em>走进</em>另一种时间。</h1>
      <p className="lead">当你靠近一件作品，它的故事就开始流动。选择一个展项开始探索。</p>
      <div className="visitor-grid">{live.map(x=>{
        const langs=visibleLangs(state,x.id);
        return <article className="visitor-card" key={x.id} onClick={()=>onOpen(x.id)}>
          <div className="art" style={{background:x.color}}><span>{String(x.id).padStart(2,'0')}</span><i>↗</i></div>
          <div className="card-meta"><small>{x.room}</small><h3>{x.title}</h3><p>{x.desc}</p>
            <div className="lang-chips">{langs.map(c=><span key={c} className="chip">◉ {langName(c)}</span>)}{!langs.length&&<span className="chip off">导览准备中</span>}</div>
          </div>
        </article>;})}
      </div>
    </main>
  </div>;
}

export function VisitorDetail({state,exhibit,onBack,onPlay}){
  const langs=useMemo(()=>visibleLangs(state,exhibit.id),[state,exhibit.id]);
  const [lang,setLang]=useState(langs[0]||'zh');
  const track=publishedOf(state,exhibit.id,lang);
  const sub=subOf(state,exhibit.id,lang);
  const cues=sub?.confirmed?[...sub.cues].sort((a,b)=>a.start-b.start):[];
  return <div className="visitor"><header><div className="brand"><span className="mark">M</span><span>潮汐美术馆 · 导览</span></div><button className="ghost" onClick={onBack}>← 全部展项</button></header>
    <main className="detail">
      <div className="detail-art" style={{background:exhibit.color}}><span>{String(exhibit.id).padStart(2,'0')}</span></div>
      <div className="detail-copy">
        <span className="eyebrow">{exhibit.room} / {exhibit.type}</span>
        <h1>{exhibit.title}</h1>
        <p>{exhibit.desc}</p>
        {langs.length>0&&<div className="lang-tabs">{langs.map(c=>
          <button key={c} className={c===lang?'on':''} onClick={()=>setLang(c)}>{langName(c)}</button>)}</div>}
        {track
          ?<button className="audio" onClick={()=>onPlay(`正在播放 ${langName(lang)} 导览 · v${track.version}（${fmtSec(track.duration)}）`)}>▶ 播放语音导览 · {fmtSec(track.duration)}</button>
          :<p className="muted">该语言导览暂未上线</p>}
        {track&&(cues.length
          ?<div className="transcript">{cues.map((c,i)=>
              <div className="cue-line" key={i}><span>{fmtSec(c.start)}</span><p>{c.text}</p></div>)}</div>
          :<p className="muted">字幕确认中，稍后再来</p>)}
        <div className="qr"><div className="qr-box">▦</div><div><strong>分享这个展项</strong><small>扫描二维码，在手机上继续阅读</small></div></div>
      </div>
    </main>
  </div>;
}
