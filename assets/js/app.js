/* =====================================================================
   EDITION PDF — application
   Rendu pdf.js, génération pdf-lib, bibliothèque IndexedDB chiffrée.
   Rien ne quitte l'appareil.
   ===================================================================== */
"use strict";

/* ---------------------------------------------------------------------
   0. Utilitaires
   ------------------------------------------------------------------ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const uid = ()=> Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isSmall = ()=> matchMedia('(max-width:900px)').matches;
/* lie une même action au bouton bureau et à sa variante mobile */
const bind = (ids, fn)=> ids.forEach(id=>{ const el=$(id); if(el) el.onclick = fn; });

let toastT;
let deferredPrompt = null;   // requête d'installation PWA, captée plus bas
function toast(msg, kind){
  const el=$('#toast'); el.textContent=msg;
  el.style.borderLeftColor = kind==='err'?'var(--stamp)':kind==='ok'?'var(--ok)':'var(--ink)';
  el.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'),3400);
}
function modal(html){ $('#modal').innerHTML=html; $('#mask').classList.add('on'); }
function closeModal(){ $('#mask').classList.remove('on'); $('#modal').innerHTML=''; }
window.closeModal = closeModal;
$('#mask').addEventListener('pointerdown', e=>{ if(e.target.id==='mask') closeModal(); });

/* composant de choix de couleur : pastille lisible + pipette native masquée */
const PRESETS = {
  text: ['#111133','#000000','#1a4fd6','#c62828','#1b7a4b','#6d4c41'],
  hl:   ['#ffe14d','#b6f2a1','#9fd8ff','#ffb3d9','#ffc48a','#d6c2ff']
};
/* Les dernières couleurs retenues sont proposées en tête de la rangée du bas. */
function recentColors(kind){
  try{ return JSON.parse(localStorage.getItem('pdfed.colors.'+kind) || '[]'); }catch(e){ return []; }
}
function pushRecent(kind, c){
  c = String(c).toLowerCase();
  const l = recentColors(kind).filter(x=>x.toLowerCase()!==c);
  l.unshift(c);
  localStorage.setItem('pdfed.colors.'+kind, JSON.stringify(l.slice(0,6)));
}
function paletteFor(kind, current){
  const seen = new Set(), out = [];
  for(const c of [...recentColors(kind), ...PRESETS[kind], current]){
    const k = String(c).toLowerCase();
    if(!seen.has(k)){ seen.add(k); out.push(c); }
  }
  return out.slice(0,10);
}
function swatchHtml(id, color, disabled, kind='text'){
  return `<label class="swatch" style="--c:${esc(color)}"><i></i>
    <input type="color" id="${id}" value="${esc(color)}" ${disabled?'disabled':''}>
    <b>${esc(color.toUpperCase())}</b></label>
    <div class="presets" id="${id}-p">${paletteFor(kind, color).map(c=>
      `<button type="button" data-c="${c}" style="background:${c}"
        class="${c.toLowerCase()===color.toLowerCase()?'on':''}" ${disabled?'disabled':''}
        aria-label="${c}"></button>`).join('')}</div>`;
}
function bindSwatch(id, onChange, kind='text'){
  const input = $('#'+id); if(!input) return;
  const label = input.closest('.swatch');
  const paint = v=>{
    label.style.setProperty('--c', v);
    $('b', label).textContent = v.toUpperCase();
    $$('#'+id+'-p button').forEach(b=>b.classList.toggle('on', b.dataset.c.toLowerCase()===v.toLowerCase()));
  };
  input.oninput = e=>{ paint(e.target.value); onChange(e.target.value, false); };
  input.onchange = e=>{ pushRecent(kind, e.target.value); onChange(e.target.value, true); };
  $$('#'+id+'-p button').forEach(b=> b.onclick = ()=>{
    input.value = b.dataset.c; paint(b.dataset.c);
    pushRecent(kind, b.dataset.c); onChange(b.dataset.c, true);
  });
}

/* ---------------------------------------------------------------------
   1. Thème
   ------------------------------------------------------------------ */
const THEMES = ['system','light','dark'];
const mqLight = matchMedia('(prefers-color-scheme: light)');
const curTheme = ()=> localStorage.getItem('pdfed.theme') || 'system';
function applyTheme(th){
  document.documentElement.dataset.theme = th;
  document.documentElement.classList.toggle('sys-light', th==='system' && mqLight.matches);
  localStorage.setItem('pdfed.theme', th);
  const light = th==='light' || (th==='system' && mqLight.matches);
  $('#metaTheme').content = light ? '#f5f6fa' : '#1f2230';
  if($('#settings').innerHTML) renderSettings();
}
mqLight.addEventListener('change', ()=>{ if(curTheme()==='system') applyTheme('system'); });
applyTheme(curTheme());

/* ---------------------------------------------------------------------
   2. Langue
   ------------------------------------------------------------------ */
/* Drapeaux dessinés en SVG plutôt qu'en emoji : le rendu des emoji drapeaux
   est absent sous Windows et incohérent selon les plateformes. */
const FLAGS = {
  fr:'<rect width="6" height="14" fill="#0b4ea2"/><rect x="6" width="7" height="14" fill="#fff"/><rect x="13" width="6" height="14" fill="#d7222a"/>',
  en:'<rect width="19" height="14" fill="#012169"/><path d="M0 0L19 14M19 0L0 14" stroke="#fff" stroke-width="2.8"/><path d="M0 0L19 14M19 0L0 14" stroke="#c8102e" stroke-width="1.6"/><path d="M9.5 0V14M0 7H19" stroke="#fff" stroke-width="4.4"/><path d="M9.5 0V14M0 7H19" stroke="#c8102e" stroke-width="2.6"/>',
  de:'<rect width="19" height="4.67" fill="#000"/><rect y="4.67" width="19" height="4.67" fill="#dd0000"/><rect y="9.33" width="19" height="4.67" fill="#ffce00"/>',
  es:'<rect width="19" height="14" fill="#aa151b"/><rect y="3.5" width="19" height="7" fill="#f1bf00"/>',
  it:'<rect width="6.33" height="14" fill="#008c45"/><rect x="6.33" width="6.34" height="14" fill="#fff"/><rect x="12.67" width="6.33" height="14" fill="#cd212a"/>',
  uk:'<rect width="19" height="7" fill="#0057b7"/><rect y="7" width="19" height="7" fill="#ffd700"/>',
  cs:'<rect width="19" height="7" fill="#fff"/><rect y="7" width="19" height="7" fill="#d7141a"/><path d="M0 0L9.5 7L0 14Z" fill="#11457e"/>'
};
const flagSvg = code => `<svg class="flag" viewBox="0 0 19 14" aria-hidden="true">${FLAGS[code]||''}</svg>`;

/* Réglages : langue, thème, aide et installation vivent dans le panneau Propriétés. */
function renderSettings(){
  const box = $('#settings');
  box.innerHTML = `
    <h4>${esc(t('insp.settings'))}</h4>
    <label class="f">${esc(t('nav.language'))}</label>
    <div class="langsel" id="langSel">
      ${LANGS.map(l=>`<button data-l="${l.code}" class="${l.code===LANG?'on':''}">
        ${flagSvg(l.code)}<span>${esc(l.label)}</span></button>`).join('')}
    </div>
    <label class="f">${esc(t('nav.theme'))}</label>
    <div class="seg" id="themeSeg">
      ${THEMES.map(th=>`<button data-t="${th}" class="${th===curTheme()?'on':''}">
        ${esc(t(th==='system'?'nav.themeSystem':th==='light'?'nav.themeLight':'nav.themeDark'))}</button>`).join('')}
    </div>
    <div class="row" style="margin-top:12px">
      <button id="setHelp">${esc(t('nav.help'))}</button>
    </div>
    <div class="row" style="margin-top:6px${deferredPrompt?'':';display:none'}">
      <button id="setInstall" class="primary">${esc(t('nav.install'))}</button>
    </div>`;
  $$('#langSel button').forEach(b=> b.onclick = ()=>setLang(b.dataset.l));
  $$('#themeSeg button').forEach(b=> b.onclick = ()=>applyTheme(b.dataset.t));
  $('#setHelp').onclick = ()=>showSplash(false);
  $('#setInstall').onclick = doInstall;
}

/* appelée par i18n.js après chaque changement de langue */
function onLangChange(){
  $('#docName').textContent = Doc.name || t('nav.noDoc');
  fitDocName();
  libRender();
  renderSettings();
  drawItems();
  if(Doc.pdf) $('#pTot').textContent = '/ ' + Doc.total;
}
/* Un nom de fichier trop long ne doit pas être tronqué : il passe sur sa propre ligne. */
function fitDocName(){
  const el = $('#docName');
  el.classList.remove('full');
  if(el.scrollWidth > el.clientWidth + 1) el.classList.add('full');
}

/* ---------------------------------------------------------------------
   3. Tiroirs (mobile)
   ------------------------------------------------------------------ */
