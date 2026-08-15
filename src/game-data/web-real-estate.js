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

export const WEB_CITY_SIZE=12;
export const WEB_CITY_TICK_MS=5*60*1000;
export const WEB_CITY_TOOLS={
  road:{name:'道路',icon:'🛣️',cost:25_000,description:'所有分區都必須緊鄰道路'},
  residential:{name:'住宅區',icon:'🏠',cost:120_000,description:'吸引居民入住並增加人口'},
  commercial:{name:'商業區',icon:'🏬',cost:200_000,description:'提供工作與較高稅收'},
  industrial:{name:'工業區',icon:'🏭',cost:280_000,description:'大量工作與稅收，但會降低鄰近滿意度'},
  power:{name:'發電站',icon:'⚡',cost:2_500_000,description:'供應 30 格分區所需電力'},
  park:{name:'城市公園',icon:'🌳',cost:450_000,description:'提高周圍居民滿意度'},
  bulldoze:{name:'拆除',icon:'🚧',cost:10_000,description:'清除建築或道路，不退還建造費'}
};

export function createWebCityTiles(size=WEB_CITY_SIZE) {
  const tiles=[];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) tiles.push({x,y,type:'grass',level:0,occupancy:0});
  const set=(x,y,type)=>Object.assign(tiles[y*size+x],{type,level:type==='power'?1:0});
  for(let x=2;x<=9;x++) set(x,6,'road');
  for(let y=3;y<=9;y++) set(5,y,'road');
  set(3,8,'power');set(4,8,'road');
  return tiles;
}

export function webCityStats(tiles) {
  const zones=tiles.filter(tile=>['residential','commercial','industrial'].includes(tile.type));
  const population=tiles.filter(tile=>tile.type==='residential').reduce((sum,tile)=>sum+(tile.occupancy||0),0);
  const jobs=tiles.filter(tile=>['commercial','industrial'].includes(tile.type)).reduce((sum,tile)=>sum+Math.round((tile.occupancy||0)*(tile.type==='industrial'?1.25:.9)),0);
  const powerSupply=tiles.filter(tile=>tile.type==='power').length*30,powerDemand=zones.length;
  const parks=tiles.filter(tile=>tile.type==='park').length,industry=tiles.filter(tile=>tile.type==='industrial').length;
  const happiness=Math.max(25,Math.min(100,Math.round(58+parks*4-Math.max(0,industry-parks)*1.5+(powerSupply>=powerDemand?8:-18))));
  const developed=zones.filter(tile=>tile.level>0).length;
  return {population,jobs,happiness,powerSupply,powerDemand,developed,zones:zones.length,roads:tiles.filter(tile=>tile.type==='road').length,parks};
}

export function webRealEstateUpgradeCost(building,level) {
  if(!building||level>=WEB_REAL_ESTATE_MAX_LEVEL) return null;
  return Math.round(building.cost*(.22+level*.08));
}

export function webRealEstateRevenue(building,level,condition,eventMultiplier=1) {
  const levelMultiplier=1+(Math.max(1,level)-1)*.12;
  const conditionMultiplier=.7+Math.max(40,Math.min(100,condition))*.003;
  return Math.floor(building.baseRevenue*levelMultiplier*conditionMultiplier*eventMultiplier);
}
