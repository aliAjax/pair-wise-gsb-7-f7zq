import React, { useState } from 'react';
import { EXHIBIT_STATUS } from '../domain/seed.js';
import {
  addExhibit,
  updateExhibit,
  publishExhibit,
  withdrawExhibit,
  restoreExhibit,
} from '../domain/store.js';
import LanguagePanel from './LanguagePanel.jsx';

const FILTERS = ['全部', '已发布', '草稿', '已撤展'];

export default function Workbench({ exhibits, current, setSelected, run, notify, setView, reset }) {
  const [filter, setFilter] = useState('全部');
  const [form, setForm] = useState({ title: '', room: '', type: '装置', desc: '' });

  const visible = filter === '全部' ? exhibits : exhibits.filter((x) => EXHIBIT_STATUS[x.status] === filter);
  const update = (patch) => run(updateExhibit, current.id, patch);

  const add = () => {
    if (!form.title.trim()) return;
    const r = run(addExhibit, form);
    setSelected(r.item.id);
    setForm({ title: '', room: '', type: '装置', desc: '' });
    notify('展项已保存为草稿');
  };

  const onPublish = () => {
    const was = current.status;
    const r = run(publishExhibit, current.id);
    if (r.conflicts.length) return notify('发布被拦截：存在未确认语言，详见冲突清单');
    notify(was === 'published' ? '已撤回发布' : '已发布，访客预览已更新');
  };
  const onWithdraw = () => {
    run(withdrawExhibit, current.id);
    notify('已撤展：全部语言音轨立即下架');
  };
  const onRestore = () => {
    run(restoreExhibit, current.id);
    notify('已恢复为草稿，请逐语言重新确认音轨与字幕');
  };

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exhibits, null, 2)], { type: 'application/json' }));
    a.download = 'exhibition-guide.json';
    a.click();
    notify('已导出展项数据');
  };

  return (
    <div className="app">
      <aside>
        <div className="brand"><span className="mark">M</span><span>展览工作台</span></div>
        <div className="side-label">当前项目</div>
        <div className="project">
          <span className="project-dot"></span>
          <div><strong>潮汐之后</strong><small>2026 春季展</small></div>
          <span>⌄</span>
        </div>
        <nav>
          <button className="active">▧ <span>展项内容</span><b>{exhibits.length}</b></button>
          <button>⌁ <span>展厅动线</span></button>
          <button>◉ <span>二维码</span></button>
        </nav>
        <div className="side-foot">
          <button onClick={reset}>↺ 重置示例数据</button>
          <small>已自动保存 · 刷新后保持一致</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">EXHIBITION BUILDER</span>
            <h1>展项内容</h1>
          </div>
          <div className="top-actions">
            <button className="secondary" onClick={exportData}>↓ 导出 JSON</button>
            <button className="secondary" onClick={() => setView('visitor')}>◉ 访客预览</button>
            {current?.status === 'published' && (
              <button className="danger" onClick={onWithdraw}>撤展下架</button>
            )}
            {current?.status === 'withdrawn' && (
              <button className="secondary" onClick={onRestore}>恢复展出</button>
            )}
            <button className="primary" disabled={current?.status === 'withdrawn'} onClick={onPublish}>
              {current?.status === 'published' ? '撤回发布' : '发布更新'} <span>↗</span>
            </button>
          </div>
        </header>

        <div className="content">
          <section className="list-pane">
            <div className="list-head">
              <div><h2>全部展项</h2><span>{exhibits.length} 个展项</span></div>
              <button className="add-btn" onClick={() => document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' })}>＋ 添加展项</button>
            </div>
            <div className="filters">
              {FILTERS.map((x) => (
                <button className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)} key={x}>{x}</button>
              ))}
            </div>
            <div className="exhibit-list">
              {visible.map((x) => (
                <button className={'exhibit-row ' + (current?.id === x.id ? 'chosen' : '')} key={x.id} onClick={() => setSelected(x.id)}>
                  <span className="thumb" style={{ background: x.color }}>{String(x.id).padStart(2, '0')}</span>
                  <span className="row-copy">
                    <strong>{x.title}</strong>
                    <small>{x.room} · {x.type} · {Object.keys(x.languages).length} 种语言</small>
                  </span>
                  <span className={'status ' + x.status}>{EXHIBIT_STATUS[x.status]}</span>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          </section>

          <section className="form-panel">
            <div className="panel-title">
              <div><span className="eyebrow">EDIT EXHIBIT</span><h2>编辑展项</h2></div>
              <span className={'status ' + current?.status}>{EXHIBIT_STATUS[current?.status]}</span>
            </div>
            {current && (
              <div className="editor">
                <label>展项标题
                  <input value={current.title} onChange={(e) => update({ title: e.target.value })} />
                </label>
                <div className="two">
                  <label>所在展厅
                    <input value={current.room} onChange={(e) => update({ room: e.target.value })} />
                  </label>
                  <label>内容类型
                    <select value={current.type} onChange={(e) => update({ type: e.target.value })}>
                      <option>装置</option><option>档案</option><option>互动</option><option>绘画</option>
                    </select>
                  </label>
                </div>
                <label>展项介绍
                  <textarea rows="4" value={current.desc} onChange={(e) => update({ desc: e.target.value })} />
                </label>

                <LanguagePanel exhibit={current} run={run} notify={notify} />

                <div className="preview-block">
                  <div className="preview-heading">
                    <span>二维码预览</span>
                    <button onClick={() => notify('二维码链接已复制')}>复制链接</button>
                  </div>
                  <div className="qr-preview">
                    <div className="qr-box big">▦</div>
                    <div><strong>展项-{String(current.id).padStart(3, '0')}</strong><small>/guide/{current.id}</small></div>
                  </div>
                </div>
              </div>
            )}

            <div className="new-form">
              <div className="panel-title">
                <div><span className="eyebrow">NEW ENTRY</span><h2>快速添加展项</h2></div>
              </div>
              <div className="two">
                <input placeholder="展项标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <input placeholder="展厅编号" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
              <textarea placeholder="一句话介绍…" rows="2" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
              <button className="primary full" onClick={add}>保存新展项</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