function drawer(sel, open){
  const el=$(sel);
  const willOpen = open===undefined ? !el.classList.contains('open') : open;
  $$('aside').forEach(a=>a.classList.remove('open'));
  el.classList.toggle('open', willOpen);
  $('#scrim').classList.toggle('on', willOpen && isSmall());
}
$('#btnLib').onclick    = ()=>drawer('#paneLib');
$('#btnInsp').onclick   = ()=>drawer('#paneInsp');
$('#closeLib').onclick  = ()=>drawer('#paneLib', false);
$('#closeInsp').onclick = ()=>drawer('#paneInsp', false);
$('#scrim').onclick     = ()=>{ $$('aside').forEach(a=>a.classList.remove('open')); $('#scrim').classList.remove('on'); };

/* ---------------------------------------------------------------------
   4. Stockage : IndexedDB + chiffrement AES-GCM optionnel
   ------------------------------------------------------------------ */
const DB_NAME='pdfed-vault', DB_VER=1;
let _db=null;
function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{ const d=r.result;
      if(!d.objectStoreNames.contains('assets')) d.createObjectStore('assets',{keyPath:'id'});
      if(!d.objectStoreNames.contains('meta'))   d.createObjectStore('meta',{keyPath:'key'});
    };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
}
async function db(){ if(!_db) _db=await openDB(); return _db; }
function req(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function dbGetAll(st){ const d=await db(); return req(d.transaction(st,'readonly').objectStore(st).getAll()); }
async function dbGet(st,k){ const d=await db(); return req(d.transaction(st,'readonly').objectStore(st).get(k)); }
async function dbPut(st,v){ const d=await db(); return req(d.transaction(st,'readwrite').objectStore(st).put(v)); }
async function dbDel(st,k){ const d=await db(); return req(d.transaction(st,'readwrite').objectStore(st).delete(k)); }
async function dbClear(st){ const d=await db(); return req(d.transaction(st,'readwrite').objectStore(st).clear()); }

const Vault = {
  enabled:false, key:null, salt:null, verifier:null,
  async init(){
    const m = await dbGet('meta','crypto');
    if(m){ this.enabled=true; this.salt=m.salt; this.verifier=m.verifier; }
  },
  get locked(){ return this.enabled && !this.key; },
  async derive(pass, salt){
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'},
      base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  },
  async _enc(key, bytes){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return {iv, data: await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, bytes)};
  },
  _dec(key, iv, data){ return crypto.subtle.decrypt({name:'AES-GCM',iv}, key, data); },
  async enable(pass){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await this.derive(pass, salt);
    const v    = await this._enc(key, new TextEncoder().encode('PDFED-OK'));
    for(const a of await dbGetAll('assets')){
      if(a.enc) continue;
      const e = await this._enc(key, a.data);
      await dbPut('assets', {...a, enc:true, iv:e.iv, data:e.data});
    }
    await dbPut('meta', {key:'crypto', salt, verifier:v});
    Object.assign(this,{enabled:true, salt, verifier:v, key});
  },
  async unlock(pass){
    const key = await this.derive(pass, this.salt);
    try{ await this._dec(key, this.verifier.iv, this.verifier.data); }catch(e){ return false; }
    this.key = key; return true;
  },
  lock(){ this.key = null; },
  async disable(){
    if(!this.key) throw new Error('locked');
    for(const a of await dbGetAll('assets')){
      if(!a.enc) continue;
      await dbPut('assets', {...a, enc:false, iv:null, data: await this._dec(this.key, a.iv, a.data)});
    }
    await dbDel('meta','crypto');
    Object.assign(this,{enabled:false, key:null, salt:null, verifier:null});
  },
  async pack(bytes){
    if(!this.enabled) return {enc:false, iv:null, data:bytes};
    if(!this.key) throw new Error('locked');
    const e = await this._enc(this.key, bytes);
    return {enc:true, iv:e.iv, data:e.data};
  },
  unpack(a){
    if(!a.enc) return Promise.resolve(a.data);
    if(!this.key) return Promise.reject(new Error('locked'));
    return this._dec(this.key, a.iv, a.data);
  }
};

/* ---------------------------------------------------------------------
   5. Bibliothèque
   ------------------------------------------------------------------ */
const Lib = { assets:[], urls:new Map() };

async function libLoad(){
  Lib.assets = (await dbGetAll('assets')).sort((a,b)=>b.created-a.created);
  await libRender();
}
function revokeUrls(){ Lib.urls.forEach(u=>URL.revokeObjectURL(u)); Lib.urls.clear(); }
async function assetUrl(a){
  if(Lib.urls.has(a.id)) return Lib.urls.get(a.id);
  const url = URL.createObjectURL(new Blob([await Vault.unpack(a)], {type:a.mime}));
  Lib.urls.set(a.id, url); return url;
}
async function assetBytes(a){ return new Uint8Array(await Vault.unpack(a)); }

async function libRender(){
  const body = $('#libBody');
  $('#btnVault').textContent = Vault.enabled ? (Vault.key?'🔓':'🔒') : '🔒';
  $('#btnVault').title = Vault.enabled
    ? (Vault.key ? t('lib.vaultUnlocked') : t('lib.vaultLocked'))
    : t('lib.protect');

  if(Vault.locked){
    body.innerHTML = `<div class="stack">
      <div class="empty">${esc(t('lib.lockedMsg'))}</div>
      <input type="password" id="qpass" placeholder="${esc(t('lib.password'))}" autocomplete="current-password">
      <button class="primary" id="qunlock">${esc(t('lib.unlock'))}</button></div>`;
    $('#qunlock').onclick = async ()=>{
      if(await Vault.unlock($('#qpass').value)){ await libLoad(); drawItems(); toast(t('t.vaultUnlocked'),'ok'); }
      else toast(t('t.wrongPassword'),'err');
    };
    $('#qpass').onkeydown = e=>{ if(e.key==='Enter') $('#qunlock').click(); };
    return;
  }
  if(!Lib.assets.length){ body.innerHTML = `<div class="empty">${esc(t('lib.empty'))}</div>`; return; }

  body.innerHTML = `<div class="lib">${Lib.assets.map(a=>`
    <div class="asset" data-id="${a.id}">
      <div class="thumb" data-act="place" title="${esc(t('lib.place'))}"><img alt="${esc(a.name)}"></div>
      <div class="nm" title="${esc(a.name)} — ${a.w}×${a.h}">${esc(a.name)}</div>
      <div class="acts">
        <button data-act="rename" title="${esc(t('lib.rename'))}">✎</button>
        <button data-act="cut"    title="${esc(t('lib.cutout'))}">◑</button>
        <button data-act="dl"     title="${esc(t('lib.download'))}">↓</button>
        <button data-act="del"    title="${esc(t('lib.delete'))}">🗑</button>
      </div>
    </div>`).join('')}</div>`;
  for(const a of Lib.assets){
    const img = $(`.asset[data-id="${a.id}"] img`);
    if(img) try{ img.src = await assetUrl(a); }catch(e){}
  }
}
$('#libBody').addEventListener('click', e=>{
  const btn = e.target.closest('[data-act]'); if(!btn) return;
  const a = Lib.assets.find(x=>x.id === btn.closest('.asset')?.dataset.id); if(!a) return;
  ({place:placeImage, rename:renameAsset, del:deleteAsset, dl:downloadAsset, cut:cutoutAsset}[btn.dataset.act])(a);
});

