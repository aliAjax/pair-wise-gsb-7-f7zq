// 校时规则层：纯函数，不依赖界面与存储。
// 每条规则有编号，冲突时输出 {展项, 语言, 时长差, 触发限制}。

export const TOLERANCE=2; // 录音与字幕末段的允许偏差（秒）

export const RULES={
  R1:'R1 · 同一语言仅保留一条待发布音轨',
  R2:'R2 · 录音须覆盖字幕末段（偏差 ≤ 2s）',
  R3:'R3 · 同一语言仅允许一版生效',
  R4:'R4 · 已发布音轨冻结，替换须填写原因并保留旧版',
  R5:'R5 · 撤展即下架全部语言，恢复须重新确认',
};

const r1=x=>Math.round(x*10)/10;
export const fmtSec=s=>{const v=r1(s);const m=Math.floor(Math.abs(v)/60);const sec=(Math.abs(v)%60).toFixed(1);return `${v<0?'-':''}${m}:${sec.padStart(4,'0')}`;};
export const fmtDiff=s=>`${s>0?'+':''}${r1(s)}s`;

// ---------- 查询 ----------
export const exhibitOf=(state,id)=>state.exhibits.find(x=>x.id===id);
export const tracksFor=(state,exhibitId,lang)=>state.tracks.filter(t=>t.exhibitId===exhibitId&&t.lang===lang);
export const subOf=(state,exhibitId,lang)=>state.subtitles.find(s=>s.exhibitId===exhibitId&&s.lang===lang);
export const pendingOf=(state,exhibitId,lang)=>tracksFor(state,exhibitId,lang).find(t=>t.status==='pending');
export const publishedOf=(state,exhibitId,lang)=>tracksFor(state,exhibitId,lang).find(t=>t.status==='published');

// ---------- 校时 ----------
// 录音时长必须覆盖字幕末段；偏差超过 ±TOLERANCE 即整条退回，并标出越界字幕位置
export function validateTiming(duration,cues){
  const sorted=[...cues].sort((a,b)=>a.start-b.start);
  const lastEnd=sorted.reduce((m,c)=>Math.max(m,c.end),0);
  const deviation=r1(duration-lastEnd);
  const issues=[];
  sorted.forEach((c,i)=>{
    if(c.end>duration+1e-9)issues.push({type:'cue-overrun',index:i,over:r1(c.end-duration),cue:{start:c.start,end:c.end}});
  });
  if(deviation<0)issues.push({type:'uncovered-tail',lack:r1(-deviation)});
  if(deviation>TOLERANCE)issues.push({type:'tail-gap',excess:r1(deviation-TOLERANCE)});
  return {ok:issues.length===0,deviation,lastEnd,issues};
}

const conflict=(state,exhibitId,lang,diff,rule)=>({
  id:`${exhibitId}-${lang}-${rule.slice(0,2)}-${Math.random().toString(36).slice(2,7)}`,
  exhibitId,
  title:exhibitOf(state,exhibitId)?.title??`#${exhibitId}`,
  lang,diff,rule:RULES[rule],
});

const nextVersion=(state,exhibitId,lang)=>1+Math.max(0,...tracksFor(state,exhibitId,lang).map(t=>t.version));
const now=()=>new Date().toLocaleString('zh-CN',{hour12:false});
const uid=()=>Date.now()+Math.floor(Math.random()*1000);

