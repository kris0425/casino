export const COSMETIC_SLOTS=['character','background','outfit','headwear','face','handheld','aura'];

export const COSMETIC_SLOT_LABELS={
  character:'人物',background:'背景',outfit:'服裝',headwear:'頭飾',face:'臉部',handheld:'手持物',aura:'光環／邊框'
};

export const cosmeticCatalog=[
  {id:'casino_character',slot:'character',theme:'賭場之王',name:'黑金首席荷官',icon:'♦️',price:0,starter:true,image:'casino-host.png',style:'casino'},
  {id:'transport_character',slot:'character',theme:'交通大亨',name:'銀翼運輸指揮官',icon:'🛫',price:20_000_000,image:'transport-commander.png',style:'transport'},
  {id:'heist_character',slot:'character',theme:'暗夜劫案',name:'紫影情報專員',icon:'🌙',price:30_000_000,image:'night-agent.png',style:'heist'},
  {id:'pomeranian_character',slot:'character',theme:'萌犬航空',name:'粉雲萌犬機長',icon:'🐾',price:40_000_000,image:'pomeranian-captain.png',style:'pomeranian'},
  {id:'garage_character',slot:'character',theme:'黑曜車庫',name:'黑曜車庫總監',icon:'🔧',price:35_000_000,image:'garage-director.png',style:'garage'},
  {id:'rail_character',slot:'character',theme:'星穹鐵路',name:'星穹鐵路總裁',icon:'🚄',price:38_000_000,image:'rail-president.png',style:'rail'},
  {id:'casino_background',slot:'background',theme:'賭場之王',name:'黑金至尊廳',icon:'♠️',price:0,starter:true,image:'casino-king.png',style:'casino'},
  {id:'casino_outfit',slot:'outfit',theme:'賭場之王',name:'黑金晚宴西裝',icon:'🤵',price:0,starter:true,image:'casino/outfit.png',style:'casino'},
  {id:'casino_headwear',slot:'headwear',theme:'賭場之王',name:'籌碼王冠',icon:'👑',price:0,starter:true,image:'casino/headwear.png',style:'casino'},
  {id:'casino_face',slot:'face',theme:'賭場之王',name:'金框墨鏡',icon:'😎',price:0,starter:true,image:'casino/face.png',style:'casino'},
  {id:'casino_handheld',slot:'handheld',theme:'賭場之王',name:'至尊籌碼箱',icon:'🎰',price:0,starter:true,image:'casino/handheld.png',style:'casino'},
  {id:'casino_aura',slot:'aura',theme:'賭場之王',name:'黃金派彩光環',icon:'✨',price:0,starter:true,style:'casino'},
  {id:'transport_background',slot:'background',theme:'交通大亨',name:'未來轉運總站',icon:'🌐',price:5_000_000,image:'transport-mogul.png',style:'transport'},
  {id:'transport_outfit',slot:'outfit',theme:'交通大亨',name:'企業總裁制服',icon:'🧥',price:8_000_000,image:'transport/outfit.png',style:'transport'},
  {id:'transport_headwear',slot:'headwear',theme:'交通大亨',name:'銀翼站長帽',icon:'🧢',price:3_000_000,image:'transport/headwear.png',style:'transport'},
  {id:'transport_face',slot:'face',theme:'交通大亨',name:'航線分析鏡',icon:'🥽',price:2_000_000,image:'transport/face.png',style:'transport'},
  {id:'transport_handheld',slot:'handheld',theme:'交通大亨',name:'企業調度平板',icon:'📱',price:4_000_000,image:'transport/handheld.png',style:'transport'},
  {id:'transport_aura',slot:'aura',theme:'交通大亨',name:'環球航線光環',icon:'🛰️',price:6_000_000,style:'transport'},
  {id:'heist_background',slot:'background',theme:'暗夜劫案',name:'雨夜撤離天台',icon:'🌃',price:8_000_000,image:'night-heist.png',style:'heist'},
  {id:'heist_outfit',slot:'outfit',theme:'暗夜劫案',name:'幽影戰術風衣',icon:'🥷',price:12_000_000,image:'heist/outfit.png',style:'heist'},
  {id:'heist_headwear',slot:'headwear',theme:'暗夜劫案',name:'無聲夜行帽',icon:'🕶️',price:4_000_000,image:'heist/headwear.png',style:'heist'},
  {id:'heist_face',slot:'face',theme:'暗夜劫案',name:'霓虹變裝面罩',icon:'🎭',price:3_000_000,image:'heist/face.png',style:'heist'},
  {id:'heist_handheld',slot:'handheld',theme:'暗夜劫案',name:'加密撤離箱',icon:'💼',price:6_000_000,image:'heist/handheld.png',style:'heist'},
  {id:'heist_aura',slot:'aura',theme:'暗夜劫案',name:'紅藍追緝殘影',icon:'🚨',price:10_000_000,style:'heist'},
  {id:'pomeranian_background',slot:'background',theme:'萌犬航空',name:'粉紅雲端客艙',icon:'☁️',price:12_000_000,image:'pomeranian-air.png',style:'pomeranian'},
  {id:'pomeranian_outfit',slot:'outfit',theme:'萌犬航空',name:'萌犬機長禮服',icon:'🎀',price:18_000_000,image:'pomeranian/outfit.png',style:'pomeranian'},
  {id:'pomeranian_headwear',slot:'headwear',theme:'萌犬航空',name:'博美雲朵機長帽',icon:'🐶',price:6_000_000,image:'pomeranian/headwear.png',style:'pomeranian'},
  {id:'pomeranian_face',slot:'face',theme:'萌犬航空',name:'蜜桃愛心眼鏡',icon:'💖',price:5_000_000,image:'pomeranian/face.png',style:'pomeranian'},
  {id:'pomeranian_handheld',slot:'handheld',theme:'萌犬航空',name:'迷你萌犬行李箱',icon:'🧳',price:8_000_000,image:'pomeranian/handheld.png',style:'pomeranian'},
  {id:'pomeranian_aura',slot:'aura',theme:'萌犬航空',name:'雲朵愛心光環',icon:'💕',price:14_000_000,style:'pomeranian'}
];

export const cosmeticById=Object.fromEntries(cosmeticCatalog.map(item=>[item.id,item]));

export const defaultAppearance=Object.fromEntries(
  COSMETIC_SLOTS.map(slot=>[slot,cosmeticCatalog.find(item=>item.slot===slot&&item.starter)?.id||null])
);