/* --- import --- */
function fileToImage(file){
  const url = URL.createObjectURL(file);
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>{ res(i); setTimeout(()=>URL.revokeObjectURL(url),4000); };
    i.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('image')); };
    i.src=url;
  });
}
function canvasToBytes(cv, mime, q){
  return new Promise(res=> cv.toBlob(async b=> res(new Uint8Array(await b.arrayBuffer())), mime, q));
}
async function addAsset(name, bytes, mime, w, h){
  const rec = {id:uid(), name, mime, w, h, created:Date.now(), ...(await Vault.pack(bytes.buffer||bytes))};
  await dbPut('assets', rec);
  await libLoad();
  return rec;
}
async function importFiles(files){
  if(Vault.locked){ toast(t('t.unlockFirst'),'err'); return; }
  let n=0;
  for(const f of files){
    if(!/^image\//.test(f.type) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) continue;
    try{
      const img = await fileToImage(f);
      const isJpg = /jpe?g/i.test(f.type) || /\.jpe?g$/i.test(f.name);
      const k = Math.min(1, 2200/Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width  = Math.max(1, Math.round(img.naturalWidth*k));
      cv.height = Math.max(1, Math.round(img.naturalHeight*k));
      const ctx = cv.getContext('2d');
      if(isJpg){ ctx.fillStyle='#fff'; ctx.fillRect(0,0,cv.width,cv.height); }
      ctx.drawImage(img,0,0,cv.width,cv.height);
      const mime = isJpg ? 'image/jpeg' : 'image/png';
      await addAsset(f.name.replace(/\.[^.]+$/,''), await canvasToBytes(cv,mime,.92), mime, cv.width, cv.height);
      n++;
    }catch(err){ console.error(err); }
  }
  toast(n ? t('t.imagesAdded',{n}) : t('t.noImages'), n?'ok':'err');
}
$('#btnImport').onclick = ()=> $('#fileImg').click();
$('#fileImg').onchange  = e=>{ importFiles([...e.target.files]); e.target.value=''; };

function renameAsset(a){
  modal(`<h3>${esc(t('m.rename'))}</h3><p>${esc(t('m.renameHint'))}</p>
    <input type="text" id="rn" value="${esc(a.name)}">
    <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
      <button class="primary" id="rok">${esc(t('m.rename'))}</button></div>`);
  $('#rn').select();
  $('#rok').onclick = async ()=>{
    const v=$('#rn').value.trim(); if(!v) return;
    await dbPut('assets', {...a, name:v}); closeModal(); await libLoad(); drawItems(); toast(t('t.nameUpdated'),'ok');
  };
}
function deleteAsset(a){
  modal(`<h3>${esc(t('m.delTitle',{name:a.name}))}</h3><p>${esc(t('m.delBody'))}</p>
    <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
      <button class="primary" id="dok">${esc(t('m.delete'))}</button></div>`);
  $('#dok').onclick = async ()=>{
    await dbDel('assets', a.id);
    const u=Lib.urls.get(a.id); if(u){ URL.revokeObjectURL(u); Lib.urls.delete(a.id); }
    closeModal(); await libLoad(); drawItems(); toast(t('t.imageDeleted'),'ok');
  };
}
async function downloadAsset(a){
  const el=document.createElement('a');
  el.href = await assetUrl(a);
  el.download = a.name + (a.mime==='image/jpeg'?'.jpg':'.png');
  el.click();
}

/* --- effacement total, confirmé dans les deux cas -------------------- */
$('#btnWipe').onclick = wipeLibrary;
async function wipeLibrary(){
  let n = Lib.assets.length;
  if(Vault.locked){ try{ n = (await dbGetAll('assets')).length; }catch(e){ n = '?'; } }
  if(!n && !Vault.enabled){ toast(t('t.libEmpty')); return; }

  const placed = Doc.items.filter(i=>i.type==='image').length;
  const warn = placed ? `<p>${esc(t('m.wipePlaced',{n:placed}))}</p>` : '';

  if(Vault.locked){
    const word = t('m.wipeWord');
    modal(`<h3>${esc(t('m.wipeTitle'))}</h3><p>${esc(t('m.wipeLocked',{n}))}</p>${warn}
      <label class="f">${esc(t('m.wipeType',{word}))}</label>
      <input type="text" id="wConf" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
        <button class="primary" id="wok" disabled>${esc(t('m.wipeGo'))}</button></div>`);
    const check = ()=>{ $('#wok').disabled = $('#wConf').value.trim().toUpperCase() !== word.toUpperCase(); };
    $('#wConf').oninput = check;
    $('#wConf').onkeydown = e=>{ if(e.key==='Enter' && !$('#wok').disabled) $('#wok').click(); };
    $('#wok').onclick = ()=>doWipe(true);
    $('#wConf').focus();
  } else {
    modal(`<h3>${esc(t('m.wipeTitle'))}</h3><p>${esc(t('m.wipeUnlocked',{n}))}</p>${warn}
      ${Vault.enabled ? `<label class="f"><input type="checkbox" id="wProt">${esc(t('m.wipeDropProt'))}</label>` : ''}
      <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
        <button class="primary" id="wok">${esc(t('m.wipeGo'))}</button></div>`);
    $('#wok').onclick = ()=>doWipe(Vault.enabled && $('#wProt').checked);
  }
}
async function doWipe(dropProtection){
  $('#wok').disabled = true;
  try{
    await dbClear('assets');
    revokeUrls();
    if(dropProtection){
      await dbDel('meta','crypto');
      Object.assign(Vault, {enabled:false, key:null, salt:null, verifier:null});
    }
    closeModal(); await libLoad(); drawItems();
    toast(t('t.libWiped'),'ok');
  }catch(err){
    console.error(err);
    toast(t('t.wipeFail',{e:err.message}),'err');
    const b=$('#wok'); if(b) b.disabled=false;
  }
}

/* --- détourage du fond --- */
async function cutoutAsset(a){
  const url = await assetUrl(a);
  modal(`<h3>${esc(t('m.cutTitle'))}</h3><p>${esc(t('m.cutBody'))}</p>
    <canvas id="cutCanvas" height="220"></canvas>
    <label class="f">${esc(t('m.cutThreshold'))} : <span id="thL" class="mono">210</span></label>
    <input type="range" id="th" min="80" max="250" value="210">
    <label class="f"><input type="checkbox" id="mono">${esc(t('m.cutBlack'))}</label>
    <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
      <button id="cNew">${esc(t('m.cutCopy'))}</button>
      <button class="primary" id="cRep">${esc(t('m.cutReplace'))}</button></div>`);
  const img = await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src=url; });
  const src = document.createElement('canvas'); src.width=img.naturalWidth; src.height=img.naturalHeight;
  src.getContext('2d').drawImage(img,0,0);
  const srcData = src.getContext('2d').getImageData(0,0,src.width,src.height);
  const out = document.createElement('canvas'); out.width=src.width; out.height=src.height;
  const prev = $('#cutCanvas'), pctx = prev.getContext('2d');
  function apply(){
    const th=+$('#th').value, black=$('#mono').checked;
    const d = new ImageData(new Uint8ClampedArray(srcData.data), src.width, src.height), p=d.data;
    for(let i=0;i<p.length;i+=4){
      const l = .299*p[i] + .587*p[i+1] + .114*p[i+2];
      if(l>=th) p[i+3]=0;
      else{
        p[i+3] = Math.round(clamp((th-l)/Math.max(1,th*0.35),0,1)*255);
        if(black){ p[i]=p[i+1]=p[i+2]=0; }
      }
    }
    out.getContext('2d').putImageData(d,0,0);
    const r = Math.min(prev.width/out.width, prev.height/out.height);
    pctx.clearRect(0,0,prev.width,prev.height);
    pctx.drawImage(out,(prev.width-out.width*r)/2,(prev.height-out.height*r)/2,out.width*r,out.height*r);
  }
  requestAnimationFrame(()=>{ prev.width = prev.clientWidth; apply(); });
  $('#th').oninput = ()=>{ $('#thL').textContent=$('#th').value; apply(); };
  $('#mono').onchange = apply;
  const save = async replace=>{
    const bytes = await canvasToBytes(out,'image/png');
    if(replace){
      await dbPut('assets', {...a, mime:'image/png', w:out.width, h:out.height, ...(await Vault.pack(bytes.buffer))});
      const u=Lib.urls.get(a.id); if(u){ URL.revokeObjectURL(u); Lib.urls.delete(a.id); }
      await libLoad(); drawItems();
    } else {
      await addAsset(a.name+' +', bytes, 'image/png', out.width, out.height);
    }
    closeModal(); toast(t('t.bgDone'),'ok');
  };
  $('#cRep').onclick = ()=>save(true);
  $('#cNew').onclick = ()=>save(false);
}

/* --- pad de dessin --- */
$('#btnDraw').onclick = ()=>{
  if(Vault.locked){ toast(t('t.unlockFirst'),'err'); return; }
  modal(`<h3>${esc(t('m.drawTitle'))}</h3><p>${esc(t('m.drawBody'))}</p>
    <canvas id="padCanvas" height="230"></canvas>
    <label class="f">${esc(t('m.drawWidth'))} : <span id="pwL" class="mono">3.5</span></label>
    <input type="range" id="pw" min="1" max="12" value="3.5" step=".5">
    <label class="f">${esc(t('m.drawInk'))}</label>
    ${swatchHtml('pc','#111133')}
    <div class="foot">
      <button class="left" id="pclr">${esc(t('m.drawClear'))}</button>
      <button onclick="closeModal()">${esc(t('m.cancel'))}</button>
      <button class="primary" id="psave">${esc(t('m.drawSave'))}</button></div>`);
  const cv=$('#padCanvas'), ctx=cv.getContext('2d');
  let ink = '#111133';
  bindSwatch('pc', v=>{ ink=v; });
  $('#pw').oninput = e=>{ $('#pwL').textContent = e.target.value; };
  requestAnimationFrame(()=>{ cv.width=cv.clientWidth*2; cv.height=460; ctx.scale(2,2); ctx.lineCap='round'; ctx.lineJoin='round'; });
  let drawing=false, last=null, dirty=false;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; };
  cv.addEventListener('pointerdown',e=>{ drawing=true; cv.setPointerCapture(e.pointerId); last=pos(e); e.preventDefault(); });
  cv.addEventListener('pointermove',e=>{
    if(!drawing) return;
    const p=pos(e);
    ctx.strokeStyle=ink;
    ctx.lineWidth=+$('#pw').value * (e.pressure ? 0.6+e.pressure : 1);
    ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke();
    last=p; dirty=true;
  });
  cv.addEventListener('pointerup',()=>drawing=false);
  cv.addEventListener('pointercancel',()=>drawing=false);
  $('#pclr').onclick = ()=>{ ctx.clearRect(0,0,cv.width,cv.height); dirty=false; };
  $('#psave').onclick = async ()=>{
    if(!dirty){ toast(t('t.nothingToSave'),'err'); return; }
    const d = ctx.getImageData(0,0,cv.width,cv.height).data;
    let x0=cv.width, y0=cv.height, x1=0, y1=0;
    for(let y=0;y<cv.height;y++) for(let x=0;x<cv.width;x++){
      if(d[(y*cv.width+x)*4+3]>8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    }
    const pad=10;
    x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad); x1=Math.min(cv.width,x1+pad); y1=Math.min(cv.height,y1+pad);
    const o=document.createElement('canvas'); o.width=Math.max(1,x1-x0); o.height=Math.max(1,y1-y0);
    o.getContext('2d').drawImage(cv,x0,y0,o.width,o.height,0,0,o.width,o.height);
    await addAsset(new Date().toLocaleDateString(locale()),
                   await canvasToBytes(o,'image/png'), 'image/png', o.width, o.height);
    closeModal(); toast(t('t.sigAdded'),'ok');
  };
};