// ---------- 提交音轨（校时 → 待发布） ----------
export function addPending(state,{exhibitId,lang,duration,url}){
  const ex=exhibitOf(state,exhibitId);
  if(ex.status==='已撤展')
    return {state,conflicts:[conflict(state,exhibitId,lang,null,'R5')],notice:`「${ex.title}」已撤展，全部语言下架中，无法提交音轨`};
  const sub=subOf(state,exhibitId,lang);
  if(!sub||!sub.cues.length)
    return {state,conflicts:[conflict(state,exhibitId,lang,null,'R2')],notice:'该语言还没有字幕，无法校时'};
  const v=validateTiming(duration,sub.cues);
  const track={id:uid(),exhibitId,lang,version:nextVersion(state,exhibitId,lang),duration,url:url||'',issues:v.issues,reason:'',createdAt:now(),status:''};
  if(!v.ok){
    // 整条退回，越界位置随 issues 保留
    const next={...state,tracks:[...state.tracks,{...track,status:'rejected'}]};
    return {state:next,conflicts:[conflict(state,exhibitId,lang,v.deviation,'R2')],
      notice:`校时未通过：时长差 ${fmtDiff(v.deviation)}，整条退回（v${track.version}）`};
  }
  // R1：同语种只保留一条待发布，旧待发布转入历史
  const tracks=state.tracks.map(t=>
    t.exhibitId===exhibitId&&t.lang===lang&&t.status==='pending'
      ?{...t,status:'archived',reason:'被新待发布版本取代（R1）'}:t);
  const next={...state,tracks:[...tracks,{...track,status:'pending'}]};
  return {state:next,conflicts:[],notice:`v${track.version} 校时通过（时长差 ${fmtDiff(v.deviation)}），已进入待发布`};
}

// ---------- 发布 / 替换（冻结与留痕） ----------
export function publishTrack(state,trackId,reason){
  const track=state.tracks.find(t=>t.id===trackId);
  if(!track||track.status!=='pending')return {state,conflicts:[],notice:'仅待发布音轨可发布'};
  const ex=exhibitOf(state,track.exhibitId);
  if(ex.status==='已撤展')
    return {state,conflicts:[conflict(state,track.exhibitId,track.lang,null,'R5')],notice:`「${ex.title}」已撤展，无法发布音轨`};
  const sub=subOf(state,track.exhibitId,track.lang);
  const v=validateTiming(track.duration,sub?.cues||[]);
  if(!v.ok){
    const next={...state,tracks:state.tracks.map(t=>t.id===trackId?{...t,status:'rejected',issues:v.issues}:t)};
    return {state:next,conflicts:[conflict(state,track.exhibitId,track.lang,v.deviation,'R2')],
      notice:`发布前校时未通过：时长差 ${fmtDiff(v.deviation)}，整条退回`};
  }
  const current=publishedOf(state,track.exhibitId,track.lang);
  if(current&&!reason?.trim())
    return {state,conflicts:[conflict(state,track.exhibitId,track.lang,v.deviation,'R4')],
      notice:`该语言已有生效版本 v${current.version}，替换须填写原因`};
  // R3 + R4：旧生效版归档保留，新版成为唯一生效
  const tracks=state.tracks.map(t=>{
    if(current&&t.id===current.id)return {...t,status:'archived',reason:reason.trim(),replacedBy:track.id};
    if(t.id===trackId)return {...t,status:'published',issues:[]};
    return t;
  });
  return {state:{...state,tracks},conflicts:[],
    notice:current?`已替换生效版本：v${current.version} 归档保留，v${track.version} 生效`:`v${track.version} 已发布生效`};
}

// ---------- 撤展 / 恢复 / 重确认 ----------
export function withdrawExhibit(state,exhibitId){
  const ex=exhibitOf(state,exhibitId);
  const tracks=state.tracks.map(t=>
    t.exhibitId===exhibitId&&t.status==='published'?{...t,status:'offline'}:t);
  const subtitles=state.subtitles.map(s=>
    s.exhibitId===exhibitId?{...s,confirmed:false}:s);
  const next={exhibits:state.exhibits.map(x=>x.id===exhibitId?{...x,status:'已撤展'}:x),tracks,subtitles};
  return {state:next,conflicts:[],notice:`「${ex.title}」已撤展，全部语言音轨即时下架`};
}

export function restoreExhibit(state,exhibitId){
  const ex=exhibitOf(state,exhibitId);
  const next={...state,exhibits:state.exhibits.map(x=>x.id===exhibitId?{...x,status:'草稿'}:x)};
  return {state:next,conflicts:[],notice:`「${ex.title}」已恢复为草稿，请重新确认音轨与字幕后再发布`};
}

