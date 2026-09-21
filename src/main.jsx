import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import {loadState,saveState} from './domain/data.js';
import * as R from './domain/rules.js';
import {VisitorHome,VisitorDetail} from './ui/Visitor.jsx';
import {Workbench} from './ui/Workbench.jsx';

function App(){
  const [state,setState]=useState(loadState);
  const [selected,setSelected]=useState(()=>state.exhibits[0]?.id);
  const [view,setView]=useState('edit');
  const [filter,setFilter]=useState('全部');
  const [notice,setNotice]=useState('');
  const [opConflicts,setOpConflicts]=useState([]);

  // 单一数据源持久化：刷新后展项、语言、音轨版本与访客预览保持一致
  useEffect(()=>saveState(state),[state]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4200);return ()=>clearTimeout(t)},[notice]);

  const run=res=>{setState(res.state);if(res.notice)setNotice(res.notice);if(res.conflicts)setOpConflicts(res.conflicts);return res;};
  const act=useMemo(()=>({
    notify:setNotice,
    addExhibit:form=>run(R.addExhibit(state,form)),
    updateExhibit:(id,k,v)=>run(R.updateExhibit(state,id,k,v)),
    toggleExhibitPublish:id=>run(R.toggleExhibitPublish(state,id)),
    withdrawExhibit:id=>run(R.withdrawExhibit(state,id)),
    restoreExhibit:id=>run(R.restoreExhibit(state,id)),
    addPending:(exhibitId,lang,duration,url)=>run(R.addPending(state,{exhibitId,lang,duration,url})),
    publishTrack:(id,reason)=>run(R.publishTrack(state,id,reason)),
    confirmTrack:id=>run(R.confirmTrack(state,id)),
    updateSubtitles:(exhibitId,lang,cues)=>run(R.updateSubtitles(state,exhibitId,lang,cues)),
    confirmSubtitles:(exhibitId,lang)=>run(R.confirmSubtitles(state,exhibitId,lang)),
    exportData:()=>{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
      a.download='exhibition-guide.json';a.click();setNotice('已导出展项数据');
    },
  }),[state]);

  // 操作冲突 + 全量扫描冲突（去重），统一在冲突面板列出
  const conflicts=useMemo(()=>{
    const live=R.collectConflicts(state);
    const seen=new Set(live.map(c=>`${c.exhibitId}|${c.lang}|${c.rule}`));
    return [...live,...opConflicts.filter(c=>!seen.has(`${c.exhibitId}|${c.lang}|${c.rule}`))];
  },[state,opConflicts]);

  const current=state.exhibits.find(x=>x.id===selected);
  if(view==='visitor')return <>
    <VisitorHome state={state} onBack={()=>setView('edit')} onOpen={id=>{setSelected(id);setView('detail')}}/>
    {notice&&<div className="toast">{notice}</div>}</>;
  if(view==='detail'&&current)return <>
    <VisitorDetail key={current.id} state={state} exhibit={current} onBack={()=>setView('visitor')} onPlay={setNotice}/>
    {notice&&<div className="toast">{notice}</div>}</>;
  return <>
    <Workbench state={state} selected={selected} setSelected={setSelected} filter={filter} setFilter={setFilter}
      act={act} conflicts={conflicts} onVisitor={()=>setView('visitor')}/>
    {notice&&<div className="toast">{notice}</div>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