/* --- coffre --- */
$('#btnVault').onclick = ()=>{
  if(!Vault.enabled){
    modal(`<h3>${esc(t('m.vaultTitle'))}</h3><p>${esc(t('m.vaultBody'))}</p>
      <label class="f">${esc(t('m.vaultPwd'))}</label><input type="password" id="v1" autocomplete="new-password">
      <label class="f">${esc(t('m.vaultPwd2'))}</label><input type="password" id="v2" autocomplete="new-password">
      <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
        <button class="primary" id="vok">${esc(t('m.vaultEnable'))}</button></div>`);
    $('#vok').onclick = async ()=>{
      const a=$('#v1').value, b=$('#v2').value;
      if(a.length<6) return toast(t('t.min6'),'err');
      if(a!==b)      return toast(t('t.mismatch'),'err');
      $('#vok').disabled=true;
      await Vault.enable(a); closeModal(); await libLoad(); toast(t('t.libEncrypted'),'ok');
    };
  } else if(Vault.locked){
    modal(`<h3>${esc(t('m.vaultUnlockTitle'))}</h3><p>${esc(t('m.vaultUnlockBody'))}</p>
      <input type="password" id="v1" autocomplete="current-password">
      <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
        <button class="primary" id="vok">${esc(t('lib.unlock'))}</button></div>`);
    $('#vok').onclick = async ()=>{
      if(await Vault.unlock($('#v1').value)){ closeModal(); await libLoad(); drawItems(); toast(t('t.vaultUnlocked'),'ok'); }
      else toast(t('t.wrongPassword'),'err');
    };
    $('#v1').onkeydown = e=>{ if(e.key==='Enter') $('#vok').click(); };
  } else {
    modal(`<h3>${esc(t('m.vaultOpenTitle'))}</h3><p>${esc(t('m.vaultOpenBody'))}</p>
      <div class="foot">
        <button id="vdis" class="danger left">${esc(t('m.vaultRemove'))}</button>
        <button id="vlock">${esc(t('m.vaultLock'))}</button>
        <button class="primary" onclick="closeModal()">${esc(t('m.close'))}</button></div>`);
    $('#vlock').onclick = ()=>{ Vault.lock(); revokeUrls(); closeModal(); libRender(); drawItems(); toast(t('t.vaultLocked'),'ok'); };
    $('#vdis').onclick  = async ()=>{ await Vault.disable(); closeModal(); await libLoad(); toast(t('t.protectionRemoved'),'ok'); };
  }
};

/* ---------------------------------------------------------------------
   6. Document
   ------------------------------------------------------------------ */
const Doc = {
  bytes:null, name:'', pdf:null, page:1, total:0,
  scale:1, viewport:null, autoFit:true,
  vp1:new Map(), rot:new Map(), text:new Map(), mode:null,
  items:[], sel:null, undo:[], redo:[], renderTask:null, rt:null
};

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', document.baseURI).href;

bind(['#btnOpen','#btnOpenSm'], ()=> $('#filePdf').click());
$('#filePdf').onchange = e=>{ if(e.target.files[0]) loadPdf(e.target.files[0]); e.target.value=''; };

const viewer = $('#viewer');
['dragenter','dragover'].forEach(ev=>viewer.addEventListener(ev,e=>{e.preventDefault();viewer.classList.add('dragover');}));
['dragleave','drop'].forEach(ev=>viewer.addEventListener(ev,e=>{e.preventDefault();viewer.classList.remove('dragover');}));
viewer.addEventListener('drop', e=>{
  const files=[...(e.dataTransfer?.files||[])];
  const pdf = files.find(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));
  if(pdf) return loadPdf(pdf);
  const imgs = files.filter(f=>/^image\//.test(f.type));
  if(imgs.length) importFiles(imgs);
});

async function loadPdf(file){
  try{
    const buf = new Uint8Array(await file.arrayBuffer());
    Doc.bytes = buf;
    Doc.pdf   = await pdfjsLib.getDocument({data: buf.slice(0), isEvalSupported:false}).promise;
    Object.assign(Doc, {name:file.name, total:Doc.pdf.numPages, page:1,
                        items:[], sel:null, undo:[], redo:[], autoFit:true});
    Doc.vp1.clear(); Doc.rot.clear(); Doc.text.clear();
    setMode(null);
    $('#docName').textContent = file.name;
    $('#btnClose').hidden = false;
    $('#pTot').textContent = '/ ' + Doc.total;
    $('#hint').hidden = true; $('#stage').hidden = false;
    fitDocName();
    await fitPage();
    toast(t('t.docLoaded',{n:Doc.total}),'ok');
  }catch(err){ console.error(err); toast(t('t.readFail',{e:err.message}),'err'); }
}

$('#btnClose').onclick = closeDoc;
function closeDoc(){
  if(!Doc.pdf) return;
  if(!Doc.items.length) return doCloseDoc();
  modal(`<h3>${esc(t('m.closeTitle'))}</h3><p>${esc(t('m.closeBody'))}</p>
    <div class="foot"><button onclick="closeModal()">${esc(t('m.cancel'))}</button>
      <button id="cdSave">${esc(t('nav.save'))}</button>
      <button class="primary" id="cdGo">${esc(t('m.closeGo'))}</button></div>`);
  $('#cdSave').onclick = async ()=>{ closeModal(); await exportPdf(); };
  $('#cdGo').onclick   = ()=>{ closeModal(); doCloseDoc(); };
}
function doCloseDoc(){
  Object.assign(Doc, {pdf:null, bytes:null, name:'', page:1, total:0,
    items:[], sel:null, undo:[], redo:[], viewport:null, autoFit:true});
  Doc.vp1.clear(); Doc.rot.clear(); Doc.text.clear();
  setMode(null);
  $('#stage').hidden = true; $('#hint').hidden = false; $('#btnClose').hidden = true;
  $('#docName').textContent = t('nav.noDoc'); $('#docName').classList.remove('full');
  $('#pTot').textContent = '/ –'; $('#pNum').value = '–'; $('#zLbl').textContent = '100%';
  drawItems();
  toast(t('t.docClosed'));
}

async function getVp1(n){
  if(!Doc.vp1.has(n)){
    const p = await Doc.pdf.getPage(n);
    Doc.vp1.set(n, p.getViewport({scale:1}));
    Doc.rot.set(n, ((p.rotate%360)+360)%360);
  }
  return Doc.vp1.get(n);
}
/* Positions du texte de la page, en unités « viewport à l'échelle 1 ».
   Sert à faire épouser au surlignage la hauteur réelle de la ligne. */
async function getTextBoxes(n){
  if(Doc.text.has(n)) return Doc.text.get(n);
  let boxes = [];
  try{
    const p  = await Doc.pdf.getPage(n);
    const vp = p.getViewport({scale:1});
    const tc = await p.getTextContent();
    boxes = tc.items.filter(i=>i.str && i.str.trim()).map(i=>{
      const tr = pdfjsLib.Util.transform(vp.transform, i.transform);
      const h  = Math.hypot(tr[2], tr[3]) || 10;
      const len = Math.hypot(tr[0], tr[1]) || 1;
      const ux = tr[0]/len, uy = tr[1]/len;     // direction d'écriture
      const nx = -uy, ny = ux;                  // normale (vers le bas à l'écran)
      const wv = Math.abs(i.width) || h*0.5;
      const xs=[], ys=[];
      for(const tt of [0, wv]) for(const ss of [-0.85*h, 0.30*h]){
        xs.push(tr[4] + ux*tt + nx*ss);
        ys.push(tr[5] + uy*tt + ny*ss);
      }
      return {x:Math.min(...xs), y:Math.min(...ys),
              w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys),
              vertical: Math.abs(uy) > 0.5};
    });
  }catch(e){ console.warn('text layer:', e.message); }
  Doc.text.set(n, boxes);
  return boxes;
}

