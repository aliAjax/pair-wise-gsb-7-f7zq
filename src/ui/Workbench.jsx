// 工作台界面：展项编辑 + 音轨/字幕校时闭环 + 冲突面板。规则全部来自 domain/rules。
import React,{useState} from 'react';
import {LANGS,TRACK_STATUS,langName} from '../domain/data.js';
import {fmtSec,fmtDiff,validateTiming,tracksFor,subOf,publishedOf,TOLERANCE} from '../domain/rules.js';

const STATUS_CLASS={pending:'st-pending',published:'st-published',rejected:'st-rejected',archived:'st-archived',offline:'st-offline'};

function IssueList({issues}){
  return <ul className="issues">{issues.map((it,i)=>{
    if(it.type==='cue-overrun')return <li key={i}>第 {it.index+1} 条字幕越界（{fmtSec(it.cue.start)}–{fmtSec(it.cue.end)}），超出录音 {it.over}s</li>;
    if(it.type==='uncovered-tail')return <li key={i}>录音未覆盖字幕末段，缺 {it.lack}s</li>;
    if(it.type==='tail-gap')return <li key={i}>尾部空白超出限制 {it.excess}s（容差 {TOLERANCE}s）</li>;
    return null;})}</ul>;
}

function ConflictPanel({conflicts}){
  if(!conflicts.length)return null;
  return <section className="conflict-panel">
    <div className="conflict-head"><span className="dot"></span><strong>{conflicts.length} 条冲突待处理</strong><small>展项 / 语言 / 时长差 / 触发限制</small></div>
    <table><tbody>{conflicts.map(c=>
      <tr key={c.id}><td>{c.title}</td><td>{c.lang==='*'?'全部语言':langName(c.lang)}</td>
        <td className="diff">{c.diff==null?'—':fmtDiff(c.diff)}</td><td className="rule">{c.rule}</td></tr>)}</tbody></table>
  </section>;
}

function CueEditor({state,exhibit,lang,act}){
  const sub=subOf(state,exhibit.id,lang);
  const cues=sub?.cues||[];
  const setCues=next=>act.updateSubtitles(exhibit.id,lang,next);
  const setCue=(i,k,v)=>setCues(cues.map((c,j)=>j===i?{...c,[k]:k==='text'?v:Number(v)||0}:c));
  const lastEnd=cues.reduce((m,c)=>Math.max(m,c.end),0);
  return <div className="cue-editor">
    <div className="sub-head"><h4>字幕轨 · {langName(lang)}</h4>
      {sub&&(sub.confirmed?<span className="badge ok">已确认</span>:<span className="badge warn">待确认</span>)}
      <span className="muted">末段 {fmtSec(lastEnd)}</span></div>
    {cues.map((c,i)=><div className="cue-row" key={i}>
      <input type="number" step="0.1" min="0" value={c.start} onChange={e=>setCue(i,'start',e.target.value)}/>
      <span className="arrow">→</span>
      <input type="number" step="0.1" min="0" value={c.end} onChange={e=>setCue(i,'end',e.target.value)}/>
      <input className="cue-text" value={c.text} placeholder="字幕文本" onChange={e=>setCue(i,'text',e.target.value)}/>
      <button className="del" title="删除" onClick={()=>setCues(cues.filter((_,j)=>j!==i))}>✕</button>
    </div>)}
    <div className="cue-actions">
      <button className="secondary sm" onClick={()=>setCues([...cues,{start:lastEnd,end:lastEnd+5,text:''}])}>＋ 添加字幕</button>
      {sub&&!sub.confirmed&&<button className="primary sm" onClick={()=>act.confirmSubtitles(exhibit.id,lang)}>确认字幕</button>}
    </div>
  </div>;
}

