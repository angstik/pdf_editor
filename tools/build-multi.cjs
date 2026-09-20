/* =====================================================================
   Construit /multi/ à partir de l'application courante.

   La variante collaborative vit dans son propre répertoire pour ne rien
   casser de ce qui est en service. Elle possède ses propres copies du
   code — ce sont elles qui vont diverger — mais partage les fichiers
   lourds qui, eux, ne changeront pas : les bibliothèques vendorisées,
   les polices, les icônes et le guide.

   Relancer ce script réaligne /multi/ sur la racine : à n'utiliser que
   tant que la variante n'a pas commencé à diverger.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'multi');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => {
  const f = path.join(OUT, p);
  fs.mkdirSync(path.dirname(f), {recursive:true});
  fs.writeFileSync(f, s);
  return s.length;
};

/* --- index.html : les chemins partagés remontent d'un cran ------------ */
let html = read('index.html');
html = html
  .replace(/(src|href)="vendor\//g, '$1="../vendor/')
  .replace(/(src|href)="assets\/icons\//g, '$1="../assets/icons/')
  .replace(/href="assets\/css\/app\.css"/, 'href="app.css"')
  .replace(/src="assets\/js\/theme-boot\.js"/, 'src="theme-boot.js"')
  .replace(/src="assets\/js\/i18n\.js"/, 'src="i18n.js"')
  .replace(/src="assets\/js\/app\.js"/, 'src="app.js"')
  .replace(/href="manifest\.webmanifest"/, 'href="manifest.webmanifest"')
  .replace('<title>EDITION PDF</title>', '<title>EDITION PDF — multi</title>');
write('index.html', html);

/* --- feuille de style : les polices sont partagées -------------------- */
let css = read('assets/css/app.css').replace(/\.\.\/\.\.\/vendor\//g, '../vendor/');
write('app.css', css);

/* --- scripts ---------------------------------------------------------- */
write('theme-boot.js', read('assets/js/theme-boot.js'));
write('i18n.js', read('assets/js/i18n.js'));

let app = read('assets/js/app.js');
app = app
  .replace(/'vendor\/fonts\/'/g, "'../vendor/fonts/'")
  .replace(/'vendor\/pdf\.worker\.min\.js'/g, "'../vendor/pdf.worker.min.js'")
  .replace(/'assets\/help\/guide-fr\.pdf'/g, "'../assets/help/guide-fr.pdf'")
  /* la reprise de session ne doit pas être partagée avec l'application
     d'origine : les deux tourneraient sur la même clé de la même base */
  .replace("const S_KEY = 'session'", "const S_KEY = 'session-multi'")
  .replace("S_TOKEN = 'pdfed.token'", "S_TOKEN = 'pdfed.token.multi'")
  .replace("const APP_URL = 'https://angstik.github.io/pdf_editor/';",
           "const APP_URL = 'https://angstik.github.io/pdf_editor/multi/';")
  .replace(/const APP_VERSION = '([^']+)';/,
           (m, v) => `const APP_VERSION = '${v}-multi';`);
write('app.js', app);

/* --- manifeste : installable séparément ------------------------------- */
const man = JSON.parse(read('manifest.webmanifest'));
man.name = (man.name || 'EDITION PDF') + ' — multi';
man.short_name = 'PDF multi';
man.start_url = './';
man.scope = './';
if(Array.isArray(man.icons)) man.icons = man.icons.map(i => ({...i, src: i.src.replace(/^assets\//, '../assets/')}));
write('manifest.webmanifest', JSON.stringify(man, null, 2));

/* --- service worker : portée et cache distincts ----------------------- */
let sw = read('sw.js');
sw = sw
  .replace(/const CACHE = [^;]+;/, "const CACHE = 'pdfed-multi-' + CACHE_VERSION;")
  .replace(/const CACHE_VERSION = '([^']+)';/, (m, v) => `const CACHE_VERSION = '${v}-multi';`)
  .replace(/'assets\/css\/app\.css'/, "'app.css'")
  .replace(/'assets\/js\/app\.js'/, "'app.js'")
  .replace(/'assets\/js\/i18n\.js'/, "'i18n.js'")
  .replace(/'assets\/js\/theme-boot\.js'/, "'theme-boot.js'")
  .replace(/'vendor\//g, "'../vendor/")
  .replace(/'assets\/icons\//g, "'../assets/icons/")
  .replace(/'assets\/help\//g, "'../assets/help/");
write('sw.js', sw);

/* versions accordées : une divergence entre le numéro affiché et celui du
   cache donne une application qui ne se met jamais à jour tout en affichant
   l'ancien numéro — exactement le symptôme le plus déroutant qui soit. */
const vApp = /const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(OUT,'app.js'),'utf8'));
const vSw  = /const CACHE_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(OUT,'sw.js'),'utf8'));
if(!vApp || !vSw || vApp[1] !== vSw[1]){
  console.error('INCOHÉRENCE de version : app.js =', vApp && vApp[1], '| sw.js =', vSw && vSw[1]);
  process.exit(1);
}
console.log('multi/ construit :', fs.readdirSync(OUT).join(', '), '— version', vApp[1]);