async function renderPage(){
  if(!Doc.pdf) return;
  const p  = await Doc.pdf.getPage(Doc.page);
  await getVp1(Doc.page);
  const vp = p.getViewport({scale:Doc.scale});
  Doc.viewport = vp;
  const cv = $('#cv'), dpr = Math.min(devicePixelRatio||1, 2.5);
  cv.width = Math.floor(vp.width*dpr); cv.height = Math.floor(vp.height*dpr);
  cv.style.width = vp.width+'px'; cv.style.height = vp.height+'px';
  $('#stage').style.width = vp.width+'px';
  if(Doc.renderTask){ try{ Doc.renderTask.cancel(); }catch(e){} }
  Doc.renderTask = p.render({canvasContext:cv.getContext('2d'), viewport:vp, transform:[dpr,0,0,dpr,0,0]});
  try{ await Doc.renderTask.promise; }
  catch(e){ if(e && e.name!=='RenderingCancelledException') console.error(e); }
  $('#pNum').value = Doc.page;
  $('#zLbl').textContent = Math.round(Doc.scale*100)+'%';
  drawItems();
}
/* la page entière doit tenir dans la zone visible : largeur ET hauteur */
async function fitPage(){
  const vp1 = await getVp1(Doc.page);
  const pad = isSmall() ? 18 : 44;
  const w = Math.max(80, viewer.clientWidth  - pad);
  const h = Math.max(80, viewer.clientHeight - pad);
  Doc.scale = clamp(Math.min(w/vp1.width, h/vp1.height), .05, 6);
  Doc.autoFit = true;
  await renderPage();
}
function setScale(s){
  Doc.scale = clamp(s, .05, 6);
  Doc.autoFit = false;
  $('#zLbl').textContent = Math.round(Doc.scale*100)+'%';
  scheduleRender();
}
function goPage(n){
  if(!Doc.pdf) return;
  n = clamp(n,1,Doc.total);
  if(n===Doc.page){ $('#pNum').value = Doc.page; return; }
  Doc.page=n; Doc.sel=null;
  Doc.autoFit ? fitPage() : renderPage();
}
$('#pPrev').onclick = ()=>goPage(Doc.page-1);
$('#pNext').onclick = ()=>goPage(Doc.page+1);
$('#pNum').onchange = e=>{ const v=parseInt(e.target.value,10); v?goPage(v):(e.target.value=Doc.page); };
$('#zIn').onclick   = ()=>{ if(Doc.pdf) setScale(Doc.scale*1.2); };
$('#zOut').onclick  = ()=>{ if(Doc.pdf) setScale(Doc.scale/1.2); };
bind(['#zFit','#zFitSm'], ()=>{ if(Doc.pdf) fitPage(); });
function setMode(m){
  Doc.mode = m;
  $('#btnHl').classList.toggle('on', m==='highlight');
  viewer.classList.toggle('hl-mode', m==='highlight');
}
$('#btnHl').onclick = ()=>{
  if(!Doc.pdf){ toast(t('t.openFirst'),'err'); return; }
  const on = Doc.mode!=='highlight';
  setMode(on ? 'highlight' : null);
  if(on) toast(t('t.hlDraw'));
};
$('#btnUndo').onclick = ()=>undo();
$('#btnRedo').onclick = ()=>redo();

viewer.addEventListener('wheel', e=>{
  if(!e.ctrlKey || !Doc.pdf) return;
  e.preventDefault();
  setScale(Doc.scale*(e.deltaY<0?1.1:1/1.1));
},{passive:false});

/* pincement */
const touches = new Map();
let pinch0 = null;
viewer.addEventListener('pointerdown', e=>{ if(e.pointerType==='touch') touches.set(e.pointerId,e); });
viewer.addEventListener('pointermove', e=>{
  if(e.pointerType!=='touch' || !touches.has(e.pointerId)) return;
  touches.set(e.pointerId,e);
  if(touches.size!==2 || !Doc.pdf) return;
  const [a,b] = [...touches.values()];
  const d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
  if(!pinch0){ pinch0 = {d, s:Doc.scale}; return; }
  setScale(pinch0.s * d/pinch0.d);
});
['pointerup','pointercancel'].forEach(ev=>viewer.addEventListener(ev, e=>{
  touches.delete(e.pointerId); if(touches.size<2) pinch0=null;
}));
function scheduleRender(){ clearTimeout(Doc.rt); Doc.rt=setTimeout(renderPage,90); }

/* ---------------------------------------------------------------------
   7. Éléments posés — coordonnées en points PDF
   ------------------------------------------------------------------ */
const snap = ()=> JSON.stringify({i:Doc.items, s:Doc.sel});
function restore(json){
  const st = JSON.parse(json);
  Doc.items = st.i; Doc.sel = st.s;
  const it = Doc.items.find(x=>x.id===Doc.sel);
  if(it && it.page!==Doc.page){ Doc.page=it.page; renderPage(); } else drawItems();
}
function snapshot(){ Doc.undo.push(snap()); if(Doc.undo.length>80) Doc.undo.shift(); Doc.redo.length=0; }
function undo(){
  if(!Doc.undo.length){ toast(t('t.nothingUndo')); return; }
  Doc.redo.push(snap()); restore(Doc.undo.pop()); toast(t('t.undone'));
}
function redo(){
  if(!Doc.redo.length){ toast(t('t.nothingRedo')); return; }
  Doc.undo.push(snap()); restore(Doc.redo.pop()); toast(t('t.redone'));
}
function syncHistoryButtons(){
  $('#btnUndo').disabled = !Doc.undo.length;
  $('#btnRedo').disabled = !Doc.redo.length;
}

/* Deux familles libres embarquées (SIL OFL, sous-ensembles latin + cyrillique)
   et les trois familles standard du PDF, qui ne coûtent aucun octet mais sont
   limitées à WinAnsi — donc sans cyrillique. */
const FONTS = {
  Montserrat:{label:'Montserrat', css:'Montserrat,"Segoe UI",sans-serif',
    files:{n:'Montserrat-Regular', b:'Montserrat-Bold', i:'Montserrat-Italic', bi:'Montserrat-BoldItalic'}},
  Roboto:{label:'Roboto', css:'Roboto,"Segoe UI",Arial,sans-serif',
    files:{n:'Roboto-Regular', b:'Roboto-Bold', i:'Roboto-Italic', bi:'Roboto-BoldItalic'}},
  Helvetica:{label:'Helvetica', css:'"Helvetica Neue",Helvetica,Arial,sans-serif',
    std:{n:'Helvetica', b:'Helvetica-Bold', i:'Helvetica-Oblique', bi:'Helvetica-BoldOblique'}},
  Times:{label:'Times', css:'"Times New Roman",Times,serif',
    std:{n:'Times-Roman', b:'Times-Bold', i:'Times-Italic', bi:'Times-BoldItalic'}},
  Courier:{label:'Courier', css:'"Courier New",Courier,monospace',
    std:{n:'Courier', b:'Courier-Bold', i:'Courier-Oblique', bi:'Courier-BoldOblique'}}
};
const DEFAULT_FONT = 'Montserrat';
const fontVariant = it => it.bold&&it.italic ? 'bi' : it.bold ? 'b' : it.italic ? 'i' : 'n';
const ttfCache = new Map();
async function ttfBytes(name){
  if(!ttfCache.has(name)){
    const r = await fetch('vendor/fonts/'+name+'.ttf');
    if(!r.ok) throw new Error(name);
    ttfCache.set(name, new Uint8Array(await r.arrayBuffer()));
  }
  return ttfCache.get(name);
}
const fontCss = it => `${it.italic?'italic ':''}${it.bold?'700':'400'} ${it.size}px ${FONTS[it.font].css}`;

function measureText(it){
  const m = $('#measure'), lh = it.size*1.25;
  m.style.font = fontCss(it); m.style.lineHeight = lh+'px';
  const lines = String(it.text ?? '').split('\n');
  let w = 0, baseline = lh*0.8;
  for(const ln of lines){
    m.innerHTML = '<span id="_mt"></span><span id="_ms" style="display:inline-block;width:0;height:0"></span>';
    $('#_mt',m).textContent = ln.length ? ln : ' ';
    w = Math.max(w, $('#_mt',m).offsetWidth);
    baseline = $('#_ms',m).getBoundingClientRect().bottom - m.getBoundingClientRect().top;
  }
  return {w:Math.max(4,w), h:lines.length*lh, lh, baseline};
}

function placeImage(a){
  if(!Doc.pdf){ toast(t('t.openFirst'),'err'); return; }
  const vp1 = Doc.vp1.get(Doc.page);
  const w = Math.min(190, vp1.width*0.4), h = w*(a.h/a.w);
  snapshot();
  Doc.items.push({id:uid(), page:Doc.page, type:'image', assetId:a.id, name:a.name,
    x:(vp1.width-w)/2, y:(vp1.height-h)/2, w, h, rot:0, opacity:1, locked:false});
  Doc.sel = Doc.items[Doc.items.length-1].id;
  drawItems();
  if(isSmall()) drawer('#paneLib', false);
}
function placeText(txt){
  if(!Doc.pdf){ toast(t('t.openFirst'),'err'); return; }
  const vp1 = Doc.vp1.get(Doc.page);
  snapshot();
  const it = {id:uid(), page:Doc.page, type:'text', text:txt, font:DEFAULT_FONT, size:14,
    bold:false, italic:false, color:'#111133', x:0, y:0, w:0, h:0, rot:0, opacity:1, locked:false};
  const m = measureText(it); it.w=m.w; it.h=m.h;
  it.x=(vp1.width-it.w)/2; it.y=(vp1.height-it.h)/2;
  Doc.items.push(it); Doc.sel=it.id; drawItems();
  if(isSmall()) drawer('#paneInsp', true);
}
bind(['#btnText','#btnTextSm'], ()=>placeText(t('insp.textType')));
bind(['#btnDate','#btnDateSm'], ()=>placeText(new Date().toLocaleDateString(locale())));

const selected = ()=> Doc.items.find(i=>i.id===Doc.sel) || null;