function TrackCard({t,state,act,reason,setReason}){
  const ex=state.exhibits.find(x=>x.id===t.exhibitId);
  const sub=subOf(state,t.exhibitId,t.lang);
  const v=sub?validateTiming(t.duration,sub.cues):null;
  const current=publishedOf(state,t.exhibitId,t.lang);
  const needReason=t.status==='pending'&&!!current;
  return <div className={'track-card '+STATUS_CLASS[t.status]}>
    <div className="track-top">
      <strong>v{t.version}</strong>
      <span className={'badge '+STATUS_CLASS[t.status]}>{TRACK_STATUS[t.status]}</span>
      <span className="muted">时长 {fmtSec(t.duration)}</span>
      {v&&t.status!=='archived'&&<span className={'muted '+(v.ok?'':'bad')}>时长差 {fmtDiff(v.deviation)}</span>}
      <span className="muted time">{t.createdAt}</span>
    </div>
    {t.issues?.length>0&&<IssueList issues={t.issues}/>}
    {t.reason&&<p className="reason">留痕：{t.reason}{t.replacedBy?`（由 v${state.tracks.find(x=>x.id===t.replacedBy)?.version??'?'} 替换）`:''}</p>}
    <div className="track-actions">
      {t.status==='pending'&&<>
        {needReason&&<input className="reason-input" placeholder="替换原因（已发布音轨冻结，替换须留痕）" value={reason} onChange={e=>setReason(e.target.value)}/>}
        <button className="primary sm" onClick={()=>act.publishTrack(t.id,reason)}>{current?'替换生效版':'发布生效'}</button>
      </>}
      {t.status==='offline'&&ex.status!=='已撤展'&&<button className="primary sm" onClick={()=>act.confirmTrack(t.id)}>重新确认并恢复</button>}
      {t.status==='offline'&&ex.status==='已撤展'&&<span className="muted">展项已撤展，待恢复后确认</span>}
    </div>
  </div>;
}

function AudioSection({state,exhibit,act}){
  const [lang,setLang]=useState('zh');
  const [duration,setDuration]=useState('');
  const [url,setUrl]=useState('');
  const [reason,setReason]=useState('');
  const tracks=tracksFor(state,exhibit.id,lang).slice().sort((a,b)=>b.version-a.version);
  const sub=subOf(state,exhibit.id,lang);
  const lastEnd=sub?sub.cues.reduce((m,c)=>Math.max(m,c.end),0):0;
  const down=exhibit.status==='已撤展';
  const submit=()=>{
    const d=Number(duration);
    if(!d||d<=0)return;
    act.addPending(exhibit.id,lang,d,url);
    setDuration('');setUrl('');
  };
  return <div className="audio-section">
    <div className="panel-title"><div><span className="eyebrow">AUDIO TOUR / SUBTITLES</span><h2>语音导览 · 字幕校时</h2></div></div>
    <div className="lang-tabs edit">{LANGS.map(l=><button key={l.code} className={l.code===lang?'on':''} onClick={()=>setLang(l.code)}>{l.name}</button>)}</div>
    {down&&<p className="banner">展项已撤展：全部语言音轨已下架，恢复展项后需逐条重新确认。</p>}
    <CueEditor state={state} exhibit={exhibit} lang={lang} act={act}/>
    <div className="track-form">
      <div className="track-form-row">
        <input type="number" step="0.1" min="0" placeholder={`录音时长（秒）· 字幕末段 ${fmtSec(lastEnd)}`} value={duration} onChange={e=>setDuration(e.target.value)}/>
        <input placeholder="音频 URL（可选）" value={url} onChange={e=>setUrl(e.target.value)}/>
        <button className="primary sm" disabled={down} onClick={submit}>提交校时</button>
      </div>
      <small className="hint">规则：录音须覆盖字幕末段，偏差 ≤ {TOLERANCE}s；同一语言仅一条待发布、一版生效；已发布冻结，替换须留痕。</small>
    </div>
    <div className="track-list">
      {tracks.length?tracks.map(t=><TrackCard key={t.id} t={t} state={state} act={act} reason={reason} setReason={setReason}/>)
        :<p className="muted">该语言暂无音轨</p>}
    </div>
  </div>;
}

