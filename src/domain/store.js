// 领域数据层：展项 / 语言 / 字幕 / 音轨版本的状态变更与持久化。
// 所有操作都是纯函数：接收 exhibits，返回 { exhibits, conflicts }，不触碰界面。

import { calibrate, RULE_TEXT } from '../rules/timing.js';
import { seed, LANGS, PALETTE } from './seed.js';

export const STORE_KEY = 'guide-workbench-v2';

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toLocaleString('zh-CN', { hour12: false });

/* ---------- 持久化：刷新后展项、语言、音轨版本与访客预览保持一致 ---------- */

export const loadExhibits = () => {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(d) && d.length ? d : seed;
  } catch {
    return seed;
  }
};
export const saveExhibits = (x) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(x));
  } catch {}
};
export const resetExhibits = () => {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
  return seed;
};

/* ---------- 选择器 ---------- */

export const activeTrack = (L) => L?.tracks.find((t) => t.state === 'active') || null;
// 访客可见语言：已确认 且 有生效音轨
export const visibleLanguages = (ex) =>
  Object.entries(ex.languages)
    .filter(([, L]) => L.confirmed && activeTrack(L))
    .map(([l]) => l);

/* ---------- 内部工具 ---------- */

const ok = (exhibits) => ({ exhibits, conflicts: [] });
const mapExhibit = (exhibits, id, fn) => exhibits.map((x) => (x.id === id ? fn(x) : x));
const findExhibit = (exhibits, id) => exhibits.find((x) => x.id === id);

// 冲突条目：展项、语言、时长差、触发限制（可选越界位置）
const conflict = (ex, lang, rule, durationDiff = null, extra = {}) => ({
  id: uid(),
  exhibitId: ex.id,
  exhibitTitle: ex.title,
  lang,
  langLabel: LANGS[lang] || lang,
  durationDiff,
  rule,
  ruleText: RULE_TEXT[rule] || rule,
  ...extra,
});

const withLang = (ex, lang, patch) => ({
  ...ex,
  languages: { ...ex.languages, [lang]: { ...ex.languages[lang], ...patch } },
});

/* ---------- 展项 ---------- */

export function addExhibit(exhibits, form) {
  const item = {
    id: Date.now(),
    title: form.title.trim(),
    room: form.room || '未分配展厅',
    type: form.type || '装置',
    desc: form.desc || '',
    status: 'draft',
    color: PALETTE[exhibits.length % PALETTE.length],
    languages: { 'zh-CN': { confirmed: true, subtitles: [], tracks: [] } },
  };
  return { exhibits: [...exhibits, item], conflicts: [], item };
}

export const updateExhibit = (exhibits, id, patch) =>
  ok(mapExhibit(exhibits, id, (x) => ({ ...x, ...patch })));

// 发布 / 撤回发布。恢复展出后若存在未确认语言，则拦截并列出冲突。
export function publishExhibit(exhibits, id) {
  const ex = findExhibit(exhibits, id);
  if (!ex || ex.status === 'withdrawn') return ok(exhibits);
  if (ex.status === 'published') {
    return ok(mapExhibit(exhibits, id, (x) => ({ ...x, status: 'draft' })));
  }
  const unconfirmed = Object.entries(ex.languages).filter(([, L]) => !L.confirmed);
  if (unconfirmed.length) {
    return {
      exhibits,
      conflicts: unconfirmed.map(([lang]) => conflict(ex, lang, 'RECONFIRM')),
    };
  }
  return ok(mapExhibit(exhibits, id, (x) => ({ ...x, status: 'published' })));
}

// 撤展：立即下架全部语言音轨，并标记所有语言待重新确认。
export function withdrawExhibit(exhibits, id) {
  const ex = findExhibit(exhibits, id);
  if (!ex || ex.status !== 'published') return ok(exhibits);
  return ok(
    mapExhibit(exhibits, id, (x) => ({
      ...x,
      status: 'withdrawn',
      languages: Object.fromEntries(
        Object.entries(x.languages).map(([lang, L]) => [
          lang,
          {
            ...L,
            confirmed: false,
            tracks: L.tracks.map((t) => (t.state === 'active' ? { ...t, state: 'offline' } : t)),
          },
        ])
      ),
    }))
  );
}

// 恢复展出：回到草稿，各语言仍需逐一确认音轨与字幕后才能再发布。
export function restoreExhibit(exhibits, id) {
  const ex = findExhibit(exhibits, id);
  if (!ex || ex.status !== 'withdrawn') return ok(exhibits);
  return ok(mapExhibit(exhibits, id, (x) => ({ ...x, status: 'draft' })));
}

/* ---------- 语言与字幕 ---------- */

export function addLanguage(exhibits, id, lang) {
  const ex = findExhibit(exhibits, id);
  if (!ex || ex.languages[lang]) return ok(exhibits);
  return ok(
    mapExhibit(exhibits, id, (x) => ({
      ...x,
      languages: { ...x.languages, [lang]: { confirmed: true, subtitles: [], tracks: [] } },
    }))
  );
}

// 恢复展出后逐语言确认：下架音轨恢复为生效版本。
export function confirmLanguage(exhibits, id, lang) {
  const ex = findExhibit(exhibits, id);
  if (!ex || !ex.languages[lang]) return ok(exhibits);
  return ok(
    mapExhibit(exhibits, id, (x) =>
      withLang(x, lang, {
        confirmed: true,
        tracks: x.languages[lang].tracks.map((t) =>
          t.state === 'offline' ? { ...t, state: 'active' } : t
        ),
      })
    )
  );
}