async function drawItems(){
  const layer = $('#layer');
  if(Doc.viewport){
    const s = Doc.scale;
    layer.innerHTML = '';
    for(const it of Doc.items.filter(i=>i.page===Doc.page)){
      const el = document.createElement('div');
      el.className = 'item' + (it.id===Doc.sel?' sel':'') + (it.locked?' locked':'');
      el.dataset.id = it.id;
      el.style.cssText = `left:${it.x*s}px;top:${it.y*s}px;width:${it.w*s}px;height:${it.h*s}px;
        transform:rotate(${-it.rot}deg);opacity:${it.opacity}`;
      if(it.type==='highlight'){
        el.classList.add('hl-item');
        const d=document.createElement('div'); d.className='hl';
        d.style.background = it.color;
        el.appendChild(d);
      } else if(it.type==='image'){
        const img=document.createElement('img'); el.appendChild(img);
        const a = Lib.assets.find(x=>x.id===it.assetId);
        if(a){ try{ img.src = await assetUrl(a); }catch(e){ el.title=t('insp.vaultLockedItem'); } }
        else{ el.style.background='repeating-linear-gradient(45deg,#fdd,#fdd 6px,#fbb 6px,#fbb 12px)';
              el.title=t('insp.missing'); }
      } else {
        const d=document.createElement('div'); d.className='txt';
        d.style.font = fontCss({...it, size:it.size*s});
        d.style.lineHeight = (it.size*1.25*s)+'px';
        d.style.color = it.color; d.textContent = it.text;
        el.appendChild(d);
      }
      if(it.id===Doc.sel){
        const del=document.createElement('div');
        del.className='handle h-del'; del.dataset.h='del'; del.textContent='🗑';
        del.title = t('insp.delete');
        el.appendChild(del);
        if(!it.locked){
          const hs=document.createElement('div'); hs.className='handle h-se'; hs.dataset.h='se';
          const hr=document.createElement('div'); hr.className='handle h-rot'; hr.dataset.h='rot';
          el.append(hs,hr);
        }
      }
      layer.appendChild(el);
    }
  } else layer.innerHTML = '';
  renderInspector(); renderItemList(); syncHistoryButtons();
  $('#btnInsp').classList.toggle('has', !!Doc.sel);
}

/* Double-clic sur la poignée ronde : angle ramené au multiple de 90° le plus proche. */
$('#layer').addEventListener('dblclick', e=>{
  if(e.target.dataset.h !== 'rot') return;
  const it = Doc.items.find(i=>i.id === e.target.closest('.item').dataset.id);
  if(!it || it.locked) return;
  e.preventDefault();
  snapshot();
  it.rot = (Math.round(it.rot/90)*90 % 360 + 360) % 360;
  drawItems();
});

$('#layer').addEventListener('pointerdown', e=>{
  if(Doc.mode==='highlight'){ e.preventDefault(); return startBand(e); }
  const el = e.target.closest('.item');
  if(!el){ if(Doc.sel){ Doc.sel=null; drawItems(); } return; }
  const it = Doc.items.find(i=>i.id===el.dataset.id); if(!it) return;
  const mode = e.target.dataset.h || 'move';

  if(mode==='del'){ e.preventDefault(); removeItem(it.id); return; }
  if(Doc.sel!==it.id){ Doc.sel=it.id; drawItems(); }
  if(it.locked) return;

  e.preventDefault();
  const s = Doc.scale, start={x:e.clientX,y:e.clientY};
  const o = {x:it.x,y:it.y,w:it.w,h:it.h,rot:it.rot,size:it.size};
  const rect = $('#layer').getBoundingClientRect();
  const cx = rect.left + (it.x+it.w/2)*s, cy = rect.top + (it.y+it.h/2)*s;
  const a0 = Math.atan2(cy-e.clientY, e.clientX-cx)*180/Math.PI;
  let moved = false;

  const move = ev=>{
    if(!moved){ snapshot(); moved=true; }
    const dx=(ev.clientX-start.x)/s, dy=(ev.clientY-start.y)/s;
    if(mode==='move'){
      it.x=o.x+dx; it.y=o.y+dy;
      if(ev.shiftKey){ if(Math.abs(dx)>Math.abs(dy)) it.y=o.y; else it.x=o.x; }
    } else if(mode==='se'){
      if(it.type==='image'){
        const k = Math.max(.05, 1 + (dx/Math.max(1,o.w) + dy/Math.max(1,o.h))/2);
        it.w=o.w*k; it.h=o.h*k;
      } else {
        it.size = clamp(o.size * Math.max(.1, 1 + dy/Math.max(1,o.h)), 3, 400);
        const m = measureText(it); it.w=m.w; it.h=m.h;
      }
    } else if(mode==='rot'){
      const a = Math.atan2(cy-ev.clientY, ev.clientX-cx)*180/Math.PI;
      let r = o.rot + (a-a0);
      if(ev.shiftKey) r = Math.round(r/15)*15;
      it.rot = ((r%360)+360)%360;
    }
    quickUpdate(it);
  };
  const up = ()=>{ removeEventListener('pointermove',move); removeEventListener('pointerup',up);
                   removeEventListener('pointercancel',up); if(moved) drawItems(); };
  addEventListener('pointermove',move); addEventListener('pointerup',up); addEventListener('pointercancel',up);
});
/* Tracé libre : on dessine une bande, puis on cale le surlignage sur les
   lignes de texte qu'elle traverse. Une ligne = un élément, de la hauteur
   réelle de la ligne. Sans couche de texte (PDF scanné), on garde le rectangle. */
function startBand(e){
  const layer = $('#layer'), s = Doc.scale;
  const r0 = layer.getBoundingClientRect();
  const x0 = e.clientX - r0.left, y0 = e.clientY - r0.top;
  const band = document.createElement('div');
  band.className = 'band';
  layer.appendChild(band);
  const draw = (x1,y1)=>{
    band.style.left  = Math.min(x0,x1)+'px';
    band.style.top   = Math.min(y0,y1)+'px';
    band.style.width = Math.abs(x1-x0)+'px';
    band.style.height= Math.abs(y1-y0)+'px';
  };
  draw(x0,y0);
  const move = ev=> draw(ev.clientX-r0.left, ev.clientY-r0.top);
  const up = async ev=>{
    removeEventListener('pointermove',move); removeEventListener('pointerup',up);
    removeEventListener('pointercancel',up);
    const x1 = ev.clientX-r0.left, y1 = ev.clientY-r0.top;
    band.remove();
    if(Math.abs(x1-x0) < 4 && Math.abs(y1-y0) < 4) return;
    const sel = {x:Math.min(x0,x1)/s, y:Math.min(y0,y1)/s,
                 w:Math.abs(x1-x0)/s, h:Math.abs(y1-y0)/s};
    await addHighlights(sel);
  };
  addEventListener('pointermove',move); addEventListener('pointerup',up);
  addEventListener('pointercancel',up);
}
const overlaps = (a,b)=> a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

async function addHighlights(sel){
  const boxes = (await getTextBoxes(Doc.page)).filter(b=>overlaps(b, sel));
  const color = recentColors('hl')[0] || PRESETS.hl[0];
  snapshot();
  if(!boxes.length){
    Doc.items.push(hlItem(sel, color));
    toast(t('t.hlNoText'));
  } else {
    /* regroupement par ligne : suivant l'axe perpendiculaire à l'écriture */
    const lines = new Map();
    for(const b of boxes){
      const key = b.vertical ? Math.round((b.x+b.w/2)/Math.max(2,b.w*0.6))
                             : Math.round((b.y+b.h/2)/Math.max(2,b.h*0.6));
      (lines.get(key) || lines.set(key,[]).get(key)).push(b);
    }
    for(const group of lines.values()){
      const x = Math.min(...group.map(b=>b.x)), y = Math.min(...group.map(b=>b.y));
      const w = Math.max(...group.map(b=>b.x+b.w)) - x;
      const h = Math.max(...group.map(b=>b.y+b.h)) - y;
      Doc.items.push(hlItem({x:x-1, y, w:w+2, h}, color));
    }
  }
  Doc.sel = Doc.items[Doc.items.length-1].id;
  drawItems();
}
function hlItem(r, color){
  return {id:uid(), page:Doc.page, type:'highlight', color, opacity:0.45,
          x:r.x, y:r.y, w:r.w, h:r.h, rot:0, locked:false};
}

function quickUpdate(it){
  const el = $(`.item[data-id="${it.id}"]`); if(!el) return;
  const s = Doc.scale;
  el.style.left=(it.x*s)+'px'; el.style.top=(it.y*s)+'px';
  el.style.width=(it.w*s)+'px'; el.style.height=(it.h*s)+'px';
  el.style.transform=`rotate(${-it.rot}deg)`;
  if(it.type==='text'){
    const d=$('.txt',el);
    d.style.font=fontCss({...it,size:it.size*s});
    d.style.lineHeight=(it.size*1.25*s)+'px';
  }
  const pos=$('#posInfo'); if(pos) pos.textContent = fmtPos(it);
}
function removeItem(id){
  snapshot();
  Doc.items = Doc.items.filter(i=>i.id!==id);
  if(Doc.sel===id) Doc.sel=null;
  drawItems();
}
const fmtPos = it => `x ${it.x.toFixed(0)} · y ${it.y.toFixed(0)} · ${it.w.toFixed(0)}×${it.h.toFixed(0)} pt · ${it.rot.toFixed(0)}°`;