export function Workbench({state,selected,setSelected,filter,setFilter,act,conflicts,onVisitor}){
  const [form,setForm]=useState({title:'',room:'',type:'装置',desc:''});
  const visible=filter==='全部'?state.exhibits:state.exhibits.filter(x=>x.status===filter);
  const current=state.exhibits.find(x=>x.id===selected)||state.exhibits[0];
  const add=()=>{if(!form.title.trim())return;const r=act.addExhibit(form);setSelected(r.added.id);setForm({title:'',room:'',type:'装置',desc:''});};
  const down=current?.status==='已撤展';
  return <div className="app">
    <aside>
      <div className="brand"><span className="mark">M</span><span>展览工作台</span></div>
      <div className="side-label">当前项目</div>
      <div className="project"><span className="project-dot"></span><div><strong>潮汐之后</strong><small>2026 秋季展</small></div><span>⌄</span></div>
      <nav><button className="active">▧ <span>展项内容</span><b>{state.exhibits.length}</b></button><button>⌁ <span>展厅动线</span></button><button>◉ <span>二维码</span></button></nav>
      <div className="side-foot"><button>⚙ 设置</button><small>已自动保存 · 刚刚</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar">
        <div><span className="eyebrow">EXHIBITION BUILDER</span><h1>展项内容</h1></div>
        <div className="top-actions">
          <button className="secondary" onClick={act.exportData}>↓ 导出 JSON</button>
          <button className="secondary" onClick={onVisitor}>◉ 访客预览</button>
          {current&&(down
            ?<button className="primary" onClick={()=>act.restoreExhibit(current.id)}>恢复展项</button>
            :<>
              <button className="secondary danger" onClick={()=>act.withdrawExhibit(current.id)}>撤展</button>
              <button className="primary" onClick={()=>act.toggleExhibitPublish(current.id)}>{current.status==='已发布'?'撤回发布':'发布更新'} <span>↗</span></button>
            </>)}
        </div>
      </header>
      <ConflictPanel conflicts={conflicts}/>
      <div className="content">
        <section className="list-pane">
          <div className="list-head"><div><h2>全部展项</h2><span>{state.exhibits.length} 个展项</span></div>
            <button className="add-btn" onClick={()=>document.querySelector('.new-form')?.scrollIntoView({behavior:'smooth'})}>＋ 添加展项</button></div>
          <div className="filters">{['全部','已发布','草稿','已撤展'].map(x=><button className={filter===x?'selected':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div>
          <div className="exhibit-list">{visible.map(x=>
            <button className={'exhibit-row '+(selected===x.id?'chosen':'')} key={x.id} onClick={()=>setSelected(x.id)}>
              <span className="thumb" style={{background:x.color}}>{String(x.id).padStart(2,'0')}</span>
              <span className="row-copy"><strong>{x.title}</strong><small>{x.room} · {x.type}</small></span>
              <span className={'status '+(x.status==='已发布'?'live':x.status==='已撤展'?'down':'draft')}>{x.status}</span>
              <span className="chev">›</span>
            </button>)}</div>
        </section>
        <section className="form-panel">
          <div className="panel-title"><div><span className="eyebrow">EDIT EXHIBIT</span><h2>编辑展项</h2></div>
            <span className={'status '+(current?.status==='已发布'?'live':down?'down':'draft')}>{current?.status}</span></div>
          {current&&<div className="editor">
            <label>展项标题<input value={current.title} onChange={e=>act.updateExhibit(current.id,'title',e.target.value)}/></label>
            <div className="two">
              <label>所在展厅<input value={current.room} onChange={e=>act.updateExhibit(current.id,'room',e.target.value)}/></label>
              <label>内容类型<select value={current.type} onChange={e=>act.updateExhibit(current.id,'type',e.target.value)}><option>装置</option><option>档案</option><option>互动</option><option>绘画</option></select></label>
            </div>
            <label>展项介绍<textarea rows="4" value={current.desc} onChange={e=>act.updateExhibit(current.id,'desc',e.target.value)}/></label>
            <div className="preview-block"><div className="preview-heading"><span>二维码预览</span><button onClick={()=>act.notify('二维码链接已复制')}>复制链接</button></div>
              <div className="qr-preview"><div className="qr-box big">▦</div><div><strong>展项-{String(current.id).padStart(3,'0')}</strong><small>/guide/{current.id}</small></div></div></div>
          </div>}
          {current&&<AudioSection state={state} exhibit={current} act={act}/>}
          <div className="new-form"><div className="panel-title"><div><span className="eyebrow">NEW ENTRY</span><h2>快速添加展项</h2></div></div>
            <div className="two"><input placeholder="展项标题" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="展厅编号" value={form.room} onChange={e=>setForm({...form,room:e.target.value})}/></div>
            <textarea placeholder="一句话介绍…" rows="2" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/>
            <button className="primary full" onClick={add}>保存新展项</button>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
