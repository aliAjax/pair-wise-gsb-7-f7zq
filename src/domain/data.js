// 领域数据层：模型、种子数据、持久化。不含任何校时规则与界面逻辑。

export const LANGS=[
  {code:'zh',name:'中文'},
  {code:'en',name:'English'},
  {code:'ja',name:'日本語'},
];
export const langName=c=>LANGS.find(l=>l.code===c)?.name||c;

export const TRACK_STATUS={
  pending:'待发布',
  published:'生效中',
  rejected:'已退回',
  archived:'旧版保留',
  offline:'已下架',
};

export const EXHIBIT_STATUS={draft:'草稿',live:'已发布',down:'已撤展'};

const seed={
  exhibits:[
    {id:1,title:'潮汐之后',room:'A01 · 主展厅',type:'装置',desc:'一件记录海岸线变化的沉浸式影像装置。',status:'已发布',color:'#e6b45d'},
    {id:2,title:'未寄出的信',room:'B02 · 纸上时间',type:'档案',desc:'来自三代人的手写信件与声音档案。',status:'草稿',color:'#ef8f84'},
    {id:3,title:'柔软的边界',room:'C01 · 新媒介',type:'互动',desc:'观众的移动会改变墙面上的光影。',status:'已发布',color:'#83b9b1'},
  ],
  tracks:[
    {id:101,exhibitId:1,lang:'zh',version:1,duration:96,url:'https://example.com/audio.mp3',status:'published',issues:[],reason:'',createdAt:'2026-09-01 10:00'},
    {id:102,exhibitId:1,lang:'en',version:1,duration:62.4,url:'',status:'published',issues:[],reason:'',createdAt:'2026-09-02 11:30'},
    {id:103,exhibitId:2,lang:'zh',version:1,duration:48,url:'',status:'pending',issues:[],reason:'',createdAt:'2026-09-10 09:20'},
    {id:104,exhibitId:3,lang:'zh',version:1,duration:73,url:'',status:'published',issues:[],reason:'',createdAt:'2026-09-05 15:40'},
  ],
  subtitles:[
    {exhibitId:1,lang:'zh',confirmed:true,cues:[
      {start:0,end:12.4,text:'欢迎来到「潮汐之后」。'},
      {start:13,end:31.8,text:'这条海岸线，在三十年里后退了四十米。'},
      {start:32.5,end:58.2,text:'艺术家用传感器记录每一次涨落。'},
      {start:60,end:95.2,text:'当你离开时，潮汐仍在继续。'},
    ]},
    {exhibitId:1,lang:'en',confirmed:true,cues:[
      {start:0,end:20.5,text:'Welcome to After the Tide.'},
      {start:21,end:61.5,text:'The shoreline has retreated forty meters in thirty years.'},
    ]},
    {exhibitId:2,lang:'zh',confirmed:true,cues:[
      {start:0,end:18,text:'这些信件从未被寄出。'},
      {start:19,end:47.6,text:'它们被朗读、被录音，然后被封存。'},
    ]},
    {exhibitId:3,lang:'zh',confirmed:true,cues:[
      {start:0,end:30,text:'请靠近墙面，你的移动会改变光影。'},
      {start:31,end:72.4,text:'边界，从来都不是一条线。'},
    ]},
  ],
};

const KEY='guide-loop-v1';

// 兼容旧版单展项存储：迁移展项基本信息，音轨与字幕从空开始
function migrate(){
  try{
    const old=JSON.parse(localStorage.getItem('guide-exhibits'));
    if(Array.isArray(old)&&old.length){
      return {exhibits:old.map(({audio,...x})=>x),tracks:[],subtitles:[]};
    }
  }catch{}
  return null;
}

export function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(s&&Array.isArray(s.exhibits)&&Array.isArray(s.tracks)&&Array.isArray(s.subtitles))return s;
  }catch{}
  return migrate()||seed;
}

export function saveState(s){
  try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}
}