document.addEventListener('keydown', e=>{
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if(e.key==='Escape' && $('#mask').classList.contains('on')) return closeModal();
  if(e.key==='Escape' && Doc.mode){ setMode(null); return; }
  const k = e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); return redo(); }
  const it = selected(); if(!it) return;
  if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); return removeItem(it.id); }
  if(e.key==='Escape'){ Doc.sel=null; return drawItems(); }
  const step = e.shiftKey?10:1;
  const map = {ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if(map[e.key] && !it.locked){ e.preventDefault(); snapshot(); it.x+=map[e.key][0]; it.y+=map[e.key][1]; quickUpdate(it); syncHistoryButtons(); }
});

/* ---------------------------------------------------------------------
   8. Inspecteur
   ------------------------------------------------------------------ */
function renderInspector(){
  const box=$('#insp'), it=selected();
  if(!it){
    box.innerHTML = `<div class="empty">${esc(Doc.pdf ? t('insp.emptyDoc') : t('insp.emptyNoDoc'))}</div>`;
    return;
  }
  const dis = it.locked ? 'disabled' : '';
  const specific = it.type==='highlight' ? `
    <label class="f">${esc(t('insp.color'))}</label>
    ${swatchHtml('fCol', it.color, it.locked, 'hl')}
    <div class="row" style="margin-top:8px">
      <div><label class="f">${esc(t('insp.width'))}</label>
        <input type="number" id="fW" value="${it.w.toFixed(1)}" step="1" ${dis}></div>
      <div><label class="f">${esc(t('insp.height'))}</label>
        <input type="number" id="fH" value="${it.h.toFixed(1)}" step="1" ${dis}></div>
    </div>`
  : it.type==='image' ? `
    <label class="f">${esc(t('insp.width'))}</label><input type="number" id="fW" value="${it.w.toFixed(1)}" step="1" ${dis}>
    <label class="f">${esc(t('insp.height'))}</label><input type="number" id="fH" value="${it.h.toFixed(1)}" step="1" ${dis}>
    <label class="f"><input type="checkbox" id="fRatio" checked>${esc(t('insp.keepRatio'))}</label>`
  : `
    <label class="f">${esc(t('insp.text'))}</label><textarea id="fTxt" rows="3" ${dis}>${esc(it.text)}</textarea>
    <div class="row">
      <div><label class="f">${esc(t('insp.font'))}</label><select id="fFont" ${dis}>
        ${Object.entries(FONTS).map(([k,v])=>`<option value="${k}"${it.font===k?' selected':''}>${v.label}</option>`).join('')}
      </select></div>
      <div style="flex:0 0 74px"><label class="f">${esc(t('insp.size'))}</label>
        <input type="number" id="fSize" value="${it.size}" min="3" max="400" ${dis}></div>
      <div style="flex:0 0 40px"><button id="fB" class="${it.bold?'on':''}" ${dis} title="${esc(t('insp.boldT'))}"
        style="font-weight:700;width:100%">${esc(t('insp.bold'))}</button></div>
      <div style="flex:0 0 40px"><button id="fI" class="${it.italic?'on':''}" ${dis} title="${esc(t('insp.italicT'))}"
        style="font-style:italic;width:100%">${esc(t('insp.italic'))}</button></div>
    </div>
    <label class="f">${esc(t('insp.color'))}</label>
    ${swatchHtml('fCol', it.color, it.locked)}`;

  box.innerHTML = `
    <div class="chip" style="margin-bottom:6px">
      ${esc(it.type==='image' ? t('insp.image')+' · '+(it.name||'')
            : it.type==='highlight' ? t('insp.highlight') : t('insp.textType'))}
      ${it.locked?`<span class="badge ok">${esc(t('insp.validated'))}</span>`:''}
    </div>
    ${specific}
    <div class="chip" id="posInfo" style="margin-top:10px">${fmtPos(it)}</div>
    <label class="f">${esc(t('insp.opacity'))} <span class="mono" id="opL">${Math.round(it.opacity*100)}%</span></label>
    <input type="range" id="fOp" min="10" max="100" value="${Math.round(it.opacity*100)}" ${dis}>
    <div class="row">
      <div><label class="f">${esc(t('insp.rotation'))}</label>
        <input type="number" id="fRot" value="${it.rot.toFixed(1)}" step="1" ${dis}></div>
      <div><label class="f">${esc(t('insp.page'))}</label>
        <input type="number" id="fPage" value="${it.page}" min="1" max="${Doc.total}" ${dis}></div>
    </div>
    <div class="row" style="margin-top:14px">
      ${it.locked ? `<button id="aUnlock" style="flex:2">${esc(t('insp.editAgain'))}</button>`
                  : `<button id="aLock" class="primary" style="flex:2">${esc(t('insp.validate'))}</button>`}
      <button id="aDup" style="flex:0 0 40px" title="${esc(t('insp.duplicate'))}">⧉</button>
      <button id="aDel" class="danger" style="flex:0 0 40px" title="${esc(t('insp.delete'))}">🗑</button>
    </div>
    <div class="chip" style="margin-top:10px;line-height:1.55">${esc(t('insp.hint'))}</div>
    <div class="chip" style="margin-top:4px;line-height:1.55">${esc(t('insp.hintRot'))}</div>`;

  const upd = fn=>{ snapshot(); fn(); drawItems(); };
  $('#fOp').oninput  = e=>{
    it.opacity=+e.target.value/100;
    $('#opL').textContent = e.target.value+'%';
    const el=$(`.item[data-id="${it.id}"]`); if(el) el.style.opacity=it.opacity;
  };
  $('#fOp').onchange = ()=>{ snapshot(); drawItems(); };
  $('#fRot').onchange  = e=>upd(()=>{ it.rot=((+e.target.value%360)+360)%360; });
  $('#fPage').onchange = e=>{
    const p = clamp(parseInt(e.target.value,10)||1, 1, Doc.total);
    snapshot(); it.page=p;
    if(p!==Doc.page) goPage(p); else drawItems();
  };
  if(it.type==='highlight'){
    bindSwatch('fCol', (v, done)=>{
      it.color=v;
      const d=$(`.item[data-id="${it.id}"] .hl`); if(d) d.style.background=v;
      if(done) drawItems();
    }, 'hl');
    $('#fW').onchange = e=>upd(()=>{ it.w=Math.max(2,+e.target.value); });
    $('#fH').onchange = e=>upd(()=>{ it.h=Math.max(2,+e.target.value); });
  } else if(it.type==='image'){
    const ratio = it.h/it.w;
    $('#fW').onchange = e=>upd(()=>{ const v=Math.max(1,+e.target.value); if($('#fRatio').checked) it.h=v*ratio; it.w=v; });
    $('#fH').onchange = e=>upd(()=>{ const v=Math.max(1,+e.target.value); if($('#fRatio').checked) it.w=v/ratio; it.h=v; });
  } else {
    const remeasure = ()=>{ const m=measureText(it); it.w=m.w; it.h=m.h; };
    $('#fTxt').oninput   = e=>{ it.text=e.target.value; remeasure();
                                const d=$(`.item[data-id="${it.id}"] .txt`); if(d) d.textContent=it.text; quickUpdate(it); };
    $('#fTxt').onchange  = ()=>{ snapshot(); drawItems(); };
    $('#fFont').onchange = e=>upd(()=>{ it.font=e.target.value; remeasure(); });
    $('#fSize').onchange = e=>upd(()=>{ it.size=clamp(+e.target.value,3,400); remeasure(); });
    $('#fB').onclick     = ()=>upd(()=>{ it.bold=!it.bold; remeasure(); });
    $('#fI').onclick     = ()=>upd(()=>{ it.italic=!it.italic; remeasure(); });
    bindSwatch('fCol', (v, done)=>{
      it.color=v;
      const d=$(`.item[data-id="${it.id}"] .txt`); if(d) d.style.color=v;
      if(done) drawItems();
    });
  }
  if($('#aLock'))   $('#aLock').onclick   = ()=>{ snapshot(); it.locked=true; drawItems(); toast(t('t.validated'),'ok'); };
  if($('#aUnlock')) $('#aUnlock').onclick = ()=>{ snapshot(); it.locked=false; drawItems(); };
  $('#aDup').onclick = ()=>{ snapshot(); const c={...it,id:uid(),x:it.x+14,y:it.y+14,locked:false};
                             Doc.items.push(c); Doc.sel=c.id; drawItems(); };
  $('#aDel').onclick = ()=>removeItem(it.id);
}

function renderItemList(){
  const l=$('#itemList');
  if(!Doc.items.length){ l.innerHTML=`<div class="empty" style="font-size:11.5px">${esc(t('insp.itemsEmpty'))}</div>`; return; }
  l.innerHTML = Doc.items.map(it=>`
    <div class="li${it.id===Doc.sel?' on':''}" data-id="${it.id}">
      <span class="mono">${esc(t('insp.page'))} ${it.page}</span>
      <span class="t">${esc(it.type==='image' ? (it.name||t('insp.image'))
        : it.type==='highlight' ? t('insp.highlight')
        : String(it.text||'').split('\n')[0].slice(0,24))}</span>
      <span class="badge${it.locked?' ok':''}">${it.locked?'✓':'·'}</span>
      <button class="del" data-del="${it.id}" title="${esc(t('insp.delete'))}">🗑</button>
    </div>`).join('');
  $$('#itemList .li').forEach(el=>el.onclick=e=>{
    const del = e.target.closest('[data-del]');
    if(del){ e.stopPropagation(); return removeItem(del.dataset.del); }
    const it = Doc.items.find(i=>i.id===el.dataset.id);
    Doc.sel = it.id;
    if(it.page!==Doc.page){ Doc.page=it.page; Doc.autoFit ? fitPage() : renderPage(); } else drawItems();
  });
}