export function setSubtitles(exhibits, id, lang, subtitles) {
  const ex = findExhibit(exhibits, id);
  if (!ex || !ex.languages[lang]) return ok(exhibits);
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  return ok(mapExhibit(exhibits, id, (x) => withLang(x, lang, { subtitles: sorted })));
}

/* ---------- 音轨版本 ---------- */

// 提交音轨：先校时（越界整条退回并标出位置），再检查待发布唯一性。
export function submitTrack(exhibits, id, lang, { url, duration }) {
  const ex = findExhibit(exhibits, id);
  const L = ex?.languages[lang];
  if (!L) return ok(exhibits);

  const check = calibrate(duration, L.subtitles);
  const version = Math.max(0, ...L.tracks.map((t) => t.version)) + 1;
  const base = { id: uid(), version, url, duration, createdAt: now() };

  if (!check.ok) {
    const rejected = { ...base, state: 'rejected', violations: check.violations };
    return {
      exhibits: mapExhibit(exhibits, id, (x) =>
        withLang(x, lang, { tracks: [...L.tracks, rejected] })
      ),
      conflicts: check.violations.map((v) =>
        conflict(ex, lang, v.rule, check.deviation, { position: v.position, message: v.message })
      ),
    };
  }

  const existing = L.tracks.find((t) => t.state === 'pending');
  if (existing) {
    return {
      exhibits,
      conflicts: [
        conflict(ex, lang, 'SINGLE_PENDING', check.deviation, {
          message: `已存在待发布版本 v${existing.version}，请先设为生效或废弃`,
        }),
      ],
    };
  }

  return ok(
    mapExhibit(exhibits, id, (x) =>
      withLang(x, lang, { tracks: [...L.tracks, { ...base, state: 'pending' }] })
    )
  );
}

// 设为生效：激活前重新校时；同语种仅一版生效，旧版自动归档；
// 展项已发布时音轨冻结，替换必须填写原因。
export function activateTrack(exhibits, id, lang, trackId, reason = '') {
  const ex = findExhibit(exhibits, id);
  const L = ex?.languages[lang];
  const track = L?.tracks.find((t) => t.id === trackId);
  if (!track || track.state !== 'pending') return ok(exhibits);

  const check = calibrate(track.duration, L.subtitles);
  if (!check.ok) {
    return {
      exhibits: mapExhibit(exhibits, id, (x) =>
        withLang(x, lang, {
          tracks: L.tracks.map((t) =>
            t.id === trackId ? { ...t, state: 'rejected', violations: check.violations } : t
          ),
        })
      ),
      conflicts: check.violations.map((v) =>
        conflict(ex, lang, v.rule, check.deviation, { position: v.position, message: v.message })
      ),
    };
  }

  const current = L.tracks.find((t) => t.state === 'active');
  if (ex.status === 'published' && current && !reason.trim()) {
    return { exhibits, conflicts: [conflict(ex, lang, 'FROZEN', check.deviation)] };
  }

  return ok(
    mapExhibit(exhibits, id, (x) =>
      withLang(x, lang, {
        tracks: L.tracks.map((t) => {
          if (t.id === trackId)
            return {
              ...t,
              state: 'active',
              activatedAt: now(),
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            };
          if (t.state === 'active')
            return {
              ...t,
              state: 'archived',
              replacedBy: track.version,
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            };
          return t;
        }),
      })
    )
  );
}

// 废弃版本：仅待发布 / 已退回可移除；归档旧版永久保留。
export function discardTrack(exhibits, id, lang, trackId) {
  const ex = findExhibit(exhibits, id);
  const L = ex?.languages[lang];
  const track = L?.tracks.find((t) => t.id === trackId);
  if (!track) return ok(exhibits);
  if (track.state === 'active' || track.state === 'offline') {
    return { exhibits, conflicts: [conflict(ex, lang, 'RETIRE_ACTIVE')] };
  }
  if (track.state === 'archived') return ok(exhibits);
  return ok(
    mapExhibit(exhibits, id, (x) =>
      withLang(x, lang, { tracks: L.tracks.filter((t) => t.id !== trackId) })
    )
  );
}

// 手动重新校时：字幕修订后复检全部待发布音轨，越界整条退回。
export function recheckLanguage(exhibits, id, lang) {
  const ex = findExhibit(exhibits, id);
  const L = ex?.languages[lang];
  if (!L) return ok(exhibits);

  const failed = L.tracks
    .filter((t) => t.state === 'pending')
    .map((t) => ({ t, check: calibrate(t.duration, L.subtitles) }))
    .filter((x) => !x.check.ok);
  if (!failed.length) return ok(exhibits);

  return {
    exhibits: mapExhibit(exhibits, id, (x) =>
      withLang(x, lang, {
        tracks: L.tracks.map((t) => {
          const f = failed.find((y) => y.t.id === t.id);
          return f ? { ...t, state: 'rejected', violations: f.check.violations } : t;
        }),
      })
    ),
    conflicts: failed.flatMap((f) =>
      f.check.violations.map((v) =>
        conflict(ex, lang, v.rule, f.check.deviation, { position: v.position, message: v.message })
      )
    ),
  };
}
