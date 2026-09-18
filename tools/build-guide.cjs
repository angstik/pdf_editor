/* =====================================================================
   Génère assets/help/guide-fr.pdf

   Les illustrations sont des reproductions schématiques de l'interface,
   dessinées ici même : elles restent fidèles à la disposition réelle et
   se régénèrent avec le guide, ce qu'une capture d'écran ne ferait pas.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PDFLib = require(path.join(ROOT, 'vendor/pdf-lib.min.js'));
const fontkit = require(path.join(ROOT, 'vendor/fontkit.umd.min.js'));
const { PDFDocument, rgb } = PDFLib;

const W = 595.28, H = 841.89, M = 58;
const C = {
  text: rgb(.11, .12, .18), soft: rgb(.42, .45, .54), line: rgb(.84, .86, .9),
  panel: rgb(.965, .97, .98), ink: rgb(.247, .373, .91), stamp: rgb(.77, .17, .17),
  ok: rgb(.13, .55, .39), hi: rgb(1, .88, .3), white: rgb(1, 1, 1), page: rgb(.99, .99, 1)
};

let doc, reg, bold, ital, page, y;

/* ------------------------------------------------------------ outils */
function newPage(){
  page = doc.addPage([W, H]);
  y = H - 64;
  return page;
}
function foot(n){
  page.drawText('EDITION PDF — Guide', {x:M, y:34, size:8, font:reg, color:C.soft});
  page.drawText(String(n), {x:W-M-6, y:34, size:8, font:reg, color:C.soft});
  page.drawLine({start:{x:M,y:48}, end:{x:W-M,y:48}, thickness:.5, color:C.line});
}
function h1(txt){
  page.drawText(txt, {x:M, y, size:21, font:bold, color:C.text});
  y -= 10;
  page.drawLine({start:{x:M,y}, end:{x:M+46,y}, thickness:2.4, color:C.ink});
  y -= 22;
}
function h2(txt){
  y -= 6;
  page.drawText(txt, {x:M, y, size:13, font:bold, color:C.text});
  y -= 17;
}
function wrap(txt, font, size, maxW){
  const out = [];
  for(const para of String(txt).split('\n')){
    let line = '';
    for(const word of para.split(' ')){
      const test = line ? line + ' ' + word : word;
      if(font.widthOfTextAtSize(test, size) > maxW && line){ out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}
function para(txt, opts = {}){
  const size = opts.size || 10.5, font = opts.font || reg, color = opts.color || C.text;
  const x = opts.x || M, maxW = opts.maxW || (W - M*2);
  for(const l of wrap(txt, font, size, maxW)){
    page.drawText(l, {x, y, size, font, color});
    y -= size * 1.42;
  }
  y -= opts.gap === undefined ? 6 : opts.gap;
}
function bullet(txt, opts = {}){
  const size = 10.5, x = (opts.x || M) + 14;
  page.drawCircle({x: x - 8, y: y + 3.4, size: 2, color: C.ink});
  for(const l of wrap(txt, reg, size, (opts.maxW || (W - M*2)) - 14)){
    page.drawText(l, {x, y, size, font: reg, color: C.text});
    y -= size * 1.42;
  }
  y -= 3;
}
/* encadré de mise en avant */
function callout(title, txt, tone = C.ink){
  const lines = wrap(txt, reg, 10.5, W - M*2 - 34);
  const h = 34 + lines.length * 14.9;
  page.drawRectangle({x:M, y:y - h + 14, width:W - M*2, height:h, color:C.panel});
  page.drawRectangle({x:M, y:y - h + 14, width:3.5, height:h, color:tone});
  let yy = y - 2;
  page.drawText(title, {x:M+16, y:yy, size:11.5, font:bold, color:tone});
  yy -= 17;
  for(const l of lines){ page.drawText(l, {x:M+16, y:yy, size:10.5, font:reg, color:C.text}); yy -= 14.9; }
  y = y - h - 4;
}
/* pastille numérotée, pour les légendes */
function tag(x, yy, n, tone = C.stamp){
  page.drawCircle({x, y:yy, size:7.6, color:tone});
  const s = String(n);
  page.drawText(s, {x: x - reg.widthOfTextAtSize(s, 8)/2, y: yy - 2.8, size:8, font:bold, color:C.white});
}
function legend(items, col2 = false){
  const colW = col2 ? (W - M*2 - 20) / 2 : W - M*2 - 26;
  let i = 0, y0 = y, yA = y, yB = y;
  for(const [n, label, desc] of items){
    const left = col2 && i % 2 === 1;
    const x = left ? M + colW + 20 : M;
    let yy = col2 ? (left ? yB : yA) : y;
    tag(x + 7, yy + 3.2, n);
    page.drawText(label, {x:x + 20, y:yy, size:10, font:bold, color:C.text});
    yy -= 13.5;
    for(const l of wrap(desc, reg, 9.5, colW - 20)){
      page.drawText(l, {x:x + 20, y:yy, size:9.5, font:reg, color:C.soft});
      yy -= 12.4;
    }
    yy -= 5;
    if(col2){ if(left) yB = yy; else yA = yy; } else y = yy;
    i++;
  }
  if(col2) y = Math.min(yA, yB);
}

/* ------------------------------------------- maquettes de l'interface */
function chip(x, yy, w, h, opts = {}){
  page.drawRectangle({x, y:yy, width:w, height:h,
    color: opts.fill || C.white, borderWidth: opts.bw === undefined ? .7 : opts.bw,
    borderColor: opts.border || C.line});
  if(opts.label){
    const f = opts.font || reg, s = opts.size || 7.5;
    page.drawText(opts.label, {x: x + (w - f.widthOfTextAtSize(opts.label, s))/2,
      y: yy + (h - s)/2 + .8, size:s, font:f, color: opts.color || C.text});
  }
}
function textLines(x, yy, w, n, step = 7, opacity = .5){
  for(let i = 0; i < n; i++){
    const ww = i === n - 1 ? w * .62 : w * (.82 + (i % 3) * .06);
    page.drawRectangle({x, y: yy - i*step, width: ww, height: 2.1, color: C.soft, opacity});
  }
}
/* fenêtre complète de l'application */
function mockApp(x, yy, w, h, opt = {}){
  const hdr = 22, tb = 20, lib = opt.panels === false ? 0 : w * .22, insp = opt.panels === false ? 0 : w * .24;
  page.drawRectangle({x, y:yy, width:w, height:h, color:C.white, borderWidth:.8, borderColor:C.line});
  // barre du haut
  page.drawRectangle({x, y:yy + h - hdr, width:w, height:hdr, color:C.panel, borderWidth:.8, borderColor:C.line});
  let bx = x + 6;
  ['☰','📂'].forEach(()=>{ chip(bx, yy + h - hdr + 4, 14, 14); bx += 17; });
  page.drawRectangle({x:bx + 2, y: yy + h - hdr + 9, width:w * .3, height:2.4, color:C.soft, opacity:.55});
  let rx = x + w - 6 - 14;
  ['⚙','⬇','📋','✕'].forEach(()=>{ chip(rx, yy + h - hdr + 4, 14, 14); rx -= 17; });
  // barre d'outils
  page.drawRectangle({x, y:yy + h - hdr - tb, width:w, height:tb, color:C.panel, borderWidth:.8, borderColor:C.line});
  bx = x + 6;
  for(let i = 0; i < 5; i++){ chip(bx, yy + h - hdr - tb + 3.5, 13, 13); bx += 16; }
  rx = x + w - 6 - 13;
  for(let i = 0; i < 5; i++){ chip(rx, yy + h - hdr - tb + 3.5, 13, 13); rx -= 16; }
  const bodyY = yy, bodyH = h - hdr - tb;
  // panneaux
  if(lib){
    page.drawRectangle({x, y:bodyY, width:lib, height:bodyH, color:C.panel, borderWidth:.8, borderColor:C.line});
    for(let r = 0; r < 3; r++) for(let c = 0; c < 2; c++)
      chip(x + 7 + c * (lib/2 - 4), bodyY + bodyH - 34 - r*26, lib/2 - 11, 20);
    page.drawRectangle({x:x + 6, y:bodyY + bodyH - 18, width:lib - 12, height:2.4, color:C.soft, opacity:.5});
  }
  if(insp){
    const ix = x + w - insp;
    page.drawRectangle({x:ix, y:bodyY, width:insp, height:bodyH, color:C.panel, borderWidth:.8, borderColor:C.line});
    page.drawRectangle({x:ix + 6, y:bodyY + bodyH - 18, width:insp - 12, height:2.4, color:C.soft, opacity:.5});
    for(let r = 0; r < 5; r++) chip(ix + 7, bodyY + bodyH - 40 - r*18, insp - 14, 12);
  }
  // page du document
  const px = x + lib + 10, pw = w - lib - insp - 20, ph = bodyH - 16;
  page.drawRectangle({x:px, y:bodyY + 8, width:pw, height:ph, color:C.page, borderWidth:.7, borderColor:C.line});
  textLines(px + 10, bodyY + ph - 8, pw - 20, 4);
  if(opt.marks !== false){
    // surlignage, cadre de commentaire et pastille
    page.drawRectangle({x:px + 10, y:bodyY + ph - 36, width:pw * .5, height:8, color:C.hi, opacity:.75});
    page.drawRectangle({x:px + 10, y:bodyY + ph - 74, width:pw - 20, height:26,
      borderWidth:1.1, borderColor:C.stamp, color:C.stamp, opacity:.05});
    page.drawCircle({x:px + 4, y:bodyY + ph - 52, size:6, color:C.stamp});
    textLines(px + 16, bodyY + ph - 56, pw - 34, 2);
  }
  return {px, pw, bodyY, bodyH, hdr, tb};
}
/* panneau de saisie d'un commentaire */
function mockComposer(x, yy, w){
  const h = 62;
  page.drawRectangle({x, y:yy, width:w, height:h, color:C.panel, borderWidth:.9, borderColor:C.line});
  chip(x + 8, yy + h - 22, 20, 14, {fill:C.stamp, border:C.stamp});
  chip(x + 33, yy + h - 22, 9, 9, {fill:C.ink, border:C.ink});
  page.drawText('Incl. source', {x:x + 46, y:yy + h - 19, size:7.5, font:reg, color:C.text});
  let rx = x + w - 8 - 18;
  ['ok','no','set','clr'].forEach((_, i)=>{
    chip(rx, yy + h - 23, 18, 15, {fill: i === 0 ? C.ok : C.white, border: i === 0 ? C.ok : C.line});
    rx -= 21;
  });
  page.drawRectangle({x:x + 8, y:yy + 8, width:w - 16, height:h - 38, color:C.white, borderWidth:.7, borderColor:C.line});
  textLines(x + 14, yy + h - 44, w - 30, 2);
  return h;
}

/* ------------------------------------------------- captures d'écran */
const SHOTS = {};
async function loadShots(){
  const dir = path.join(__dirname, 'shots');
  for(const f of fs.readdirSync(dir)){
    if(!/\.png$/.test(f)) continue;
    SHOTS[f.replace(/\.png$/, '')] = await doc.embedPng(fs.readFileSync(path.join(dir, f)));
  }
}
/* Pose une capture à la largeur voulue et rend son rectangle, pour pouvoir
   y placer ensuite des repères en coordonnées relatives. */
function shot(name, x, yTop, w){
  const img = SHOTS[name];
  const h = w * img.height / img.width;
  page.drawRectangle({x:x - 2, y:yTop - h - 2, width:w + 4, height:h + 4,
    color:C.white, borderWidth:.8, borderColor:C.line});
  page.drawImage(img, {x, y:yTop - h, width:w, height:h});
  return {x, y:yTop - h, w, h, top:yTop};
}
const tagOn = (r, fx, fy, n) => tag(r.x + r.w*fx, r.top - r.h*fy, n);



/* ===================================================================== */
(async () => {
  doc = await PDFDocument.create();
  doc.registerFontkit(fontkit.default || fontkit);
  const f = n => fs.readFileSync(path.join(ROOT, 'vendor/fonts', n + '.ttf'));
  reg  = await doc.embedFont(f('Montserrat-Regular'),  {subset:true});
  bold = await doc.embedFont(f('Montserrat-Bold'),     {subset:true});
  ital = await doc.embedFont(f('Montserrat-Italic'),   {subset:true});
  doc.setTitle('EDITION PDF — Guide');
  doc.setAuthor('DW');
  doc.setSubject("Guide d'utilisation");
  await loadShots();

  /* ---------------------------------------------------- 1. couverture */
  newPage();
  page.drawRectangle({x:0, y:H - 300, width:W, height:300, color:C.panel});
  page.drawRectangle({x:0, y:H - 300, width:W, height:4, color:C.ink});
  page.drawText('EDITION PDF', {x:M, y:H - 150, size:38, font:bold, color:C.text});
  page.drawText("Signer, surligner et commenter un PDF", {x:M, y:H - 182, size:15, font:reg, color:C.soft});
  page.drawText("sans jamais l'envoyer nulle part", {x:M, y:H - 203, size:15, font:ital, color:C.ink});
  y = H - 336;
  shot('main', (W - 230)/2, y, 230);
  y -= 300;
  para("Ce guide présente l'application écran par écran, bouton par bouton, et se termine par "
     + "une série d'astuces qui font gagner du temps.", {size:11});
  y = 120;
  page.drawLine({start:{x:M,y:y+18}, end:{x:W-M,y:y+18}, thickness:.6, color:C.line});
  page.drawText('Version ' + (process.env.GUIDE_VERSION || 'v1.0'), {x:M, y, size:10, font:bold, color:C.text});
  page.drawText('Copyright DW-2026', {x:M, y:y - 15, size:10, font:reg, color:C.soft});
  page.drawText('Licence MIT — voir la dernière page', {x:M, y:y - 30, size:9, font:reg, color:C.soft});

  /* ------------------------------------------ 2. finalité, confidentialité */
  newPage(); foot(2);
  h1('À quoi sert cette application');
  para("Vous recevez un contrat, un devis, un formulaire. Il faut le signer, en surligner un passage, "
     + "y porter une remarque, puis le renvoyer. C'est exactement ce que fait cette application, et "
     + "rien d'autre.");
  para("Elle pose sur vos pages des signatures, des images, du texte, des surlignages et des "
     + "commentaires, puis régénère un PDF que vous enregistrez ou partagez. Le texte d'origine "
     + "n'est jamais réécrit : il reste sélectionnable et cherchable sous vos ajouts.");
  y -= 6;
  callout('Vos documents ne quittent pas votre appareil',
    "Il n'y a pas de serveur. Le PDF est lu, affiché et régénéré par votre navigateur, sur votre "
    + "machine. Aucun fichier, aucune signature, aucun commentaire n'est transmis à qui que ce soit. "
    + "L'application fonctionne d'ailleurs entièrement hors connexion une fois installée.", C.ok);
  callout('Votre bibliothèque de signatures peut être chiffrée',
    "Les signatures que vous conservez sont stockées dans votre navigateur. Vous pouvez les protéger "
    + "par un mot de passe : elles sont alors chiffrées en AES-GCM 256 bits, avec une clé dérivée par "
    + "PBKDF2-SHA256. Le mot de passe n'est stocké nulle part — perdu, les signatures sont "
    + "irrécupérables.", C.ink);
  h2('Installer comme une application');
  para("Sur Android et sur ordinateur, le navigateur propose l'installation. Sur iPhone, ouvrez le "
     + "menu Partager puis « Sur l'écran d'accueil ». L'application s'ouvre alors sans le cadre du "
     + "navigateur et fonctionne hors ligne.");

  /* ------------------------------------------------- 3. l'écran principal */
  newPage(); foot(3);
  h1("L'écran principal");
  const r3 = shot('main', M, y, 236);
  /* repères posés en coordonnées relatives à la capture */
  tagOn(r3, 0.05, 0.055, 1);
  tagOn(r3, 0.27, 0.055, 2);
  tagOn(r3, 0.95, 0.055, 3);
  tagOn(r3, 0.05, 0.165, 4);
  tagOn(r3, 0.95, 0.165, 5);
  tagOn(r3, 0.22, 0.86,  6);
  /* légende à droite de la capture */
  let ylg = y - 6;
  const lgx = M + 236 + 24, lgw = W - M - lgx;
  for(const [n, label, desc] of [
    [1, 'Panneaux et ouverture', "Bibliothèque, sélecteur de fichiers, nom du document, fermeture."],
    [2, 'Nom du document', "Vide, un appui ouvre le sélecteur."],
    [3, 'Copier, enregistrer, propriétés', "Récapitulatif des commentaires, génération du PDF, panneau de droite."],
    [4, 'Navigation et zoom', "Pages, numéro courant, ajustement à l'écran."],
    [5, 'Outils', "Annuler, rétablir, texte, surligneur, commentaire."],
    [6, 'Le document', "Vos ajouts s'y posent ; ici un texte incliné."]
  ]){
    tag(lgx + 7, ylg + 3.2, n);
    page.drawText(label, {x:lgx + 20, y:ylg, size:9.5, font:bold, color:C.text});
    ylg -= 12.5;
    for(const l of wrap(desc, reg, 9, lgw - 20)){
      page.drawText(l, {x:lgx + 20, y:ylg, size:9, font:reg, color:C.soft}); ylg -= 11.6;
    }
    ylg -= 7;
  }
  y = Math.min(ylg, y - r3.h - 16);
  y -= 6;
  h2('Poser un élément');
  bullet("Une signature : touchez sa vignette dans la bibliothèque, elle se pose au centre de la page.");
  bullet("Du texte : bouton T, saisissez, avec insertion possible de la date, de l'heure ou des deux.");
  bullet("Un surlignage : bouton surligneur, puis tracez sur le passage.");
  bullet("Un commentaire : bouton commentaire, puis tracez le cadre autour de la zone concernée.");
  y -= 4;
  para("Un élément sélectionné porte quatre poignées : le coin pour la taille, le côté droit et le "
     + "bas pour une seule dimension sur les rectangles, la poignée ronde du haut pour la rotation, "
     + "et la corbeille rouge pour le retirer.", {size:10});

  /* ----------------------------------------------- 4. les commentaires */
  newPage(); foot(4);
  h1('Commenter un document');
  para("Tracez un cadre autour du passage concerné : le panneau de saisie s'ouvre sous le document. "
     + "Il n'est pas modal — le document reste défilable et zoomable pendant que vous écrivez, et le "
     + "cadre lui-même reste déplaçable.");
  y -= 4;
  const r4 = shot('composer', M, y, 232);
  tagOn(r4, 0.09, 0.80, 1);
  tagOn(r4, 0.28, 0.80, 2);
  tagOn(r4, 0.57, 0.80, 4);
  tagOn(r4, 0.92, 0.80, 3);
  const r4b = shot('author', M + 232 + 20, y, 150);
  page.drawText("L'engrenage ouvre la saisie de l'auteur.",
    {x:M + 232 + 20, y:y - r4b.h - 12, size:8.5, font:ital, color:C.soft});
  y -= Math.max(r4.h, r4b.h) + 18;
  legend([
    [1, 'Couleur', "Ouvre la ligne de couleurs : noir, couleur courante, vos dernières, les primaires, puis le sélecteur du système."],
    [2, 'Incl. source', "Joint à la note une image du passage encadré, à sa taille d'origine."],
    [3, 'Valider, abandonner', "Le vert enregistre, la croix supprime le cadre."],
    [4, "Auteur, effacer", "L'engrenage saisit votre nom, repris ensuite ; la gomme vide la zone de saisie."]
  ], true);
  y -= 2;
  h2("Ce que devient un commentaire dans le PDF");
  para("Chaque commentaire produit un cadre et une pastille numérotée dessinés dans la page, donc "
     + "visibles dans n'importe quel lecteur et à l'impression, et une note en annexe reprenant le "
     + "texte, l'auteur et la page. Un lien invisible relie les deux : touchez le cadre ou la "
     + "pastille pour aller à la note, un bouton vous ramène au passage exact.");
  callout('Pourquoi une annexe plutôt qu\'une simple bulle',
    "Les bulles de commentaire du format PDF ne s'ouvrent pas partout : certains lecteurs, dont "
    + "ceux des téléphones, les ignorent. Les liens internes, eux, fonctionnent partout. L'annexe "
    + "garantit donc que votre relecteur verra vos remarques, quel que soit son outil.", C.ink);

  /* --------------------------------------- 5. bibliothèque et signatures */
  newPage(); foot(5);
  h1('La bibliothèque de signatures');
  para("Elle conserve vos signatures d'une session à l'autre, dans votre navigateur. Trois façons "
     + "de l'alimenter : importer une image, dessiner directement au doigt ou au stylet, ou charger "
     + "un fichier de bibliothèque chiffré.");
  const r5a = shot('library', M, y, 176);
  const r5b = shot('draw', M + 176 + 22, y, 176);
  page.drawText("La bibliothèque et ses vignettes", {x:M, y:y - r5a.h - 12, size:8.5, font:ital, color:C.soft});
  page.drawText("Dessiner une signature au doigt", {x:M + 176 + 22, y:y - r5b.h - 12, size:8.5, font:ital, color:C.soft});
  y -= Math.max(r5a.h, r5b.h) + 28;   // la plus haute des deux commande la suite
  h2('Les actions de chaque vignette');
  legend([
    [1, 'Poser', "Un appui sur l'image la place sur la page courante."],
    [2, 'Renommer', "Le crayon change le nom affiché."],
    [3, 'Détourer', "Le demi-cercle rend le fond transparent : indispensable pour une signature scannée."],
    [4, 'Télécharger', "La flèche récupère l'image telle qu'elle est stockée."],
    [5, 'Supprimer', "La corbeille la retire, après confirmation."]
  ], true);
  h2('Protéger et transporter');
  bullet("Le cadenas chiffre toute la bibliothèque par un mot de passe. Verrouillée, elle n'affiche plus rien et ne peut plus servir tant qu'elle n'est pas déverrouillée.");
  bullet("Le bouton d'import-export enregistre la bibliothèque dans un fichier chiffré, ou la recharge sur un autre appareil. Le mot de passe est obligatoire, huit caractères au minimum, et une jauge vous indique la robustesse de ce que vous tapez.");
  bullet("Le balai efface tout, avec une confirmation renforcée quand le coffre est verrouillé.");
  y -= 4;
  h2('Le détourage, en pratique');
  para("Photographiez ou scannez votre signature sur une feuille blanche. Importez l'image, puis "
     + "ouvrez le détourage : tout ce qui est plus clair que le seuil devient transparent. Réglez "
     + "le curseur jusqu'à ce que le papier disparaisse en laissant le trait intact, et forcez au "
     + "besoin l'encre en noir.", {size:10});

  /* ------------------------------------------- 6. propriétés et réglages */
  newPage(); foot(6);
  h1('Propriétés et réglages');
  para("Le panneau de droite décrit l'élément sélectionné : dimensions, couleur, opacité, rotation, "
     + "page. Il porte aussi la liste de tous les éléments posés, avec une pastille indiquant leur "
     + "nature — T pour un texte, un trait jaune pour un surlignage, un crayon pour un commentaire, "
     + "la vignette pour une image — et une corbeille par ligne.");
  const r6a = shot('props', M, y, 170);
  const r6b = shot('settings', M + 170 + 22, y, 170);
  page.drawText("Les propriétés de l'élément choisi", {x:M, y:y - r6a.h - 12, size:8.5, font:ital, color:C.soft});
  page.drawText("Les réglages de l'application", {x:M + 170 + 22, y:y - r6b.h - 12, size:8.5, font:ital, color:C.soft});
  y -= Math.max(r6a.h, r6b.h) + 28;
  h2('Les réglages');
  legend([
    [1, 'Langue et thème', "Sept langues, et un thème clair, sombre ou accordé au système."],
    [2, 'Note en marge', "Ajoute ou non l'icône de note à côté de la pastille, dans le PDF exporté."],
    [3, 'Commentaires en tête', "Place l'annexe au début du document plutôt qu'à la fin."],
    [4, 'Reproduire la source', "Valeur par défaut de la case de chaque commentaire, et hauteur maximale de l'extrait."],
    [5, 'Suffixe', "Ce qui est ajouté au nom du fichier proposé à l'enregistrement."],
    [6, 'Guide, partage, licence', "Ce document, l'envoi de l'adresse de l'application, et les mentions légales."],
    [7, 'Plein écran, mise à jour', "Masque le cadre du navigateur là où c'est permis, et force la recherche d'une nouvelle version."]
  ], true);
  y -= 2;
  h2("Enregistrer");
  para("Le bouton Enregistrer propose d'abord un nom de fichier, construit à partir du document "
     + "d'origine et du suffixe. Sur mobile, la feuille de partage du système prend le relais : "
     + "vous pouvez enregistrer dans Fichiers, envoyer par message ou par courriel.");

  /* ------------------------------------------------------- 7. astuces */
  newPage(); foot(7);
  h1('Astuces');
  h2('Les doubles clics');
  bullet("Sur la poignée ronde d'un élément : l'angle se cale sur le multiple de 90° le plus proche. Pratique pour redresser une signature posée de travers.");
  bullet("Sur un commentaire : rouvre sa saisie.");
  bullet("Sur le chevron gauche ou droit : va directement à la première ou à la dernière page.");
  h2('Pendant la saisie d\'un commentaire');
  para("Le panneau ne bloque rien. Vous pouvez faire défiler le document, l'agrandir au pincement, "
     + "déplacer ou redimensionner le cadre en cours — tout cela sans perdre une ligne de ce que "
     + "vous êtes en train d'écrire. Seul le changement de page est suspendu, pour que le cadre ne "
     + "vous échappe pas.");
  h2('Assembler plusieurs fichiers');
  para("Le sélecteur accepte plusieurs fichiers d'un coup. Choisissez plusieurs PDF : ils sont "
     + "concaténés dans l'ordre. Choisissez des photos : chacune devient une page A4, à l'échelle, "
     + "sans rotation ni recadrage. Mélangez les deux : l'ordre de sélection est respecté. C'est la "
     + "façon la plus rapide de transformer trois photos d'un document papier en un PDF présentable.");
  h2('Surligner juste ce qu\'il faut');
  para("Un simple trait sur une ligne suffit : le surlignage épouse la hauteur réelle de la ligne "
     + "et s'arrête où votre geste s'arrête. Inutile d'être précis en hauteur, seule compte "
     + "l'étendue horizontale. Sur un document scanné, sans couche de texte, le rectangle tracé est "
     + "conservé tel quel.");
  h2('Reprendre un document déjà commenté');
  para("Rouvrez un PDF que vous aviez annoté : la numérotation reprend au numéro suivant, et les "
     + "nouvelles notes s'ajoutent à la suite de l'annexe existante plutôt que d'en créer une "
     + "seconde.");
  h2('Et aussi');
  bullet("Les flèches du clavier déplacent l'élément sélectionné au point près, dix points avec Majuscule, et parcourent les pages quand rien n'est sélectionné.");
  bullet("Ctrl+Z et Ctrl+Y sur quatre-vingts niveaux.");
  bullet("Quitter l'application pour une autre et y revenir ne perd rien : le document et vos ajouts sont restaurés.");

  /* ------------------------------------------------------- 8. licence */
  newPage(); foot(8);
  h1('Licence et composants');
  h2('Licence MIT');
  para("Copyright (c) 2026 DW", {size:10});
  para("Permission is hereby granted, free of charge, to any person obtaining a copy of this "
     + "software and associated documentation files (the \u201cSoftware\u201d), to deal in the Software "
     + "without restriction, including without limitation the rights to use, copy, modify, merge, "
     + "publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons "
     + "to whom the Software is furnished to do so, subject to the following conditions:", {size:9, color:C.soft});
  para("The above copyright notice and this permission notice shall be included in all copies or "
     + "substantial portions of the Software.", {size:9, color:C.soft});
  para("THE SOFTWARE IS PROVIDED \u201cAS IS\u201d, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, "
     + "INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR "
     + "PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE "
     + "FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR "
     + "OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER "
     + "DEALINGS IN THE SOFTWARE.", {size:9, color:C.soft});
  y -= 4;
  h2('Composants embarqués');
  const comps = [
    ['pdf.js 3.11.174', 'Apache License 2.0', 'Mozilla Foundation', "Lecture et rendu des PDF."],
    ['pdf-lib 1.17.1', 'MIT', 'Andrew Dillon', "Génération et modification des PDF."],
    ['@pdf-lib/fontkit 1.1.1', 'MIT', 'Andrew Dillon', "Intégration des polices TrueType."],
    ['Montserrat', 'SIL Open Font License 1.1', 'Julieta Ulanovsky et contributeurs', "Police par défaut."],
    ['Roboto', 'SIL Open Font License 1.1', 'Christian Robertson et contributeurs', "Police alternative."]
  ];
  for(const [name, lic, who, what] of comps){
    page.drawText(name, {x:M, y, size:10.5, font:bold, color:C.text});
    page.drawText(lic, {x:M + 200, y, size:9.5, font:reg, color:C.ink});
    y -= 13;
    page.drawText(who + ' — ' + what, {x:M, y, size:9, font:reg, color:C.soft});
    y -= 18;
  }
  y -= 6;
  para("Les polices sont livrées sous forme d'instances statiques réduites au latin, au latin "
     + "étendu et au cyrillique. Aucun composant n'est chargé depuis un service distant : tout est "
     + "embarqué, ce qui garantit le fonctionnement hors ligne et l'absence de toute requête vers "
     + "l'extérieur.", {size:9.5, color:C.soft});
  y -= 10;
  page.drawLine({start:{x:M,y:y+10}, end:{x:W-M,y:y+10}, thickness:.6, color:C.line});
  page.drawText('Copyright DW-2026', {x:M, y:y - 4, size:10, font:bold, color:C.text});
  page.drawText('https://angstik.github.io/pdf_editor/', {x:M, y:y - 20, size:9.5, font:reg, color:C.ink});

  const out = await doc.save();
  const dir = path.join(ROOT, 'assets/help');
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir, 'guide-fr.pdf'), out);
  console.log('guide-fr.pdf', out.length, 'octets,', doc.getPageCount(), 'pages');
})().catch(e => { console.error('ERREUR', e.stack); process.exit(1); });