/* ---------------------------------------------------------------------
   9. Export
   ------------------------------------------------------------------ */
function hexRgb(h){
  const n = parseInt((/^#?([0-9a-f]{6})$/i.exec(h)||[,'000000'])[1],16);
  return PDFLib.rgb(((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255);
}
function toPdf(vp1, it, pageRot, lx, ly){
  const c  = vp1.convertToPdfPoint(it.x+it.w/2, it.y+it.h/2);
  const th = (pageRot + it.rot) * Math.PI/180, cs=Math.cos(th), sn=Math.sin(th);
  return {x:c[0] + lx*cs - ly*sn, y:c[1] + lx*sn + ly*cs, theta:pageRot + it.rot};
}

bind(['#btnExport','#btnExportSm'], exportPdf);
async function exportPdf(){
  if(!Doc.pdf){ toast(t('t.noDoc'),'err'); return; }
  if(!Doc.items.length && !confirm(t('m.exportEmpty'))) return;
  const btns = [$('#btnExport'), $('#btnExportSm')];
  const prev = btns.map(b=>b.innerHTML);
  btns.forEach(b=>{ b.disabled=true; });
  $('#btnExport').textContent = t('t.generating');
  try{
    for(const it of Doc.items) await getVp1(it.page);
    const out   = await PDFLib.PDFDocument.load(Doc.bytes.slice(0), {ignoreEncryption:true});
    const pages = out.getPages();
    const imgCache = new Map(), fontCache = new Map();
    let fkReady = false;
    /* Montserrat et Roboto sont intégrées depuis vendor/fonts (sous-ensemble
       automatique par pdf-lib) ; les familles standard ne coûtent aucun octet. */
    const getFont = async (family, variant)=>{
      const key = family+':'+variant;
      if(!fontCache.has(key)){
        const F = FONTS[family] || FONTS[DEFAULT_FONT];
        if(F.files){
          if(!fkReady){ out.registerFontkit(window.fontkit.default || window.fontkit); fkReady = true; }
          fontCache.set(key, await out.embedFont(await ttfBytes(F.files[variant]), {subset:true}));
        } else {
          fontCache.set(key, await out.embedFont(F.std[variant]));
        }
      }
      return fontCache.get(key);
    };

    for(const it of Doc.items){
      const page = pages[it.page-1]; if(!page) continue;
      const vp1 = Doc.vp1.get(it.page), pageRot = Doc.rot.get(it.page)||0;

      if(it.type==='highlight'){
        const p = toPdf(vp1, it, pageRot, -it.w/2, -it.h/2);
        page.drawRectangle({x:p.x, y:p.y, width:it.w, height:it.h,
          color:hexRgb(it.color), opacity:it.opacity, rotate:PDFLib.degrees(p.theta),
          blendMode: PDFLib.BlendMode ? PDFLib.BlendMode.Multiply : undefined});
      } else if(it.type==='image'){
        const a = Lib.assets.find(x=>x.id===it.assetId);
        if(!a){ toast(t('t.imageMissing',{name:it.name||''}),'err'); continue; }
        if(!imgCache.has(a.id)){
          const bytes = await assetBytes(a);
          imgCache.set(a.id, a.mime==='image/jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes));
        }
        const p = toPdf(vp1, it, pageRot, -it.w/2, -it.h/2);
        page.drawImage(imgCache.get(a.id), {x:p.x, y:p.y, width:it.w, height:it.h,
          rotate:PDFLib.degrees(p.theta), opacity:it.opacity});
      } else {
        const font = await getFont(it.font, fontVariant(it));
        const m = measureText(it), lines = String(it.text||'').split('\n');
        for(let i=0;i<lines.length;i++){
          if(!lines[i]) continue;
          const p = toPdf(vp1, it, pageRot, -it.w/2, it.h/2 - (i*m.lh + m.baseline));
          try{
            page.drawText(lines[i], {x:p.x, y:p.y, size:it.size, font, color:hexRgb(it.color),
              rotate:PDFLib.degrees(p.theta), opacity:it.opacity});
          }catch(err){ toast(t('t.charUnsupported',{e:err.message}),'err'); }
        }
      }
    }
    await saveBytes(await out.save(), Doc.name.replace(/\.pdf$/i,'') + '-signed.pdf');
    toast(t('t.pdfDone'),'ok');
  }catch(err){
    console.error(err);
    toast(err.message==='locked' ? t('t.lockedExport') : t('t.genFail',{e:err.message}), 'err');
  }finally{ btns.forEach((b,i)=>{ b.disabled=false; b.innerHTML=prev[i]; }); }
}
async function saveBytes(bytes, filename){
  const blob = new Blob([bytes], {type:'application/pdf'});
  if(window.showSaveFilePicker){
    try{
      const h = await showSaveFilePicker({suggestedName:filename,
        types:[{description:'PDF', accept:{'application/pdf':['.pdf']}}]});
      const w = await h.createWritable(); await w.write(blob); await w.close(); return;
    }catch(e){ if(e.name==='AbortError') return; }
  }
  const file = new File([blob], filename, {type:'application/pdf'});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:filename}); return; }
    catch(e){ if(e.name==='AbortError') return; }
  }
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

/* ---------------------------------------------------------------------
   10. Écran d'accueil / aide
   ------------------------------------------------------------------ */
function showSplash(firstRun){
  const step = (n,a,b)=>`<div class="step"><span class="n">${n}</span>
    <div><b>${esc(t(a))}</b><span>${esc(t(b))}</span></div></div>`;
  modal(`<h3>${esc(t('sp.title'))}</h3><p>${esc(t('sp.intro'))}</p>
    <div class="steps">
      ${step(1,'sp.s1','sp.s1b')}${step(2,'sp.s2','sp.s2b')}
      ${step(3,'sp.s3','sp.s3b')}${step(4,'sp.s4','sp.s4b')}
    </div>
    <h4>${esc(t('sp.pwa'))}</h4>
    <div class="plat">
      <span>${esc(t('sp.pwaAndroid'))}</span>
      <span>${esc(t('sp.pwaIos'))}</span>
      <span>${esc(t('sp.pwaDesktop'))}</span>
    </div>
    <div class="foot">
      ${firstRun ? `<label class="f left" style="margin:0;display:flex;align-items:center">
        <input type="checkbox" id="spHide">${esc(t('sp.dontShow'))}</label>` : ''}
      ${deferredPrompt ? `<button id="spInstall">${esc(t('nav.install'))}</button>` : ''}
      <button class="primary" id="spGo">${esc(firstRun ? t('sp.start') : t('m.close'))}</button>
    </div>`);
  if($('#spInstall')) $('#spInstall').onclick = doInstall;
  $('#spGo').onclick = ()=>{
    if($('#spHide') && $('#spHide').checked) localStorage.setItem('pdfed.splash','off');
    closeModal();
  };
}

/* ---------------------------------------------------------------------
   11. PWA
   ------------------------------------------------------------------ */
async function doInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  renderSettings();
}
addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; renderSettings(); });
addEventListener('appinstalled', ()=>{ deferredPrompt=null; renderSettings(); toast(t('t.installed'),'ok'); });

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  addEventListener('load', async ()=>{
    try{
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', ()=>{
        const sw = reg.installing;
        sw && sw.addEventListener('statechange', ()=>{
          if(sw.state==='installed' && navigator.serviceWorker.controller) toast(t('t.newVersion'));
        });
      });
    }catch(e){ console.warn('service worker:', e.message); }
  });
}
if('launchQueue' in window){
  launchQueue.setConsumer(async lp=>{
    if(lp.files && lp.files.length){
      try{ await loadPdf(await lp.files[0].getFile()); }catch(e){ console.error(e); }
    }
  });
}

/* ---------------------------------------------------------------------
   12. Démarrage
   ------------------------------------------------------------------ */
addEventListener('beforeunload', e=>{ if(Doc.items.length){ e.preventDefault(); e.returnValue=''; } });
addEventListener('resize', ()=>{
  if(!isSmall()){ $$('aside').forEach(a=>a.classList.remove('open')); $('#scrim').classList.remove('on'); }
  if(!Doc.pdf) return;
  fitDocName();
  clearTimeout(Doc.rt);
  Doc.rt = setTimeout(()=>{ Doc.autoFit ? fitPage() : drawItems(); }, 180);
});

applyI18n();
renderSettings();
$('#docName').textContent = t('nav.noDoc');
drawItems();

(async function boot(){
  try{
    await Vault.init();
    await libLoad();
  }catch(e){
    $('#libBody').innerHTML = `<div class="empty">${esc(t('t.storageFail',{e:e.message}))}</div>`;
  }
  if(localStorage.getItem('pdfed.splash') !== 'off') setTimeout(()=>showSplash(true), 350);
})();