// 恢复后逐条重确认：重新校时，且不得与已生效版本冲突（R3）
export function confirmTrack(state,trackId){
  const track=state.tracks.find(t=>t.id===trackId);
  if(!track||track.status!=='offline')return {state,conflicts:[],notice:'仅已下架音轨需要重新确认'};
  const sub=subOf(state,track.exhibitId,track.lang);
  const v=validateTiming(track.duration,sub?.cues||[]);
  if(!v.ok){
    const next={...state,tracks:state.tracks.map(t=>t.id===trackId?{...t,status:'rejected',issues:v.issues}:t)};
    return {state:next,conflicts:[conflict(state,track.exhibitId,track.lang,v.deviation,'R2')],
      notice:`重新确认时校时未通过：时长差 ${fmtDiff(v.deviation)}，整条退回`};
  }
  if(publishedOf(state,track.exhibitId,track.lang))
    return {state,conflicts:[conflict(state,track.exhibitId,track.lang,v.deviation,'R3')],notice:'该语言已有生效版本，无法直接恢复'};
  const next={...state,tracks:state.tracks.map(t=>t.id===trackId?{...t,status:'published',issues:[]}:t)};
  return {state:next,conflicts:[],notice:`v${track.version} 已重新确认并恢复生效`};
}

// ---------- 字幕 ----------
export function updateSubtitles(state,exhibitId,lang,cues){
  const rest=state.subtitles.filter(s=>!(s.exhibitId===exhibitId&&s.lang===lang));
  const next={...state,subtitles:[...rest,{exhibitId,lang,confirmed:false,cues}]};
  return {state:next,conflicts:[],notice:'字幕已修改，待确认'};
}

export function confirmSubtitles(state,exhibitId,lang){
  const next={...state,subtitles:state.subtitles.map(s=>
    s.exhibitId===exhibitId&&s.lang===lang?{...s,confirmed:true}:s)};
  return {state:next,conflicts:[],notice:'字幕已确认'};
}

// ---------- 展项 ----------
export function addExhibit(state,form){
  const item={...form,id:uid(),status:'草稿',color:['#e6b45d','#ef8f84','#83b9b1','#9ba7dc'][state.exhibits.length%4]};
  return {state:{...state,exhibits:[...state.exhibits,item]},conflicts:[],notice:'展项已保存为草稿',added:item};
}

export function updateExhibit(state,id,k,v){
  return {state:{...state,exhibits:state.exhibits.map(x=>x.id===id?{...x,[k]:v}:x)},conflicts:[],notice:''};
}

export function toggleExhibitPublish(state,id){
  const ex=exhibitOf(state,id);
  if(ex.status==='已撤展')return {state,conflicts:[],notice:'已撤展展项需先恢复'};
  const to=ex.status==='已发布'?'草稿':'已发布';
  const next={...state,exhibits:state.exhibits.map(x=>x.id===id?{...x,status:to}:x)};
  return {state:next,conflicts:[],notice:to==='已发布'?'已发布，访客预览已更新':'已撤回发布'};
}

// ---------- 全量冲突扫描（刷新后同样适用） ----------
export function collectConflicts(state){
  const out=[];
  const keys=new Set(state.tracks.map(t=>`${t.exhibitId}|${t.lang}`));
  for(const key of keys){
    const [exhibitId,lang]=key.split('|').map((v,i)=>i===0?Number(v):v);
    const list=tracksFor(state,exhibitId,lang);
    if(list.filter(t=>t.status==='pending').length>1)out.push(conflict(state,exhibitId,lang,null,'R1'));
    if(list.filter(t=>t.status==='published').length>1)out.push(conflict(state,exhibitId,lang,null,'R3'));
    for(const t of list){
      if(t.status!=='pending'&&t.status!=='published')continue;
      const sub=subOf(state,exhibitId,lang);
      const v=validateTiming(t.duration,sub?.cues||[]);
      if(!v.ok)out.push(conflict(state,exhibitId,lang,v.deviation,'R2'));
    }
  }
  for(const ex of state.exhibits){
    if(ex.status==='已撤展'&&state.tracks.some(t=>t.exhibitId===ex.id&&t.status==='published'))
      out.push(conflict(state,ex.id,'*',null,'R5'));
  }
  return out;
}
