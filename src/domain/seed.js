// 领域数据层：语言目录、状态文案、初始展项（含字幕与音轨版本）。

export const LANGS = { 'zh-CN': '中文', 'en-US': 'English', 'ja-JP': '日本語' };

export const EXHIBIT_STATUS = { draft: '草稿', published: '已发布', withdrawn: '已撤展' };
export const TRACK_STATE = {
  pending: '待发布',
  active: '生效中',
  rejected: '已退回',
  archived: '已归档',
  offline: '已下架',
};

export const PALETTE = ['#e6b45d', '#ef8f84', '#83b9b1', '#9ba7dc'];

const cue = (id, start, end, text) => ({ id, start, end, text });
const track = (id, version, duration, state, extra = {}) => ({ id, version, duration, state, ...extra });

export const seed = [
  {
    id: 1,
    title: '潮汐之后',
    room: 'A01 · 主展厅',
    type: '装置',
    desc: '一件记录海岸线变化的沉浸式影像装置。',
    status: 'published',
    color: '#e6b45d',
    languages: {
      'zh-CN': {
        confirmed: true,
        subtitles: [
          cue('c1', 0, 6, '欢迎来到「潮汐之后」。'),
          cue('c2', 6, 15, '这件装置记录了二十年间海岸线的进退。'),
          cue('c3', 15, 27, '影像每一帧，都对应一次真实的潮位测量。'),
          cue('c4', 27, 40, '艺术家把数据编织成缓慢呼吸的光。'),
          cue('c5', 40, 55, '请留意脚下——光圈会随你的靠近而改变。'),
          cue('c6', 55, 70, '退潮的声音，采集自三个港口的水声。'),
          cue('c7', 70, 84, '当光线完全暗下，新的潮位正在生成。'),
          cue('c8', 84, 94, '感谢聆听，请继续前往下一个展厅。'),
        ],
        tracks: [
          track('t1', 1, 90, 'archived', {
            url: 'https://cdn.example.com/tide/zh-v1.mp3',
            reason: '口播重录，替换为第二版',
            replacedBy: 2,
            createdAt: '09-08 10:12',
          }),
          track('t2', 2, 95, 'active', {
            url: 'https://cdn.example.com/tide/zh-v2.mp3',
            createdAt: '09-10 14:20',
          }),
          track('t3', 3, 96, 'pending', {
            url: 'https://cdn.example.com/tide/zh-v3.mp3',
            createdAt: '09-18 09:41',
          }),
        ],
      },
      'en-US': {
        confirmed: true,
        subtitles: [
          cue('c9', 0, 6, 'Welcome to After the Tide.'),
          cue('c10', 6, 16, 'This installation traces twenty years of a shifting coastline.'),
          cue('c11', 16, 30, 'Every frame corresponds to an actual tide measurement.'),
          cue('c12', 30, 46, 'The artist weaves the data into slowly breathing light.'),
          cue('c13', 46, 62, 'Notice the floor — the halo changes as you approach.'),
          cue('c14', 62, 76, 'The sound of ebb tide was recorded in three harbors.'),
          cue('c15', 76, 88, 'Thank you for listening. Please continue to the next gallery.'),
        ],
        tracks: [
          track('t4', 1, 89, 'active', {
            url: 'https://cdn.example.com/tide/en-v1.mp3',
            createdAt: '09-10 15:02',
          }),
        ],
      },
    },
  },
  {
    id: 2,
    title: '未寄出的信',
    room: 'B02 · 纸上时间',
    type: '档案',
    desc: '来自三代人的手写信件与声音档案。',
    status: 'draft',
    color: '#ef8f84',
    languages: {
      'zh-CN': {
        confirmed: true,
        subtitles: [
          cue('c16', 0, 5, '这些信件从未被寄出。'),
          cue('c17', 5, 12, '它们写于不同的年代，却寄往同一个地址。'),
          cue('c18', 12, 20, '请戴上耳机，收听其中三封信的朗读。'),
          cue('c19', 20, 28, '第一封，来自一九六二年的春天。'),
          cue('c20', 28, 36, '字迹在潮气里晕开，句子仍然清晰。'),
          cue('c21', 36, 44, '第二封信夹着一片压干的栀子花。'),
          cue('c22', 44, 53, '第三封只有一行字：等我回来。'),
          cue('c23', 53, 62, '档案到此结束，故事仍在继续。'),
        ],
        tracks: [
          track('t5', 1, 58, 'rejected', {
            url: 'https://cdn.example.com/letters/zh-v1.mp3',
            violations: [
              { rule: 'COVERAGE', position: 53, message: '录音在 00:58 结束，未覆盖字幕末段 01:02' },
            ],
            createdAt: '09-15 16:44',
          }),
          track('t6', 2, 63, 'pending', {
            url: 'https://cdn.example.com/letters/zh-v2.mp3',
            createdAt: '09-19 11:05',
          }),
        ],
      },
    },
  },
  {
    id: 3,
    title: '柔软的边界',
    room: 'C01 · 新媒介',
    type: '互动',
    desc: '观众的移动会改变墙面上的光影。',
    status: 'published',
    color: '#83b9b1',
    languages: {
      'zh-CN': {
        confirmed: true,
        subtitles: [
          cue('c24', 0, 5, '这面墙会回应你的移动。'),
          cue('c25', 5, 14, '走得越慢，光影越柔和。'),
          cue('c26', 14, 26, '试着伸手，边界会在指尖前停下。'),
          cue('c27', 26, 36, '每一次触碰都会被记录成一道细纹。'),
          cue('c28', 36, 45, '现在，换你决定边界的形状。'),
        ],
        tracks: [
          track('t7', 1, 46.5, 'active', {
            url: 'https://cdn.example.com/boundary/zh-v1.mp3',
            createdAt: '09-11 13:30',
          }),
        ],
      },
      'en-US': {
        confirmed: true,
        subtitles: [
          cue('c29', 0, 6, 'This wall responds to your movement.'),
          cue('c30', 6, 15, 'The slower you move, the softer the light.'),
          cue('c31', 15, 27, 'Reach out — the boundary stops at your fingertips.'),
          cue('c32', 27, 42, 'Now the shape of the boundary is yours to draw.'),
        ],
        tracks: [
          track('t8', 1, 43, 'active', {
            url: 'https://cdn.example.com/boundary/en-v1.mp3',
            createdAt: '09-11 14:02',
          }),
        ],
      },
    },
  },
  {
    id: 4,
    title: '无声坐标',
    room: 'D03 · 声音剧场',
    type: '档案',
    desc: '一座城市夜航噪音的经纬度档案。',
    status: 'withdrawn',
    color: '#9ba7dc',
    languages: {
      'zh-CN': {
        confirmed: false,
        subtitles: [
          cue('c33', 0, 8, '这里曾经播放一座城市的夜航噪音。'),
          cue('c34', 8, 18, '每一段录音都标注了确切的经纬度。'),
          cue('c35', 18, 30, '撤展期间，音轨与字幕等待重新确认。'),
        ],
        tracks: [
          track('t9', 1, 31, 'offline', {
            url: 'https://cdn.example.com/coords/zh-v1.mp3',
            createdAt: '09-05 10:00',
          }),
        ],
      },
    },
  },
];
