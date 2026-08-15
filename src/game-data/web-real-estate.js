export const WEB_REAL_ESTATE_MAX_LEVEL=10;

export const WEB_REAL_ESTATE_PLOTS=[
  {no:1,name:'新葡京街角',price:0,district:'葡京娛樂區'},
  {no:2,name:'南灣湖畔',price:5_000_000,district:'外港商業區'},
  {no:3,name:'氹仔新城',price:20_000_000,district:'氹仔觀光區'},
  {no:4,name:'路氹金光大道',price:75_000_000,district:'葡京娛樂區'},
  {no:5,name:'橫琴企業灣',price:250_000_000,district:'路環後勤區'},
  {no:6,name:'黑曜海岸核心',price:750_000_000,district:'地下賭城'}
];

export const WEB_REAL_ESTATE_BUILDINGS={
  residence:{name:'翡翠服務公寓',icon:'🏢',kind:'長租住宅',cost:3_000_000,buildMs:15*60*1000,operationMs:60*60*1000,baseRevenue:180_000,operationCost:60_000,color:'#55d6be'},
  mall:{name:'霓虹金街商場',icon:'🛍️',kind:'零售商業',cost:18_000_000,buildMs:30*60*1000,operationMs:2*60*60*1000,baseRevenue:1_100_000,operationCost:420_000,color:'#f1be5b'},
  tower:{name:'黑曜企業大樓',icon:'🏙️',kind:'商辦出租',cost:75_000_000,buildMs:60*60*1000,operationMs:3*60*60*1000,baseRevenue:5_000_000,operationCost:2_100_000,color:'#9b7cff'},
  resort:{name:'皇冠濱海度假城',icon:'👑',kind:'觀光飯店',cost:350_000_000,buildMs:2*60*60*1000,operationMs:6*60*60*1000,baseRevenue:24_000_000,operationCost:11_000_000,color:'#ff718f'}
};

export const WEB_REAL_ESTATE_EVENTS=[
  {id:'steady',name:'穩定營運',icon:'🏠',multiplier:1,text:'租戶與商家準時付款。'},
  {id:'festival',name:'城市節慶',icon:'🎆',multiplier:1.18,text:'節慶人潮推高本期營收。'},
  {id:'vip',name:'VIP 包場',icon:'💎',multiplier:1.4,text:'高端客戶簽下整期合約。'},
  {id:'quiet',name:'市場淡季',icon:'🌧️',multiplier:.85,text:'市場人流下降，收入略受影響。'},
  {id:'breakdown',name:'設備故障',icon:'🧰',multiplier:.75,text:'臨時故障造成部分營收損失。'}
];

export function webRealEstateUpgradeCost(building,level) {
  if(!building||level>=WEB_REAL_ESTATE_MAX_LEVEL) return null;
  return Math.round(building.cost*(.22+level*.08));
}

export function webRealEstateRevenue(building,level,condition,eventMultiplier=1) {
  const levelMultiplier=1+(Math.max(1,level)-1)*.12;
  const conditionMultiplier=.7+Math.max(40,Math.min(100,condition))*.003;
  return Math.floor(building.baseRevenue*levelMultiplier*conditionMultiplier*eventMultiplier);
}
