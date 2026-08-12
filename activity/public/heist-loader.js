const mode=document.querySelector('#renderMode');
function loadFallback(reason){
  mode.textContent='2D 相容模式';
  mode.classList.add('fallback');
  console.warn('3D 模式無法啟動，已切換 2D：',reason);
  const script=document.createElement('script');
  script.src='/heist.js?v=20260812.8';
  document.body.append(script);
}
try {
  const canvas=document.querySelector('#heistCanvas');
  const probe=canvas.getContext('webgl2',{failIfMajorPerformanceCaveat:true});
  if(!probe) throw new Error('裝置不支援 WebGL 2');
  const module=await import('/heist-3d.js?v=20260812.8');
  await module.start3DHeist();
  mode.textContent='3D 模式';
  document.querySelector('#gameFrame').classList.add('mode-3d');
} catch(error) {
  const old=document.querySelector('#heistCanvas');
  const replacement=old.cloneNode(false);
  old.replaceWith(replacement);
  loadFallback(error?.message||error);
}
