export const WEB_GAME_VERSION='2026.08.03.3';

export const WEB_GAME_MODULES=[
  {id:'appearance',icon:'✨',name:'角色造型',description:'選擇角色與管理員發布的完整造型',state:'available'},
  {id:'transport',icon:'🧭',name:'交通事業',description:'航空、鐵路、客運與貨運企業總覽',state:'dashboard'},
  {id:'garage',icon:'🗂️',name:'全載具車庫',description:'飛行器、汽車、機車、列車與卡車收藏',state:'dashboard'},
  {id:'vehicle-pvp',icon:'🏁',name:'載具 PVP',description:'建立房間、選車下注並觀看即時競速',state:'available'},
  {id:'assets',icon:'🏛️',name:'資產收藏',description:'查看持有資產、數量與原價總值',state:'dashboard'},
  {id:'achievements',icon:'🏆',name:'成就收藏',description:'追蹤解鎖進度與特殊稱號',state:'dashboard'},
  {id:'mahjong',icon:'🀄',name:'網頁麻將',description:'建立房間或加入好友牌局',state:'available'},
  {id:'casino',icon:'🎰',name:'賭場遊戲',description:'完整賭場操作將於下一階段搬入網站',state:'coming'}
];

export const WEB_GARAGE_GROUPS=[
  {id:'aircraft',icon:'✈️',name:'飛行器',categories:['飛行器']},
  {id:'vehicles',icon:'🏎️',name:'汽車／載具',categories:['汽車']},
  {id:'motorcycles',icon:'🏍️',name:'摩托車',categories:['機車']},
  {id:'trains',icon:'🚆',name:'列車',categories:['列車']},
  {id:'trucks',icon:'🚛',name:'卡車',categories:['卡車']}
];

export const WEB_TRANSPORT_TYPES=[
  {id:'airline',icon:'✈️',name:'航空運輸'},
  {id:'rail',icon:'🚄',name:'鐵路運輸'},
  {id:'coach',icon:'🚌',name:'城際客運'},
  {id:'freight',icon:'🚛',name:'物流貨運'}
];

export function summarizeWebAssets(rows,catalog,limit=8) {
  const normalized=rows.map(row=>{
    const asset=catalog[row.asset_id]||{};
    return {
      id:row.asset_id,
      name:asset.name||row.asset_id,
      category:asset.category||'其他',
      rarity:asset.rarity||'一般',
      quantity:Number(row.quantity)||0,
      unitValue:Number(asset.price)||0,
      totalValue:(Number(asset.price)||0)*(Number(row.quantity)||0)
    };
  });
  return {
    count:normalized.reduce((sum,row)=>sum+row.quantity,0),
    value:normalized.reduce((sum,row)=>sum+row.totalValue,0),
    featured:normalized.sort((a,b)=>b.totalValue-a.totalValue||a.name.localeCompare(b.name,'zh-Hant')).slice(0,limit)
  };
}
