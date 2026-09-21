import React, { useEffect, useState } from 'react';
import { loadExhibits, saveExhibits, resetExhibits } from '../domain/store.js';
import Workbench from './Workbench.jsx';
import Visitor from './Visitor.jsx';
import ConflictPanel from './ConflictPanel.jsx';

export default function App() {
  const [exhibits, setExhibits] = useState(loadExhibits);
  const [conflicts, setConflicts] = useState([]);
  const [view, setView] = useState('edit'); // edit | visitor | detail
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  // 持久化：刷新后展项、语言、音轨版本与访客预览保持一致
  useEffect(() => { saveExhibits(exhibits); }, [exhibits]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3600);
    return () => clearTimeout(t);
  }, [notice]);

  const current = exhibits.find((x) => x.id === selected) || exhibits[0];
  const notify = (msg) => setNotice(msg);

  // 统一执行领域操作：更新数据并收集冲突
  const run = (op, ...args) => {
    const r = op(exhibits, ...args);
    if (r.exhibits && r.exhibits !== exhibits) setExhibits(r.exhibits);
    if (r.conflicts && r.conflicts.length) setConflicts((c) => [...c, ...r.conflicts]);
    return r;
  };

  const reset = () => {
    const s = resetExhibits();
    setExhibits(s);
    setSelected(s[0]?.id);
    setConflicts([]);
    notify('已重置为示例数据');
  };

  if (view === 'visitor' || view === 'detail') {
    return (
      <>
        <Visitor exhibits={exhibits} current={current} setSelected={setSelected} view={view} setView={setView} />
        {notice && <div className="toast">{notice}</div>}
      </>
    );
  }
  return (
    <>
      <Workbench
        exhibits={exhibits}
        current={current}
        setSelected={setSelected}
        run={run}
        notify={notify}
        setView={setView}
        reset={reset}
      />
      <ConflictPanel conflicts={conflicts} onClear={() => setConflicts([])} />
      {notice && <div className="toast">{notice}</div>}
    </>
  );
}
