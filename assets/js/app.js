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
const APP_VERSION = 'v14';
/* Position de la barre d'outils : en haut, ou en colonne à gauche ou à droite. */
const TB_POS = ['top','left','right'];
const tbPos = ()=> TB_POS.includes(localStorage.getItem('pdfed.tb')) ? localStorage.getItem('pdfed.tb') : 'top';
function applyToolbar(pos){
  if(!TB_POS.includes(pos)) pos = 'top';
  localStorage.setItem('pdfed.tb', pos);
  document.body.classList.toggle('tb-side',  pos !== 'top');
  document.body.classList.toggle('tb-left',  pos === 'left');
  document.body.classList.toggle('tb-right', pos === 'right');
  if(Doc.pdf && Doc.autoFit) setTimeout(fitPage, 60);
}   // doit suivre CACHE_VERSION de sw.js
function toast(msg, kind){
  const el=$('#toast'); el.textContent=msg;
  el.style.borderLeftColor = kind==='err'?'var(--stamp)':kind==='ok'?'var(--ok)':'var(--ink)';
  el.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'),3400);
}
function modal(html){ $('#modal').innerHTML=html; $('#mask').classList.add('on'); }
function closeModal(){ $('#mask').classList.remove('on'); $('#modal').innerHTML=''; }
window.closeModal = closeModal;
$('#mask').addEventListener('pointerdown', e=>{ if(e.target.id==='mask') closeModal(); });
/* La CSP interdit les gestionnaires en ligne (script-src 'self' sans 'unsafe-inline') :
   les boutons de fermeture sont donc câblés par délégation. */
$('#mask').addEventListener('click', e=>{ if(e.target.closest('[data-close]')) closeModal(); });

