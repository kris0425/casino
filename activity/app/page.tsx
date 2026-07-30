"use client";

import { useMemo, useState } from "react";

type Choice = { id: string; name: string; price: number; note?: string; color?: string };

const paints: Choice[] = [
  { id: "white", name: "珍珠白", price: 15000, color: "#f3f5f7" },
  { id: "black", name: "曜石黑", price: 15000, color: "#17191d" },
  { id: "yellow", name: "競速黃", price: 18000, color: "#ffd400" },
  { id: "red", name: "烈焰紅", price: 18000, color: "#e1212d" },
  { id: "blue", name: "電光藍", price: 18000, color: "#1768f2" },
  { id: "purple", name: "午夜紫", price: 25000, color: "#8229d9" },
  { id: "green", name: "翡翠綠", price: 25000, color: "#13a95d" },
];

const kits: Choice[] = [
  { id: "stock", name: "原廠車身", price: 0, note: "經典 R34 線條" },
  { id: "liberty_walk", name: "Liberty Walk", price: 180000, note: "街道寬體・操控 +1" },
  { id: "rocket_bunny", name: "Rocket Bunny", price: 220000, note: "鉚釘寬體・加速 +1" },
  { id: "competition", name: "賽事級空力", price: 350000, note: "最高下壓力・操控 +2" },
];

const wheels: Choice[] = [
  { id: "stock", name: "原廠輪框", price: 0, note: "標準配置" },
  { id: "te37", name: "Volk TE37", price: 60000, note: "鍛造輕量・操控 +1" },
  { id: "bbs_lm", name: "BBS LM", price: 85000, note: "多片式・操控 +1" },
  { id: "forged", name: "競技鍛造", price: 120000, note: "加速 +1・操控 +1" },
];

const availability: Record<string, Record<string, string[]>> = {
  white: { stock: ["stock", "te37", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["te37", "bbs_lm", "forged"] },
  black: { stock: ["stock", "te37", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["te37", "bbs_lm", "forged"] },
  yellow: { stock: ["stock", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["stock", "te37", "bbs_lm", "forged"] },
  red: { stock: ["stock", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["te37", "bbs_lm", "forged"] },
  blue: { stock: ["stock", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["te37", "bbs_lm", "forged"] },
  purple: { stock: ["stock", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["bbs_lm", "forged"] },
  green: { stock: ["stock", "te37", "bbs_lm", "forged"], liberty_walk: ["te37", "bbs_lm", "forged"], rocket_bunny: ["forged"], competition: ["bbs_lm", "forged"] },
};

const price = (value: number) => value.toLocaleString("zh-TW");
const find = (choices: Choice[], id: string) => choices.find((choice) => choice.id === id)!;

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div className="rating-row">
      <span>{label}</span>
      <div className="rating-track" aria-label={`${label} ${value} / 5`}>
        {[1, 2, 3, 4, 5].map((step) => <i key={step} className={step <= value ? "filled" : ""} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const [paint, setPaint] = useState("white");
  const [kit, setKit] = useState("stock");
  const [wheel, setWheel] = useState("stock");
  const [panel, setPanel] = useState<"paint" | "kit" | "wheel">("paint");
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectPaint = (next: string) => {
    const nextKit = availability[next][kit] ? kit : Object.keys(availability[next])[0];
    const allowedWheels = availability[next][nextKit];
    setPaint(next);
    setKit(nextKit);
    if (!allowedWheels.includes(wheel)) setWheel(allowedWheels[0]);
    setSaved(false);
  };

  const selectKit = (next: string) => {
    const allowedWheels = availability[paint][next];
    setKit(next);
    if (!allowedWheels.includes(wheel)) setWheel(allowedWheels[0]);
    setSaved(false);
  };

  const image = `/cars/r34/${paint}_${kit}_${wheel}_stock.jpg`;
  const total = find(paints, paint).price + find(kits, kit).price + find(wheels, wheel).price;
  const ratings = useMemo(() => {
    const speed = kit === "competition" ? 5 : 4;
    const acceleration = wheel === "forged" || kit === "rocket_bunny" ? 5 : 4;
    const handling = kit === "competition" ? 5 : kit !== "stock" || wheel !== "stock" ? 5 : 4;
    return { speed, acceleration, handling };
  }, [kit, wheel]);

  return (
    <main className="shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand"><span className="brand-mark">M</span><div><b>澳門最大賭場</b><small>YOKOHAMA MOD LAB</small></div></div>
        <div className="top-actions"><span className="prototype"><i /> PROTOTYPE</span><button className="wallet"><span>金庫餘額</span><b>1,280,000</b></button></div>
      </header>

      <section className="garage-layout">
        <div className="stage-column">
          <div className="vehicle-heading">
            <div><span className="eyebrow">LEGENDARY / JDM</span><h1>白銀戰神 <strong>R34</strong></h1></div>
            <button className="car-picker">目前車輛 <b>Nissan Skyline GT-R</b><span>⌄</span></button>
          </div>

          <div className="car-stage">
            <img key={image} src={image} alt={`${find(paints, paint).name}、${find(kits, kit).name}、${find(wheels, wheel).name}的白銀戰神 R34`} />
            <div className="live-pill"><i /> 即時預覽</div>
            <div className="car-caption">
              <div><span>目前外觀</span><b>{find(paints, paint).name} · {find(kits, kit).name} · {find(wheels, wheel).name}</b></div>
              <span className="image-count">80 組實車素材</span>
            </div>
          </div>

          <div className="performance-card">
            <div className="performance-copy"><span className="eyebrow">TUNING SCORE</span><b>{kit === "competition" ? "S" : kit === "stock" ? "A" : "A+"}</b><small>綜合改裝評級</small></div>
            <div className="ratings"><Rating label="速度" value={ratings.speed} /><Rating label="加速" value={ratings.acceleration} /><Rating label="操控" value={ratings.handling} /></div>
            <div className="bonus"><span>搶劫逃脫</span><b>+{kit === "competition" ? 5 : kit === "rocket_bunny" ? 4 : kit === "liberty_walk" ? 3 : 2}%</b><small>依目前套件估算</small></div>
          </div>
        </div>

        <aside className="configurator">
          <div className="config-head"><div><span className="eyebrow">CUSTOMIZE</span><h2>外觀改裝</h2></div><span className="step">01 / 03</span></div>
          <nav className="tabs" aria-label="改裝分類">
            <button className={panel === "paint" ? "active" : ""} onClick={() => setPanel("paint")}><span>◉</span>烤漆</button>
            <button className={panel === "kit" ? "active" : ""} onClick={() => setPanel("kit")}><span>◆</span>寬體</button>
            <button className={panel === "wheel" ? "active" : ""} onClick={() => setPanel("wheel")}><span>✺</span>輪框</button>
          </nav>

          <div className="options-scroll">
            {panel === "paint" && <div className="paint-grid">{paints.map((item) => <button key={item.id} className={`paint-option ${paint === item.id ? "selected" : ""}`} onClick={() => selectPaint(item.id)}><i style={{ background: item.color }} /><span><b>{item.name}</b><small>{price(item.price)} 金幣</small></span><em>✓</em></button>)}</div>}
            {panel === "kit" && <div className="choice-list">{kits.map((item) => <button key={item.id} className={kit === item.id ? "selected" : ""} onClick={() => selectKit(item.id)}><span><b>{item.name}</b><small>{item.note}</small></span><strong>{item.price ? price(item.price) : "已擁有"}</strong></button>)}</div>}
            {panel === "wheel" && <div className="choice-list">{wheels.map((item) => { const enabled = availability[paint][kit].includes(item.id); return <button key={item.id} disabled={!enabled} className={wheel === item.id ? "selected" : ""} onClick={() => { setWheel(item.id); setSaved(false); }}><span><b>{item.name}</b><small>{enabled ? item.note : "此車身尚無對應素材"}</small></span><strong>{item.price ? price(item.price) : "已擁有"}</strong></button>; })}</div>}
          </div>

          <div className="checkout">
            <div><span>本次改裝預估</span><b>{price(total)} <small>金幣</small></b></div>
            <button className="confirm-button" onClick={() => setConfirming(true)}><span>{saved ? "已套用展示" : "確認改裝"}</span><i>→</i></button>
            <p>原型模式不會扣除正式金幣</p>
          </div>
        </aside>
      </section>

      {confirming && <div className="modal-backdrop" onMouseDown={() => setConfirming(false)}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setConfirming(false)}>×</button><span className="modal-icon">✓</span><span className="eyebrow">PREVIEW CONFIRMATION</span><h2 id="confirm-title">套用這組改裝？</h2><p>{find(paints, paint).name} · {find(kits, kit).name} · {find(wheels, wheel).name}</p><div className="modal-price"><span>正式串接後扣款</span><b>{price(total)} 金幣</b></div><button className="confirm-button" onClick={() => { setSaved(true); setConfirming(false); }}>套用於展示 <i>→</i></button><small>這是測試原型，不會變更 Discord 車庫資料。</small></section></div>}
    </main>
  );
}