/* composant de choix de couleur : pastille lisible + pipette native masquée */
const PRESETS = {
  text: ['#111133','#1a4fd6','#c62828','#1b7a4b','#6d4c41','#6b7280'],
  hl:   ['#ffe14d','#b6f2a1','#9fd8ff','#ffb3d9','#ffc48a','#d6c2ff'],
  cmt:  ['#cc2a2e','#1a4fd6','#b8860b','#1b7a4b','#7b2fbe','#333a4d']
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
  /* le noir reste systématiquement la première pastille */
  for(const c of ['#000000', ...recentColors(kind), ...PRESETS[kind], current]){
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
   0 bis. Champ de mot de passe : affichage commutable et jauge de robustesse
   ------------------------------------------------------------------ */
const PW_COLORS = ['#d95757','#e08a3c','#d4b13c','#5ba85f','#2e9e5b'];
/* Estimation volontairement simple et lisible : longueur, variété des classes
   de caractères, et rabattement des suites et répétitions évidentes. */
function pwScore(pw){
  if(!pw) return -1;
  const len = pw.length;
  if(len < 6) return 0;
  const cls = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  let sc = (len >= 8) + (len >= 12) + (len >= 16);
  if(cls >= 3) sc++;
  if(cls >= 4) sc++;
  /* la longueur ne rachète pas l'absence de variété */
  if(cls === 1) sc = Math.min(sc, 1);
  else if(cls === 2) sc = Math.min(sc, 3);
  if(/^(.)\1+$/.test(pw)) sc = 0;
  if(/^(0123|1234|abcd|azer|qwer|motdepasse|password|secret|admin)/i.test(pw)) sc = Math.min(sc, 1);
  if(len < 8) sc = Math.min(sc, 1);
  return clamp(sc, 0, 4);
}
function pwFieldHtml(id, labelKey, meter, autocomplete){
  return `<label class="f">${esc(t(labelKey))}</label>
    <div class="pw">
      <input type="password" id="${id}" autocomplete="${autocomplete||'new-password'}"
             autocapitalize="off" autocorrect="off" spellcheck="false">
      <button type="button" class="eye" id="${id}-eye" title="${esc(t('m.pwShow'))}"
              aria-label="${esc(t('m.pwShow'))}">👁</button>
    </div>
    ${meter ? `<div class="meter" id="${id}-m">${'<i></i>'.repeat(5)}</div>
      <span class="meter-lbl" id="${id}-l"></span>` : ''}`;
}
/* Le second champ signale en rouge, dès la frappe, toute divergence. */
function bindPwMatch(id, refId){
  const a = $('#'+refId), b = $('#'+id);
  let err = $('#'+id+'-err');
  if(!err){
    err = document.createElement('span');
    err.className = 'pw-err'; err.id = id+'-err';
    b.closest('.pw').after(err);
  }
  const check = ()=>{
    /* rouge dès que la confirmation dévie, mais pas pendant qu'on la tape :
       une saisie encore incomplète mais conforme reste neutre */
    const bad = b.value.length > 0 && b.value !== a.value.slice(0, b.value.length);
    b.classList.toggle('bad', bad);
    err.textContent = bad ? t('t.mismatch') : '';
  };
  b.addEventListener('input', check);
  a.addEventListener('input', check);
  return check;
}
function bindPw(id, onInput){
  const inp = $('#'+id), eye = $('#'+id+'-eye');
  eye.onclick = ()=>{
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    eye.textContent = show ? '🙈' : '👁';
    const lbl = t(show ? 'm.pwHide' : 'm.pwShow');
    eye.title = lbl; eye.setAttribute('aria-label', lbl);
    inp.focus();
  };
  const bars = $$('#'+id+'-m i'), lbl = $('#'+id+'-l');
  const paint = ()=>{
    if(!bars.length) return;
    const sc = pwScore(inp.value);
    bars.forEach((b,i)=>{
      b.style.background = (sc >= 0 && i <= sc) ? PW_COLORS[sc] : '';
      b.style.borderColor = (sc >= 0 && i <= sc) ? 'transparent' : '';
    });
    lbl.textContent = sc < 0 ? '' : t('insp.strength') + ' : ' + t('pw.'+sc);
    lbl.style.color = sc < 0 ? '' : PW_COLORS[sc];
  };
  inp.oninput = ()=>{ paint(); if(onInput) onInput(inp.value); };
  paint();
  return inp;
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
  if($('#themeSeg')) showSettingsModal();   // rafraîchit le segment actif
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

/* Réglages et langue : deux fenêtres ouvertes depuis la première ligne du
   panneau Propriétés, qui reste ainsi entièrement dédiée à l'élément choisi. */
function updateFlag(){ $('#btnLangP').innerHTML = flagSvg(LANG); }

function showLangModal(){
  modal(`<h3>${esc(t('nav.language'))}</h3>
    <div class="langsel" id="langSel">
      ${LANGS.map(l=>`<button data-l="${l.code}" class="${l.code===LANG?'on':''}">
        ${flagSvg(l.code)}<span>${esc(l.label)}</span></button>`).join('')}
    </div>
    <div class="foot"><button class="primary" data-close>${esc(t('m.close'))}</button></div>`);
  $$('#langSel button').forEach(b=> b.onclick = ()=>{ setLang(b.dataset.l); closeModal(); });
}

function showSettingsModal(){
  modal(`<h3>${esc(t('nav.settings'))}</h3>
    <div class="settings">
      <label class="f">${esc(t('nav.theme'))}</label>
      <div class="seg" id="themeSeg">
        ${THEMES.map(th=>`<button data-t="${th}" class="${th===curTheme()?'on':''}">
          ${esc(t(th==='system'?'nav.themeSystem':th==='light'?'nav.themeLight':'nav.themeDark'))}</button>`).join('')}
      </div>
      <label class="f">${esc(t('nav.language'))}</label>
      <div class="row"><button id="setLangBtn" style="justify-content:flex-start;gap:8px">
        ${flagSvg(LANG)}<span>${esc((LANGS.find(l=>l.code===LANG)||{}).label||LANG)}</span></button></div>
      <label class="f">${esc(t('insp.toolbarPos'))}</label>
      <div class="seg" id="tbSeg">
        ${TB_POS.map(p=>`<button data-p="${p}" class="${p===tbPos()?'on':''}">${esc(t('pos.'+p))}</button>`).join('')}
      </div>
      <label class="f"><input type="checkbox" id="setNote" ${NOTE_ON()?'checked':''}>${esc(t('insp.marginNote'))}</label>
      <label class="f"><input type="checkbox" id="setAnnex1" ${ANNEX_1ST()?'checked':''}>${esc(t('insp.annexFirst'))}</label>
      <label class="f"><input type="checkbox" id="setShot" ${SHOT_ON()?'checked':''}>${esc(t('insp.shot'))}</label>
      <label class="f">${esc(t('insp.shotMax'))}</label>
      <div class="row"><input type="number" id="setShotMax" min="5" max="100" step="5" value="${SHOT_MAX()}">
        <button id="setShotHelp" style="flex:0 0 44px">?</button></div>
      <label class="f">${esc(t('insp.suffix'))}</label>
      <input type="text" id="setSuffix" value="${esc(SUFFIX())}" spellcheck="false">
      <div class="row" style="margin-top:12px"><button id="setFs">${esc(t('nav.fullscreen'))}</button></div>
      <div class="row" style="margin-top:6px"><button id="setHelp">${esc(t('nav.help'))}</button></div>
      <div class="row" style="margin-top:6px${deferredPrompt?'':';display:none'}">
        <button id="setInstall" class="primary">${esc(t('nav.install'))}</button></div>
    </div>
    <div class="foot"><button class="primary" data-close>${esc(t('m.close'))}</button></div>`);
  $$('#themeSeg button').forEach(b=> b.onclick = ()=>applyTheme(b.dataset.t));
  $$('#tbSeg button').forEach(b=> b.onclick = ()=>{ applyToolbar(b.dataset.p); showSettingsModal(); });
  $('#setNote').onchange   = e=> localStorage.setItem('pdfed.note', e.target.checked ? '1' : '0');
  $('#setAnnex1').onchange = e=> localStorage.setItem('pdfed.annexFirst', e.target.checked ? '1' : '0');
  $('#setShot').onchange   = e=> localStorage.setItem('pdfed.shot', e.target.checked ? '1' : '0');
  $('#setShotMax').onchange = e=> localStorage.setItem('pdfed.shotMax',
    String(clamp(parseInt(e.target.value,10) || 25, 5, 100)));
  $('#setShotHelp').onclick = showShotHelp;
  $('#setSuffix').onchange = e=>
    localStorage.setItem('pdfed.suffix', e.target.value.replace(/[\\/:*?"<>|]/g,''));
  $('#setLangBtn').onclick = showLangModal;
  $('#setFs').onclick = toggleFullscreen;
  $('#setHelp').onclick = ()=>showSplash(false);
  $('#setInstall').onclick = doInstall;
}
$('#btnSet').onclick  = showSettingsModal;
$('#btnLangP').onclick = showLangModal;

/* appelée par i18n.js après chaque changement de langue */
function onLangChange(){
  setDocName(Doc.name);
  libRender();
  updateFlag();
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
      ${pwFieldHtml('qpass','lib.password',false,'current-password')}
      <button class="primary" id="qunlock">${esc(t('lib.unlock'))}</button></div>`;
    bindPw('qpass');
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
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
      <button class="primary" id="rok">${esc(t('m.rename'))}</button></div>`);
  $('#rn').select();
  $('#rok').onclick = async ()=>{
    const v=$('#rn').value.trim(); if(!v) return;
    await dbPut('assets', {...a, name:v}); closeModal(); await libLoad(); drawItems(); toast(t('t.nameUpdated'),'ok');
  };
}
function deleteAsset(a){
  modal(`<h3>${esc(t('m.delTitle',{name:a.name}))}</h3><p>${esc(t('m.delBody'))}</p>
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
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

/* --- enregistrement et chargement de la bibliothèque ------------------
   Le fichier produit est autonome et chiffré : il ne dépend ni du coffre
   local ni de l'appareil. Le mot de passe est obligatoire et n'est stocké
   nulle part. --------------------------------------------------------- */
const LIB_MAGIC = 'PDFED-LIB-1', LIB_ITER = 250000;
const b64  = u => btoa(String.fromCharCode(...new Uint8Array(u)));
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function libSerialize(pass){
  const items = [];
  for(const a of await dbGetAll('assets')){
    items.push({name:a.name, mime:a.mime, w:a.w, h:a.h, created:a.created,
                data: b64(await Vault.unpack(a))});
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await Vault.derive(pass, salt);
  const clear = new TextEncoder().encode(JSON.stringify({magic:LIB_MAGIC, items}));
  const data = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, clear);
  return {text: JSON.stringify({
    magic: LIB_MAGIC, v: 1,
    kdf: {name:'PBKDF2', hash:'SHA-256', iterations: LIB_ITER},
    salt: b64(salt), iv: b64(iv), data: b64(data)
  }), n: items.length};
}
async function libDeserialize(text, pass){
  let env;
  try{ env = JSON.parse(text); }catch(e){ throw new Error('format'); }
  if(!env || env.magic !== LIB_MAGIC) throw new Error('format');
  const key = await Vault.derive(pass, ub64(env.salt));
  const clear = await crypto.subtle.decrypt(
    {name:'AES-GCM', iv: ub64(env.iv)}, key, ub64(env.data));   // lève si mot de passe faux
  const payload = JSON.parse(new TextDecoder().decode(clear));
  if(!payload || payload.magic !== LIB_MAGIC || !Array.isArray(payload.items)) throw new Error('format');
  return payload.items;
}

$('#btnLibIO').onclick = ()=>{
  modal(`<h3>${esc(t('m.libTitle'))}</h3>
    <div class="stack">
      <button class="primary" id="ioSave">${esc(t('m.libSave'))}</button>
      <button id="ioLoad">${esc(t('m.libLoad'))}</button>
    </div>
    <div class="foot"><button data-close>${esc(t('m.close'))}</button></div>`);
  $('#ioSave').onclick = libSaveDialog;
  $('#ioLoad').onclick = ()=>{ closeModal(); $('#fileLib').click(); };
};

function libSaveDialog(){
  if(Vault.locked){ toast(t('t.unlockFirst'),'err'); return; }
  if(!Lib.assets.length){ toast(t('t.libEmpty')); return; }
  modal(`<h3>${esc(t('m.libSave'))}</h3><p>${esc(t('m.libSaveBody'))}</p>
    ${pwFieldHtml('lpw1','m.vaultPwd',true)}
    ${pwFieldHtml('lpw2','m.vaultPwd2',false)}
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
      <button class="primary" id="ioOk">${esc(t('nav.saveShort'))}</button></div>`);
  bindPw('lpw1'); bindPw('lpw2'); bindPwMatch('lpw2','lpw1');
  $('#ioOk').onclick = async ()=>{
    const a = $('#lpw1').value, b = $('#lpw2').value;
    if(a.length < 8) return toast(t('t.min8'),'err');
    if(a !== b)      return toast(t('t.mismatch'),'err');
    $('#ioOk').disabled = true;
    try{
      const {text, n} = await libSerialize(a);
      closeModal();
      const stamp = new Date().toISOString().slice(0,10);
      await saveFile(new Blob([text], {type:'application/json'}), `signatures-${stamp}.pdfedlib`);
      toast(t('t.libSaved',{n}),'ok');
    }catch(err){
      console.error(err);
      toast(t('t.genFail',{e:err.message}),'err');
      const btn = $('#ioOk'); if(btn) btn.disabled = false;
    }
  };
}

$('#fileLib').onchange = async e=>{
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  let text;
  try{ text = await f.text(); }catch(err){ return toast(t('t.readFail',{e:err.message}),'err'); }
  modal(`<h3>${esc(t('m.libLoad'))}</h3><p>${esc(t('m.libLoadBody'))}</p>
    <div class="chip" style="margin-bottom:6px">${esc(f.name)}</div>
    ${pwFieldHtml('lpw','m.vaultPwd',false,'current-password')}
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
      <button class="primary" id="ioIn">${esc(t('lib.import'))}</button></div>`);
  const inp = bindPw('lpw');
  const go = async ()=>{
    if(Vault.locked){ toast(t('t.unlockFirst'),'err'); return; }
    $('#ioIn').disabled = true;
    try{
      const items = await libDeserialize(text, inp.value);
      for(const it of items){
        await addAsset(it.name || '?', ub64(it.data), it.mime || 'image/png',
                       it.w || 1, it.h || 1);
      }
      closeModal();
      toast(t('t.imagesAdded',{n:items.length}),'ok');
    }catch(err){
      toast(err.message === 'format' ? t('t.libBadFile') : t('t.wrongPassword'),'err');
      const btn = $('#ioIn'); if(btn) btn.disabled = false;
    }
  };
  $('#ioIn').onclick = go;
  inp.onkeydown = ev=>{ if(ev.key === 'Enter') go(); };
};

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
      <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
        <button class="primary" id="wok" disabled>${esc(t('m.wipeGo'))}</button></div>`);
    const check = ()=>{ $('#wok').disabled = $('#wConf').value.trim().toUpperCase() !== word.toUpperCase(); };
    $('#wConf').oninput = check;
    $('#wConf').onkeydown = e=>{ if(e.key==='Enter' && !$('#wok').disabled) $('#wok').click(); };
    $('#wok').onclick = ()=>doWipe(true);
    $('#wConf').focus();
  } else {
    modal(`<h3>${esc(t('m.wipeTitle'))}</h3><p>${esc(t('m.wipeUnlocked',{n}))}</p>${warn}
      ${Vault.enabled ? `<label class="f"><input type="checkbox" id="wProt">${esc(t('m.wipeDropProt'))}</label>` : ''}
      <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
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
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
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
      <button data-close>${esc(t('m.cancel'))}</button>
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
      ${pwFieldHtml('v1','m.vaultPwd',true)}
      ${pwFieldHtml('v2','m.vaultPwd2',false)}
      <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
        <button class="primary" id="vok">${esc(t('m.vaultEnable'))}</button></div>`);
    bindPw('v1'); bindPw('v2'); bindPwMatch('v2','v1');
    $('#vok').onclick = async ()=>{
      const a=$('#v1').value, b=$('#v2').value;
      if(a.length<6) return toast(t('t.min6'),'err');
      if(a!==b)      return toast(t('t.mismatch'),'err');
      $('#vok').disabled=true;
      await Vault.enable(a); closeModal(); await libLoad(); toast(t('t.libEncrypted'),'ok');
    };
  } else if(Vault.locked){
    modal(`<h3>${esc(t('m.vaultUnlockTitle'))}</h3><p>${esc(t('m.vaultUnlockBody'))}</p>
      ${pwFieldHtml('v1','m.vaultPwd',false,'current-password')}
      <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
        <button class="primary" id="vok">${esc(t('lib.unlock'))}</button></div>`);
    bindPw('v1');
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
        <button class="primary" data-close>${esc(t('m.close'))}</button></div>`);
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
  vp1:new Map(), rot:new Map(), text:new Map(), mode:null, cmtOffset:0, dirty:false,
  items:[], sel:null, undo:[], redo:[], renderTask:null, rt:null
};

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', document.baseURI).href;

bind(['#btnOpen','#btnOpenSm'], ()=> $('#filePdf').click());
$('#filePdf').onchange = e=>{ openFiles([...e.target.files]); e.target.value=''; };

/* Le sélecteur accepte un PDF ou des images, ce qui déclenche sur mobile le
   menu natif habituel : photothèque, appareil photo, fichiers.
   Des images sont assemblées en un PDF A4, une par page. */
const A4 = {w:595.28, h:841.89};
async function openFiles(files){
  if(!files.length) return;
  const pdf = files.find(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
  if(pdf) return loadPdf(pdf);
  const imgs = files.filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(f.name));
  if(!imgs.length){ toast(t('t.noImages'),'err'); return; }
  await pdfFromImages(imgs);
}
async function pdfFromImages(files){
  toast(t('t.building'));
  try{
    const doc = await PDFLib.PDFDocument.create();
    let n = 0;
    for(const f of files){
      const img = await fileToImage(f);
      /* passage par un canevas : uniformise les formats exotiques (HEIC converti
         par le système, WebP, etc.) et borne la définition */
      const k = Math.min(1, 2600 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width  = Math.max(1, Math.round(img.naturalWidth  * k));
      cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      const bytes = await canvasToBytes(cv, 'image/jpeg', .9);
      const emb = await doc.embedJpg(bytes);
      /* facteur d'échelle commun aux deux axes : l'image occupe la largeur ou
         la hauteur, selon celle qui sature la première. Aucune rotation,
         aucun recadrage, proportions conservées. */
      const page = doc.addPage([A4.w, A4.h]);
      const s = Math.min(A4.w / emb.width, A4.h / emb.height);
      page.drawImage(emb, {
        x: (A4.w - emb.width  * s) / 2,
        y: (A4.h - emb.height * s) / 2,
        width:  emb.width  * s,
        height: emb.height * s
      });
      n++;
    }
    const out = await doc.save();
    const base = (files[0].name || 'images').replace(/\.[^.]+$/, '');
    await loadPdf(new File([out], base + '.pdf', {type:'application/pdf'}));
    toast(t('t.pagesBuilt', {n}), 'ok');
  }catch(err){
    console.error(err);
    toast(t('t.genFail', {e: err.message}), 'err');
  }
}
/* la zone vide et l'emplacement du nom, dans la barre du haut, ouvrent le
   sélecteur : le bouton n'est pas la seule cible */
$('#hint').onclick = ()=> $('#filePdf').click();
$('#docName').onclick = ()=>{ if(!Doc.pdf) $('#filePdf').click(); };
function setDocName(name){
  const el = $('#docName');
  el.textContent = name || t('nav.noDoc');
  el.classList.toggle('empty', !name);
  el.title = name || t('nav.open');
  fitDocName();
}

const viewer = $('#viewer');
['dragenter','dragover'].forEach(ev=>viewer.addEventListener(ev,e=>{e.preventDefault();viewer.classList.add('dragover');}));
['dragleave','drop'].forEach(ev=>viewer.addEventListener(ev,e=>{e.preventDefault();viewer.classList.remove('dragover');}));
viewer.addEventListener('drop', e=>{
  const files = [...(e.dataTransfer?.files || [])];
  if(!files.length) return;
  const pdf = files.find(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
  if(pdf) return loadPdf(pdf);
  /* sur un document ouvert, des images déposées rejoignent la bibliothèque ;
     sinon elles deviennent un nouveau document */
  const imgs = files.filter(f => /^image\//.test(f.type));
  if(!imgs.length) return;
  Doc.pdf ? importFiles(imgs) : pdfFromImages(imgs);
});

async function loadPdf(file){
  try{
    const buf = new Uint8Array(await file.arrayBuffer());
    Doc.bytes = buf;
    Doc.pdf   = await pdfjsLib.getDocument({data: buf.slice(0), isEvalSupported:false}).promise;
    Object.assign(Doc, {name:file.name, total:Doc.pdf.numPages, page:1,
                        items:[], sel:null, undo:[], redo:[], autoFit:true, dirty:false});
    Doc.vp1.clear(); Doc.rot.clear(); Doc.text.clear(); shotCache.clear();
    setMode(null);
    setDocName(file.name);
    $('#btnClose').hidden = false;
    $('#pTot').textContent = '/ ' + Doc.total;
    sizePageField();
    $('#hint').hidden = true; $('#stage').hidden = false;
    fitDocName();
    await fitPage();
    toast(t('t.docLoaded',{n:Doc.total}),'ok');
    scanComments();
  }catch(err){ console.error(err); toast(t('t.readFail',{e:err.message}),'err'); }
}

$('#btnClose').onclick = closeDoc;
function closeDoc(){
  if(!Doc.pdf) return;
  /* rien de posé, ou rien de changé depuis le dernier enregistrement :
     il n'y a rien à perdre, on ferme sans rien demander */
  if(!Doc.items.length || !Doc.dirty) return doCloseDoc();
  modal(`<h3>${esc(t('m.closeTitle'))}</h3><p>${esc(t('m.closeBody'))}</p>
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
      <button id="cdSave">${esc(t('nav.save'))}</button>
      <button class="primary" id="cdGo">${esc(t('m.closeGo'))}</button></div>`);
  $('#cdSave').onclick = async ()=>{ closeModal(); await exportPdf(); };
  $('#cdGo').onclick   = ()=>{ closeModal(); doCloseDoc(); };
}
function doCloseDoc(){
  Object.assign(Doc, {pdf:null, bytes:null, name:'', page:1, total:0,
    items:[], sel:null, undo:[], redo:[], viewport:null, autoFit:true, cmtOffset:0, dirty:false});
  Doc.vp1.clear(); Doc.rot.clear(); Doc.text.clear(); shotCache.clear();
  setMode(null);
  $('#stage').hidden = true; $('#hint').hidden = false; $('#btnClose').hidden = true;
  setDocName(''); $('#docName').classList.remove('full');
  $('#pTot').textContent = '/ –'; $('#pNum').value = '–'; $('#zLbl').textContent = '100%';
  Doc.total = 0; sizePageField();
  drawItems();
  toast(t('t.docClosed'));
}

/* Reprise d'un document déjà commenté : on relit les annotations présentes
   pour décaler la numérotation au lieu de repartir de 1. Les commentaires
   produits par cette application préfixent leur contenu par « N. », ce qui
   permet de retrouver le dernier numéro utilisé même après plusieurs passes. */
const MARKUP = ['Text','Square','Highlight','FreeText','StrikeOut','Underline','Caret','Ink'];
async function scanComments(){
  Doc.cmtOffset = 0;
  let found = 0, maxN = 0;
  /* Source de vérité : le marqueur écrit dans les mots-clés du document par
     un passage précédent. Le balayage des annotations reste en secours,
     notamment pour un fichier annoté ailleurs. */
  try{
    const kw = (await Doc.pdf.getMetadata()).info.Keywords || '';
    const m = /pdfed-cmt-max:(\d+)/.exec(String(kw));
    if(m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }catch(err){ console.warn('metadata:', err.message); }
  try{
    for(let n = 1; n <= Doc.total; n++){
      const list = await (await Doc.pdf.getPage(n)).getAnnotations();
      for(const a of list || []){
        if(!MARKUP.includes(a.subtype)) continue;
        /* pdf.js 3.x expose le texte sous contentsObj.str ; contents a disparu */
        const txt = (a.contentsObj && a.contentsObj.str) ||
                    (typeof a.contents === 'string' ? a.contents : '') || '';
        if(!txt.trim()) continue;
        found++;
        const m = /^\s*(\d+)\s*[.)]/.exec(txt);
        if(m) maxN = Math.max(maxN, parseInt(m[1], 10));
      }
    }
  }catch(err){ console.warn('annotations:', err.message); }
  Doc.cmtOffset = Math.max(maxN, found);
  found = Math.max(found, maxN);
  if(found) toast(t('t.cmtFound', {n:found, next:Doc.cmtOffset + 1}));
  drawItems();
}

/* Le champ de page n'est jamais plus large que le plus grand numéro possible. */
function sizePageField(){
  const d = Math.max(1, String(Doc.total || 1).length);
  const el = $('#pNum');
  /* 17 px couvrent le rembourrage (8) et les bordures (2), plus une marge de
     confort : en box-sizing:border-box la largeur les englobe tous. */
  el.style.width = `calc(${d}ch + 17px)`;
  el.maxLength = d;
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
  $('#btnCmt').classList.toggle('on', m==='comment');
  viewer.classList.toggle('hl-mode', !!m);
}
$('#btnHl').onclick = ()=>{
  if(!Doc.pdf){ toast(t('t.openFirst'),'err'); return; }
  const on = Doc.mode!=='highlight';
  setMode(on ? 'highlight' : null);
  if(on) toast(t('t.hlDraw'));
};
$('#btnCmt').onclick = ()=>{
  if(!Doc.pdf){ toast(t('t.openFirst'),'err'); return; }
  const on = Doc.mode!=='comment';
  setMode(on ? 'comment' : null);
  if(on) toast(t('t.cmtDraw'));
};
$('#btnUndo').onclick = ()=>undo();
$('#btnRedo').onclick = ()=>redo();

/* Safari applique son propre zoom de page au pincement : on le neutralise
   pour que seul le rendu du PDF change d'échelle. */
['gesturestart','gesturechange','gestureend'].forEach(ev=>
  document.addEventListener(ev, e=>e.preventDefault(), {passive:false}));
document.addEventListener('dblclick', e=>{ if(e.target.closest('.viewer')) e.preventDefault(); });

viewer.addEventListener('wheel', e=>{
  if(!e.ctrlKey || !Doc.pdf) return;
  e.preventDefault();
  setScale(Doc.scale*(e.deltaY<0?1.1:1/1.1));
},{passive:false});

/* pincement */
const touches = new Map();
let pinch0 = null;
viewer.addEventListener('pointerdown', e=>{ if(e.pointerType==='touch') touches.set(e.pointerId,e); });
/* Pendant le pincement, la page est simplement mise à l'échelle par une
   transformation CSS : le rendu reste net à l'ancienne définition mais suit le
   geste en temps réel. Le nouveau rendu n'est calculé qu'au relâchement. */
viewer.addEventListener('pointermove', e=>{
  if(e.pointerType!=='touch' || !touches.has(e.pointerId)) return;
  touches.set(e.pointerId,e);
  if(touches.size!==2 || !Doc.pdf) return;
  const [a,b] = [...touches.values()];
  const d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
  const stage = $('#stage');
  if(!pinch0){
    const r = stage.getBoundingClientRect();
    pinch0 = {d, s:Doc.scale,
      ox: (a.clientX + b.clientX)/2 - r.left,
      oy: (a.clientY + b.clientY)/2 - r.top};
    stage.style.transformOrigin = `${pinch0.ox}px ${pinch0.oy}px`;
    stage.style.willChange = 'transform';
    return;
  }
  const k = clamp(d/pinch0.d, 0.05/pinch0.s, 6/pinch0.s);
  pinch0.k = k;
  stage.style.transform = `scale(${k})`;
});
['pointerup','pointercancel'].forEach(ev=>viewer.addEventListener(ev, e=>{
  touches.delete(e.pointerId);
  if(touches.size >= 2 || !pinch0) return;
  const stage = $('#stage'), k = pinch0.k || 1, base = pinch0.s;
  pinch0 = null;
  stage.style.transform = ''; stage.style.willChange = '';
  if(Math.abs(k - 1) > 0.005) setScale(base * k);
}));
function scheduleRender(){ clearTimeout(Doc.rt); Doc.rt=setTimeout(renderPage,60); }

/* ---------------------------------------------------------------------
   Navigation par geste : en butée, une poussée supplémentaire change de
   page ; quand le document tient entièrement, un simple balayage suffit.
   On ne réagit qu'au doigt posé — l'inertie produit des événements de
   défilement, jamais de toucher, donc elle ne déclenche rien.
   ------------------------------------------------------------------ */
const EDGE = 2, SWIPE = 55;
const canScrollX = ()=> viewer.scrollWidth  - viewer.clientWidth  > EDGE;
const canScrollY = ()=> viewer.scrollHeight - viewer.clientHeight > EDGE;
const atLeft   = ()=> viewer.scrollLeft <= EDGE;
const atRight  = ()=> viewer.scrollLeft >= viewer.scrollWidth - viewer.clientWidth - EDGE;
const atTop    = ()=> viewer.scrollTop  <= EDGE;
const atBottom = ()=> viewer.scrollTop  >= viewer.scrollHeight - viewer.clientHeight - EDGE;

let swipe = null;
viewer.addEventListener('touchstart', e=>{
  if(e.touches.length !== 1 || !Doc.pdf || Doc.mode){ swipe = null; return; }
  const tt = e.touches[0];
  swipe = {x:tt.clientX, y:tt.clientY, t:Date.now(), moved:false};
}, {passive:true});
viewer.addEventListener('touchmove', e=>{
  if(swipe && e.touches.length === 1) swipe.moved = true;
}, {passive:true});
viewer.addEventListener('touchend', e=>{
  if(!swipe || !swipe.moved || !Doc.pdf) { swipe = null; return; }
  const tt = e.changedTouches[0];
  const dx = tt.clientX - swipe.x, dy = tt.clientY - swipe.y;
  swipe = null;
  if(Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
  if(Math.abs(dx) >= Math.abs(dy)){
    if(canScrollX() && !(dx < 0 ? atRight() : atLeft())) return;   // il reste à faire défiler
    goPage(Doc.page + (dx < 0 ? 1 : -1));
  } else {
    if(canScrollY() && !(dy < 0 ? atBottom() : atTop())) return;
    goPage(Doc.page + (dy < 0 ? 1 : -1));
  }
}, {passive:true});

/* molette : même règle, avec un cumul pour éviter les sauts intempestifs */
let wheelAcc = 0, wheelT = 0;
viewer.addEventListener('wheel', e=>{
  if(e.ctrlKey || !Doc.pdf) return;
  const now = Date.now();
  if(now - wheelT > 400) wheelAcc = 0;
  wheelT = now;
  const dy = e.deltaY, dx = e.deltaX;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const d = vertical ? dy : dx;
  if(!d) return;
  const blocked = vertical
    ? (!canScrollY() || (d > 0 ? atBottom() : atTop()))
    : (!canScrollX() || (d > 0 ? atRight()  : atLeft()));
  if(!blocked){ wheelAcc = 0; return; }
  wheelAcc += d;
  if(Math.abs(wheelAcc) < 120) return;
  wheelAcc = 0;
  goPage(Doc.page + (d > 0 ? 1 : -1));
}, {passive:true});

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
function snapshot(){
  Doc.undo.push(snap());
  if(Doc.undo.length>80) Doc.undo.shift();
  Doc.redo.length = 0;
  Doc.dirty = true;          // sert à n'avertir qu'en cas de perte réelle
}
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
bind(['#btnText'], askText);
/* Saisie préalable, avec insertion de la date et de l'heure au point du curseur.
   Remplace l'ancien bouton Date de la barre d'outils. */
function askText(){
  if(!Doc.pdf){ toast(t('t.openFirst'),'err'); return; }
  modal(`<h3>${esc(t('m.textTitle'))}</h3>
    <textarea id="tTxt" rows="4" placeholder="${esc(t('m.textPh'))}"></textarea>
    <div class="row" style="margin-top:8px">
      <button id="tDate">${esc(t('m.insDate'))}</button>
      <button id="tTime">${esc(t('m.insTime'))}</button>
      <button id="tBoth">${esc(t('m.insDateTime'))}</button>
    </div>
    <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
      <button class="primary" id="tOk">${esc(t('m.ok'))}</button></div>`);
  const ta = $('#tTxt');
  const insert = str=>{
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
    ta.value = ta.value.slice(0,a) + str + ta.value.slice(b);
    ta.selectionStart = ta.selectionEnd = a + str.length;
    ta.focus();
  };
  const now = ()=> new Date();
  $('#tDate').onclick = ()=> insert(now().toLocaleDateString(locale()));
  $('#tTime').onclick = ()=> insert(now().toLocaleTimeString(locale(), {hour:'2-digit', minute:'2-digit'}));
  $('#tBoth').onclick = ()=> insert(now().toLocaleDateString(locale()) + ' ' +
    now().toLocaleTimeString(locale(), {hour:'2-digit', minute:'2-digit'}));
  ta.focus();
  $('#tOk').onclick = ()=>{
    const v = ta.value.replace(/\s+$/,'');
    closeModal();
    if(v) placeText(v);
  };
}

const selected = ()=> Doc.items.find(i=>i.id===Doc.sel) || null;
const isRect = it => it && (it.type==='comment' || it.type==='highlight');
/* Les commentaires sont numérotés dans l'ordre de lecture : par page,
   puis du haut vers le bas. Le même ordre sert à l'écran et à l'export. */
function commentsInOrder(){
  return Doc.items.filter(i=>i.type==='comment')
    .slice().sort((a,b)=> a.page-b.page || a.y-b.y || a.x-b.x);
}
const cmtNumber = id => Doc.cmtOffset + commentsInOrder().findIndex(i=>i.id===id) + 1;

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
      if(it.type==='comment'){
        el.classList.add('cmt');
        el.style.setProperty('--cc', it.color);
        const tint=document.createElement('div'); tint.className='cmt-tint';
        const box=document.createElement('div');  box.className='cmt-box';
        const num=document.createElement('div');  num.className='cmt-n';
        num.textContent = cmtNumber(it.id);
        el.append(tint, box, num);
        el.title = it.text || '';
      } else if(it.type==='highlight'){
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
          if(isRect(it)){   // côtés : un seul axe à la fois
            const he=document.createElement('div'); he.className='handle h-e'; he.dataset.h='e';
            const hsd=document.createElement('div'); hsd.className='handle h-s'; hsd.dataset.h='s';
            el.append(he,hsd);
          }
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
  const host = e.target.closest('.item');
  if(host && !e.target.dataset.h){
    const c = Doc.items.find(i=>i.id===host.dataset.id);
    if(c && c.type==='comment' && !c.locked){ e.preventDefault(); return editComment(c, false); }
  }
  if(e.target.dataset.h !== 'rot') return;
  const it = Doc.items.find(i=>i.id === e.target.closest('.item').dataset.id);
  if(!it || it.locked) return;
  e.preventDefault();
  snapshot();
  it.rot = (Math.round(it.rot/90)*90 % 360 + 360) % 360;
  drawItems();
});

$('#layer').addEventListener('pointerdown', e=>{
  if(Doc.mode){ e.preventDefault(); return startBand(e); }
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
    } else if(mode==='se' || mode==='e' || mode==='s'){
      if(isRect(it)){
        /* cadre libre : largeur et hauteur indépendantes, sans lien avec
           la taille de ce qui se trouve dessous */
        if(mode!=='s') it.w = Math.max(6, o.w + dx);
        if(mode!=='e') it.h = Math.max(6, o.h + dy);
        if(ev.altKey){ it.x = o.x - (it.w-o.w)/2; it.y = o.y - (it.h-o.h)/2; }
      } else if(it.type==='image'){
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
  /* Le rectangle de référence est relu à chaque déplacement : la visionneuse
     peut défiler pendant le geste dès que la page dépasse l'écran, et des
     coordonnées figées au départ donneraient un cadre sans rapport. */
  const at = ev => {
    const r = layer.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const p0 = at(e), x0 = p0.x, y0 = p0.y;
  try{ layer.setPointerCapture(e.pointerId); }catch(err){}
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
  const move = ev=>{ const p = at(ev); draw(p.x, p.y); };
  const up = async ev=>{
    removeEventListener('pointermove',move); removeEventListener('pointerup',up);
    removeEventListener('pointercancel',up);
    try{ layer.releasePointerCapture(ev.pointerId); }catch(err){}
    const pe = at(ev), x1 = pe.x, y1 = pe.y;
    band.remove();
    if(Math.abs(x1-x0) < 4 && Math.abs(y1-y0) < 4) return;
    const sel = {x:Math.min(x0,x1)/s, y:Math.min(y0,y1)/s,
                 w:Math.abs(x1-x0)/s, h:Math.abs(y1-y0)/s};
    if(Doc.mode==='comment') addComment(sel); else await addHighlights(sel);
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
      const vert = group[0].vertical;
      let x = Math.min(...group.map(b=>b.x)), y = Math.min(...group.map(b=>b.y));
      let w = Math.max(...group.map(b=>b.x+b.w)) - x;
      let h = Math.max(...group.map(b=>b.y+b.h)) - y;
      /* la hauteur de ligne est reprise du texte, mais l'étendue suivant l'axe
         d'écriture est bornée par le geste : on peut ainsi surligner quelques
         mots et non la ligne entière */
      if(vert){
        const a = Math.max(y, sel.y), b = Math.min(y+h, sel.y+sel.h);
        if(b - a > 2){ y = a; h = b - a; }
      } else {
        const a = Math.max(x, sel.x), b = Math.min(x+w, sel.x+sel.w);
        if(b - a > 2){ x = a; w = b - a; }
      }
      Doc.items.push(hlItem({x:x-1, y, w:w+2, h}, color));
    }
  }
  Doc.sel = Doc.items[Doc.items.length-1].id;
  setMode(null);                 // l'outil se désarme une fois le surlignage posé
  drawItems();
}
const CMT_COLOR = '#cc2a2e';
function addComment(r){
  const it = {id:uid(), page:Doc.page, type:'comment',
    x:r.x, y:r.y, w:Math.max(20,r.w), h:Math.max(14,r.h), rot:0,
    color: localStorage.getItem('pdfed.cmt.color') || CMT_COLOR,
    author: localStorage.getItem('pdfed.author') || '',
    text:'', opacity:1, locked:false};
  editComment(it, true);
}
/* Saisie du texte. À la création, un commentaire vide est simplement abandonné. */
const DRAFT = 'pdfed.cmtDraft';
const draftGet = ()=>{ try{ return JSON.parse(localStorage.getItem(DRAFT) || 'null'); }catch(e){ return null; } };
const draftClear = ()=> localStorage.removeItem(DRAFT);

function editComment(it, isNew){
  /* Un nouveau commentaire reprend le brouillon laissé par une saisie
     interrompue autrement que par Valider ou Annuler — un clic à côté de la
     fenêtre, par exemple, ou un rechargement de la page. */
  if(isNew){
    const d = draftGet();
    if(d){ it.text = d.text || ''; it.author = d.author || it.author; it.color = d.color || it.color; }
  }
  /* sortie par le décor : on garde le texte et on désarme l'outil */
  let settled = false;
  const bail = e=>{
    if(settled || !$('#mask').classList.contains('on')) return;
    if(e && e.target && e.target.id !== 'mask') return;
    stash(); settled = true;
    $('#mask').removeEventListener('click', bail);
    if(isNew) setMode(null);
  };
  const stash = ()=>{
    if(!isNew) return;
    const txt = $('#cTxt') ? $('#cTxt').value.trim() : '';
    if(txt) localStorage.setItem(DRAFT, JSON.stringify({
      text: txt, author: $('#cAuth') ? $('#cAuth').value.trim() : '', color: it.color
    }));
  };
  if(isNew){
    $('#mask').addEventListener('click', bail);
    addEventListener('keydown', function esc(ev){
      if(ev.key === 'Escape'){ bail({target:{id:'mask'}}); removeEventListener('keydown', esc); }
    });
  }
  modal(`<h3>${esc(t('m.commentTitle'))}${isNew?'':' '+cmtNumber(it.id)}</h3>
    <p>${esc(t('m.commentBody'))}</p>
    <label class="f">${esc(t('insp.author'))}</label>
    <input type="text" id="cAuth" value="${esc(it.author||'')}" autocomplete="name">
    <label class="f">${esc(t('insp.commentText'))}</label>
    <textarea id="cTxt" rows="5" placeholder="${esc(t('m.commentPh'))}">${esc(it.text||'')}</textarea>
    <label class="f">${esc(t('insp.color'))}</label>
    ${swatchHtml('cCol', it.color, false, 'cmt')}
    <div class="foot"><button id="cCancel">${esc(t('m.cancel'))}</button>
      <button class="primary" id="cOk">${esc(t('m.ok'))}</button></div>`);
  /* Annuler est une décision explicite : le brouillon est abandonné. */
  $('#cCancel').onclick = ()=>{
    settled = true; if(isNew){ draftClear(); setMode(null); }
    closeModal();
  };
  let color = it.color;
  bindSwatch('cCol', v=>{ color = v; }, 'cmt');
  $('#cTxt').focus();
  $('#cOk').onclick = ()=>{
    const txt = $('#cTxt').value.trim();
    settled = true;
    if(isNew && !txt){ draftClear(); setMode(null); closeModal(); toast(t('t.cmtEmpty')); return; }
    if(isNew) draftClear();
    snapshot();
    it.text = txt;
    it.author = $('#cAuth').value.trim();
    it.color = color;
    localStorage.setItem('pdfed.author', it.author);
    localStorage.setItem('pdfed.cmt.color', color);
    if(isNew){ Doc.items.push(it); Doc.sel = it.id; setMode(null); }
    closeModal(); drawItems();
    if(isNew) toast(t('t.cmtAdded'),'ok');
  };
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
  const it = selected();
  if(!it){
    /* sans élément sélectionné, les flèches parcourent le document */
    const nav = {ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1}[e.key];
    if(nav && Doc.pdf){ e.preventDefault(); goPage(Doc.page + nav); }
    if(e.key === 'PageDown' && Doc.pdf){ e.preventDefault(); goPage(Doc.page + 1); }
    if(e.key === 'PageUp'   && Doc.pdf){ e.preventDefault(); goPage(Doc.page - 1); }
    return;
  }
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
  const specific = it.type==='comment' ? `
    <div class="chip" style="margin-bottom:8px">${esc(t('exp.page'))} ${it.page} · n° ${cmtNumber(it.id)}</div>
    <label class="f">${esc(t('insp.commentText'))}</label>
    <textarea id="fTxt" rows="4" ${dis}>${esc(it.text||'')}</textarea>
    <label class="f">${esc(t('insp.author'))}</label>
    <input type="text" id="fAuth" value="${esc(it.author||'')}" ${dis}>
    <label class="f">${esc(t('insp.color'))}</label>
    ${swatchHtml('fCol', it.color, it.locked, 'cmt')}
    <div class="row" style="margin-top:8px">
      <div><label class="f">${esc(t('insp.width'))}</label>
        <input type="number" id="fW" value="${it.w.toFixed(1)}" step="1" ${dis}></div>
      <div><label class="f">${esc(t('insp.height'))}</label>
        <input type="number" id="fH" value="${it.h.toFixed(1)}" step="1" ${dis}></div>
    </div>
    <button id="fEdit" style="width:100%;margin-top:8px" ${dis}>${esc(t('insp.editText'))}</button>`
  : it.type==='highlight' ? `
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
            : it.type==='highlight' ? t('insp.highlight')
            : it.type==='comment' ? t('insp.comment') : t('insp.textType'))}
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
  if(it.type==='comment'){
    bindSwatch('fCol', (v, done)=>{
      it.color=v;
      const el=$(`.item[data-id="${it.id}"]`); if(el) el.style.setProperty('--cc', v);
      if(done){ localStorage.setItem('pdfed.cmt.color', v); drawItems(); }
    }, 'cmt');
    $('#fTxt').onchange  = e=>upd(()=>{ it.text=e.target.value; });
    $('#fAuth').onchange = e=>upd(()=>{ it.author=e.target.value.trim();
                                        localStorage.setItem('pdfed.author', it.author); });
    $('#fW').onchange = e=>upd(()=>{ it.w=Math.max(6,+e.target.value); });
    $('#fH').onchange = e=>upd(()=>{ it.h=Math.max(6,+e.target.value); });
    $('#fEdit').onclick = ()=>editComment(it, false);
  } else if(it.type==='highlight'){
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
  const badge = it => it.type==='highlight' ? '<span class="ty hl">▧</span>'
    : it.type==='comment' ? '<span class="ty cmt">✎</span>'
    : it.type==='text' ? '<span class="ty">T</span>'
    : `<span class="ty" data-img="${it.assetId}"></span>`;
  l.innerHTML = Doc.items.map(it=>`
    <div class="li${it.id===Doc.sel?' on':''}" data-id="${it.id}">
      ${badge(it)}
      <span class="mono">${it.page}</span>
      <span class="t">${esc(it.type==='image' ? (it.name||t('insp.image'))
        : it.type==='highlight' ? t('insp.highlight')
        : it.type==='comment' ? cmtNumber(it.id)+'. '+String(it.text||'').split('\n')[0].slice(0,20)
        : String(it.text||'').split('\n')[0].slice(0,24))}</span>
      <span class="badge${it.locked?' ok':''}">${it.locked?'✓':'·'}</span>
      <button class="del" data-del="${it.id}" title="${esc(t('insp.delete'))}">🗑</button>
    </div>`).join('');
  /* vignette de l'image dans la pastille de type */
  $$('#itemList .ty[data-img]').forEach(async el=>{
    const a = Lib.assets.find(x=>x.id===el.dataset.img);
    if(!a){ el.textContent='?'; return; }
    try{ const img=document.createElement('img'); img.src=await assetUrl(a); el.appendChild(img); }
    catch(e){ el.textContent='🖼'; }
  });
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
const SUFFIX = ()=> localStorage.getItem('pdfed.suffix') ?? '-annote';
/* Nom proposé avant génération : base du document + suffixe paramétrable. */
function askFileName(){
  const base = Doc.name.replace(/\.pdf$/i,'') + SUFFIX();
  return new Promise(res=>{
    modal(`<h3>${esc(t('nav.save'))}</h3>
      <label class="f">${esc(t('m.fileName'))}</label>
      <div class="row"><input type="text" id="fnName" value="${esc(base)}" spellcheck="false">
        <span style="flex:0 0 auto;color:var(--muted)">.pdf</span></div>
      <div class="foot"><button data-close>${esc(t('m.cancel'))}</button>
        <button class="primary" id="fnOk">${esc(t('nav.saveShort'))}</button></div>`);
    let done = false;
    const finish = v=>{ if(!done){ done = true; res(v); } };
    $('#mask').addEventListener('click', function off(e){
      if(e.target.closest('[data-close]') || e.target.id==='mask'){
        $('#mask').removeEventListener('click', off); finish(null);
      }
    });
    const ok = ()=>{
      const v = $('#fnName').value.trim().replace(/[\\/:*?"<>|]/g,'-');
      if(!v) return;
      closeModal(); finish(v.replace(/\.pdf$/i,'') + '.pdf');
    };
    $('#fnOk').onclick = ok;
    $('#fnName').onkeydown = e=>{ if(e.key==='Enter') ok(); };
    const inp = $('#fnName'); inp.focus();
    inp.setSelectionRange(0, inp.value.length);
  });
}
async function exportPdf(){
  if(!Doc.pdf){ toast(t('t.noDoc'),'err'); return; }
  if(!Doc.items.length && !confirm(t('m.exportEmpty'))) return;
  const exportName = await askFileName();
  if(!exportName) return;
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

      if(it.type==='comment'){ continue; }          // traités plus bas, en bloc
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
    await buildComments(out, pages, getFont);
    /* mémorise le dernier numéro pour que la prochaine ouverture enchaîne */
    const lastN = Doc.cmtOffset + commentsInOrder().length;
    if(lastN) try{ out.setKeywords(['pdfed-cmt-max:' + lastN]); }catch(err){ console.warn(err.message); }
    await saveBytes(await out.save(), exportName);
    Doc.dirty = false;
    toast(t('t.pdfDone'),'ok');
  }catch(err){
    console.error(err);
    toast(err.message==='locked' ? t('t.lockedExport') : t('t.genFail',{e:err.message}), 'err');
  }finally{ btns.forEach((b,i)=>{ b.disabled=false; b.innerHTML=prev[i]; }); }
}
/* ---------------------------------------------------------------------
   Commentaires à l'export.

   Trois constats tirés des essais sur iOS gouvernent ce code :
   - l'apparence (/AP) d'une annotation /Link n'est pas dessinée par tous
     les lecteurs : ce qui doit être vu va donc dans le flux de contenu ;
   - une annotation de balisage posée sous un lien capte le toucher :
     la pastille cliquable est placée hors du cadre, sans recouvrement ;
   - /Highlight est le type de balisage qui ouvre le plus fidèlement sa
     bulle : c'est lui qui porte le texte du commentaire.
   Le flux de contenu d'origine n'est jamais réécrit, seulement complété.
   --------------------------------------------------------------------- */
/* Rend la zone encadrée d'un commentaire en image, redressée si le cadre est
   pivoté. Le rendu de la page est mis en cache : plusieurs commentaires sur une
   même page ne la recalculent pas.

   La transformation inverse celle du cadre. L'élément est affiché tourné de
   -rot degrés autour de son centre c ; un point local (u,v) apparaît donc en
   c + R(rot)·(u,v). Pour redresser, on applique R⁻¹ après avoir ramené c à
   l'origine, ce qui donne translate(w/2,h/2) ∘ R(rot) ∘ translate(−c). */
const shotCache = new Map();
async function pageCanvas(n, k){
  const key = n + '@' + k;
  if(!shotCache.has(key)){
    const p  = await Doc.pdf.getPage(n);
    const vp = p.getViewport({scale:k});
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    await p.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
    shotCache.set(key, cv);
  }
  return shotCache.get(key);
}
async function shotOf(it, maxHpt){
  const k = 2;                                   // deux fois la définition, pour rester net
  const src = await pageCanvas(it.page, k);
  const hh  = Math.min(it.h, maxHpt);            // troncature par le bas
  const cv  = document.createElement('canvas');
  cv.width  = Math.max(1, Math.round(it.w * k));
  cv.height = Math.max(1, Math.round(hh  * k));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(it.w * k / 2, it.h * k / 2);
  ctx.rotate(it.rot * Math.PI / 180);
  ctx.translate(-(it.x + it.w/2) * k, -(it.y + it.h/2) * k);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
  return {bytes: await canvasToBytes(cv, 'image/png'), w: it.w, h: hh};
}

function wrapPdf(txt, font, size, maxW){
  const out = [];
  for(const para of String(txt).split('\n')){
    let line = '';
    for(const word of para.split(' ')){
      const test = line ? line+' '+word : word;
      if(font.widthOfTextAtSize(test, size) > maxW && line){ out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}
const NOTE_ON   = ()=> localStorage.getItem('pdfed.note') !== '0';
const ANNEX_1ST = ()=> localStorage.getItem('pdfed.annexFirst') === '1';
const SHOT_ON   = ()=> localStorage.getItem('pdfed.shot') === '1';
const SHOT_MAX  = ()=> clamp(parseInt(localStorage.getItem('pdfed.shotMax') || '25', 10) || 25, 5, 100);
async function buildComments(out, pages, getFont){
  const list = commentsInOrder();
  const noteOn = NOTE_ON();
  if(!list.length) return;
  const { PDFName, PDFString, PDFArray, PDFNumber, degrees, rgb } = PDFLib;
  const ctx  = out.context;
  const reg  = await getFont(DEFAULT_FONT, 'n');
  const bold = await getFont(DEFAULT_FONT, 'b');
  const annotsOf = page=>{
    let a = page.node.lookup(PDFName.of('Annots'), PDFArray);
    if(!a){ a = ctx.obj([]); page.node.set(PDFName.of('Annots'), a); }
    return a;
  };
  const goTo = (ref, y)=> ctx.obj({ S:'GoTo',
    D: ctx.obj([ref, PDFName.of('XYZ'), PDFNumber.of(0), PDFNumber.of(y), null]) });

  /* --- pages d'annexe ---------------------------------------------------
     Une annexe produite lors d'un passage précédent est marquée par deux
     clés privées : PDFEdAnnex l'identifie, PDFEdY mémorise où s'est arrêtée
     la mise en page. On reprend donc au bon endroit de la dernière page
     d'annexe, et on n'en ouvre une nouvelle que si la place manque. */
  const K_ANNEX = PDFName.of('PDFEdAnnex'), K_Y = PDFName.of('PDFEdY');
  const first = pages[0] ? pages[0].getSize() : {width:595, height:842};
  const W = first.width, H = first.height, MA = 64, TW = W - MA*2 - 30;
  const header = page=>{
    const sz = page.getSize();
    page.drawText(t('exp.annexTitle'), {x:MA, y:sz.height-56, size:15, font:bold, color:rgb(.1,.11,.17)});
    page.drawLine({start:{x:MA,y:sz.height-66}, end:{x:sz.width-MA,y:sz.height-66},
                   thickness:.7, color:rgb(.72,.74,.8)});
  };
  /* Option : l'annexe ouvre le document au lieu de le clore. Les pages insérées
     le sont dans l'ordre, juste après celles déjà placées lors de cet export. */
  let inserted = 0;
  const newAnnex = ()=>{
    const p = ANNEX_1ST() ? out.insertPage(inserted++, [W,H]) : out.addPage([W,H]);
    p.node.set(K_ANNEX, PDFNumber.of(1));
    header(p);
    return p;
  };
  let annex = null, y = 0;
  const all = out.getPages();
  for(let i = all.length-1; i >= 0; i--){
    if(all[i].node.get(K_ANNEX)){
      const prev = all[i].node.lookup(K_Y);
      const py = prev && typeof prev.asNumber === 'function' ? prev.asNumber() : NaN;
      if(py > 140){ annex = all[i]; y = py; }
      break;                       // seule la dernière annexe nous intéresse
    }
  }
  if(!annex){ annex = newAnnex(); y = H - 104; }
  const dests = [];

  const num = i => Doc.cmtOffset + i + 1;
  /* Copie du passage : rendue avant la mise en page, pour connaître sa hauteur. */
  const shots = [];
  if(SHOT_ON() && Doc.pdf){
    const maxH = H * SHOT_MAX() / 100;
    for(const it of list){
      try{
        const sh = await shotOf(it, maxH);
        const sc = Math.min(1, TW / sh.w);       // jamais plus large que la colonne
        shots.push({img: await out.embedPng(sh.bytes), w: sh.w * sc, h: sh.h * sc});
      }catch(err){ console.warn('extrait:', err.message); shots.push(null); }
    }
  }
  for(let i = 0; i < list.length; i++){
    const it = list[i], sh = shots[i] || null;
    const lines = wrapPdf(it.text || '', reg, 10, TW);
    const need  = 34 + (sh ? sh.h + 10 : 0) + lines.length*14 + 34;
    if(y - need < 64){ annex = newAnnex(); y = H - 104; }
    const c = hexRgb(it.color);
    annex.drawCircle({x:MA+9, y:y+4, size:9.5, color:c});
    annex.drawText(String(num(i)), {x:MA+6.2, y:y+.6, size:10, font:bold, color:rgb(1,1,1)});
    const titre = `${t('exp.page')} ${it.page}${it.author ? '  ·  '+it.author : ''}`;
    annex.drawText(titre, {x:MA+28, y:y, size:10.5, font:bold, color:rgb(.12,.13,.2)});
    y -= 18;
    if(sh){
      y -= sh.h;
      annex.drawImage(sh.img, {x:MA+28, y:y, width:sh.w, height:sh.h});
      annex.drawRectangle({x:MA+28, y:y, width:sh.w, height:sh.h,
        borderWidth:.6, borderColor:rgb(.72,.74,.8)});
      y -= 12;
    }
    lines.forEach(l=>{ annex.drawText(l, {x:MA+28, y:y, size:10, font:reg, color:rgb(.12,.13,.2)}); y -= 14; });
    y -= 12;
    const bw = Math.min(200, reg.widthOfTextAtSize(t('exp.back'), 9.5) + 26);
    annex.drawRectangle({x:MA+28, y:y-4, width:bw, height:21, borderWidth:1,
      borderColor:rgb(.55,.58,.68), color:rgb(.95,.96,.98)});
    annex.drawText(t('exp.back'), {x:MA+37, y:y+2.5, size:9.5, font:reg, color:rgb(.2,.22,.32)});
    dests.push({annex, top:y+70, btn:[MA+28, y-4, MA+28+bw, y+17]});
    y -= 40;
  }
  annex.node.set(K_Y, PDFNumber.of(Math.round(y)));   // reprise au prochain passage

  /* --- marques sur les pages, annotations, aller-retour ------------------ */
  list.forEach((it,i)=>{
    const page = pages[it.page-1]; if(!page) return;
    const vp1 = Doc.vp1.get(it.page), pageRot = Doc.rot.get(it.page) || 0;
    const c = hexRgb(it.color);
    const corner = (lx,ly)=> toPdf(vp1, it, pageRot, lx, ly);
    const ul = corner(-it.w/2,  it.h/2), ur = corner( it.w/2,  it.h/2);
    const ll = corner(-it.w/2, -it.h/2), lr = corner( it.w/2, -it.h/2);
    const badge = corner(-it.w/2 - 17, it.h/2 - 10);

    /* dessiné dans le contenu : visible partout, y compris à l'impression,
       et d'une opacité que le lecteur ne peut pas réinterpréter */
    page.drawRectangle({x:ll.x, y:ll.y, width:it.w, height:it.h,
      color:c, opacity:0.06, borderWidth:1.4, borderColor:c,
      rotate:degrees(ll.theta)});
    page.drawCircle({x:badge.x, y:badge.y, size:9.5, color:c});
    const nStr = String(num(i));
    page.drawText(nStr, {x:badge.x - 2.9*nStr.length, y:badge.y-3.6, size:10, font:bold, color:rgb(1,1,1)});

    const A = annotsOf(page), d = dests[i];
    const bbox = [Math.min(ul.x,ur.x,ll.x,lr.x), Math.min(ul.y,ur.y,ll.y,lr.y),
                  Math.max(ul.x,ur.x,ll.x,lr.x), Math.max(ul.y,ur.y,ll.y,lr.y)];

    /* Aucun balisage n'est posé sur le texte : un /Highlight y déclenche la
       sélection de texte plutôt que sa bulle sur certains lecteurs. La zone
       entière devient un lien vers la note, mécanisme accepté partout. */
    A.push(ctx.register(ctx.obj({
      Type:'Annot', Subtype:'Link', F:4, Rect: ctx.obj(bbox),
      Border: ctx.obj([0,0,0]), A: goTo(d.annex.ref, d.top)
    })));
    /* la pastille, isolée dans la marge, mène à la même note */
    A.push(ctx.register(ctx.obj({
      Type:'Annot', Subtype:'Link', F:4,
      Rect: ctx.obj([badge.x-11, badge.y-11, badge.x+11, badge.y+11]),
      Border: ctx.obj([0,0,0]), A: goTo(d.annex.ref, d.top)
    })));
    /* Note autocollante dans la marge, toujours 28 points sous la pastille.
       L'ancien calage sur la hauteur du cadre faisait coïncider les deux centres
       dès que le cadre était bas : l'icône du lecteur recouvrait alors le numéro. */
    if(noteOn){
    const note = corner(-it.w/2 - 17, it.h/2 - 38);
    const popRef = ctx.nextRef(), noteRef = ctx.nextRef();
    ctx.assign(noteRef, ctx.obj({
      Type:'Annot', Subtype:'Text', F:4, Name:'Comment',
      Rect: ctx.obj([note.x-10, note.y-10, note.x+10, note.y+10]),
      C: ctx.obj([c.red, c.green, c.blue]), Open:false,
      T: PDFString.of(it.author || ''),
      Contents: PDFString.of(`${num(i)}. ${it.text || ''}`),
      NM: PDFString.of('cmt-'+num(i)),
      M: PDFString.fromDate(new Date()), CreationDate: PDFString.fromDate(new Date()),
      Popup: popRef
    }));
    ctx.assign(popRef, ctx.obj({ Type:'Annot', Subtype:'Popup', Parent:noteRef, Open:false,
      Rect: ctx.obj([Math.max(20, ll.x), Math.max(20, ll.y-110), Math.max(260, ll.x+240), Math.max(120, ll.y-8)]) }));
    A.push(noteRef); A.push(popRef);
    }
    /* retour : depuis le bouton de l'annexe vers le passage */
    annotsOf(d.annex).push(ctx.register(ctx.obj({
      Type:'Annot', Subtype:'Link', F:4, Rect: ctx.obj(d.btn),
      Border: ctx.obj([0,0,0]),
      A: goTo(page.ref, Math.max(ul.y, ur.y) + 40)
    })));
  });
}

const saveBytes = (bytes, filename)=>
  saveFile(new Blob([bytes], {type:'application/pdf'}), filename);

/* Sélecteur natif quand il existe, partage sur mobile, téléchargement sinon. */
async function saveFile(blob, filename){
  const mime = blob.type || 'application/octet-stream';
  const ext  = '.' + (filename.split('.').pop() || 'bin');
  if(window.showSaveFilePicker){
    try{
      const h = await showSaveFilePicker({suggestedName:filename,
        types:[{description:ext.slice(1).toUpperCase(), accept:{[mime]:[ext]}}]});
      const w = await h.createWritable(); await w.write(blob); await w.close(); return;
    }catch(e){ if(e.name==='AbortError') return; }
  }
  const file = new File([blob], filename, {type:mime});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:filename}); return; }
    catch(e){ if(e.name==='AbortError') return; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

/* ---------------------------------------------------------------------
   10. Écran d'accueil / aide
   ------------------------------------------------------------------ */
/* Aide illustrée : la même note, avec et sans copie du passage. Les vignettes
   sont dessinées en SVG plutôt qu'embarquées en image, pour suivre le thème. */
function annexSample(withShot){
  const c = '#cc2a2e';
  const line = (x,y,w,o) => `<rect x="${x}" y="${y}" width="${w}" height="3.4" rx="1.7"
     fill="currentColor" opacity="${o}"/>`;
  return `<svg viewBox="0 0 150 116" xmlns="http://www.w3.org/2000/svg" color="currentColor">
    <rect x="0.5" y="0.5" width="149" height="115" rx="4" fill="none" stroke="currentColor" opacity=".25"/>
    ${line(12,12,64,.85)}
    <line x1="12" y1="22" x2="138" y2="22" stroke="currentColor" opacity=".25"/>
    <circle cx="17" cy="34" r="6" fill="${c}"/>
    <text x="17" y="37" font-size="7.5" font-weight="700" fill="#fff" text-anchor="middle">1</text>
    ${line(28,31,54,.8)}
    ${withShot ? `
      <rect x="28" y="43" width="104" height="26" fill="none" stroke="${c}" stroke-width="1.2"/>
      <rect x="28" y="43" width="104" height="26" fill="${c}" opacity=".05"/>
      ${line(33,49,86,.45)}${line(33,57,68,.45)}
      ${line(28,77,104,.55)}${line(28,85,88,.55)}
      <rect x="28" y="95" width="46" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/>`
    : `
      ${line(28,45,104,.55)}${line(28,53,88,.55)}${line(28,61,72,.55)}
      <rect x="28" y="73" width="46" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/>`}
  </svg>`;
}
function showShotHelp(){
  modal(`<h3>${esc(t('help.shotTitle'))}</h3><p>${esc(t('help.shotBody'))}</p>
    <div class="examples">
      <figure>${annexSample(true)}<figcaption>${esc(t('help.withShot'))}</figcaption></figure>
      <figure>${annexSample(false)}<figcaption>${esc(t('help.withoutShot'))}</figcaption></figure>
    </div>
    <div class="foot"><button class="primary" data-close>${esc(t('m.close'))}</button></div>`);
}

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
/* Sur iPhone, l'API plein écran n'existe pas pour autre chose qu'une vidéo :
   seul un ajout à l'écran d'accueil supprime le cadre du navigateur. */
async function toggleFullscreen(){
  const el = document.documentElement;
  try{
    if(document.fullscreenElement){ await document.exitFullscreen(); return; }
    if(el.requestFullscreen){ await el.requestFullscreen({navigationUI:'hide'}); closeModal(); return; }
    if(el.webkitRequestFullscreen){ el.webkitRequestFullscreen(); closeModal(); return; }
    toast(t('t.fsNo'));
  }catch(err){ toast(t('t.fsNo')); }
}

async function doInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  if($('#themeSeg')) showSettingsModal();
}
addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; if($('#themeSeg')) showSettingsModal(); });
addEventListener('appinstalled', ()=>{ deferredPrompt=null; if($('#themeSeg')) showSettingsModal(); toast(t('t.installed'),'ok'); });

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
addEventListener('beforeunload', e=>{ if(Doc.items.length && Doc.dirty){ e.preventDefault(); e.returnValue=''; } });
addEventListener('resize', ()=>{
  if(!isSmall()){ $$('aside').forEach(a=>a.classList.remove('open')); $('#scrim').classList.remove('on'); }
  if(!Doc.pdf) return;
  fitDocName();
  clearTimeout(Doc.rt);
  Doc.rt = setTimeout(()=>{ Doc.autoFit ? fitPage() : drawItems(); }, 180);
});

applyI18n();
applyToolbar(tbPos());
updateFlag();
$('#appVer').textContent = APP_VERSION;
setDocName('');
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
