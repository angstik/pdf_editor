# EDITION PDF

Application web (PWA) pour poser des **signatures, images et textes** sur un PDF, puis
générer et enregistrer le document résultant. Tout se passe dans le navigateur : aucun
fichier n'est envoyé sur un serveur, aucune dépendance réseau après la première visite.

Installable sur ordinateur et sur mobile (Android / iOS), utilisable hors ligne.

---

## Fonctionnalités

**Bibliothèque de signatures**
- Import depuis le disque ou l'appareil (PNG, JPEG, WebP, GIF, BMP), normalisation automatique
  en PNG ou JPEG et bridage à 2200 px sur le plus grand côté.
- Tracé au doigt, au stylet ou à la souris, avec recadrage automatique sur le tracé.
- Détourage du fond pour les signatures scannées (seuil de clarté, alpha progressif,
  option « encre en noir »).
- Renommer, dupliquer via le document, télécharger, supprimer.
- **Chiffrement optionnel au repos** : AES-GCM 256, clé dérivée par PBKDF2-SHA256
  (250 000 itérations, sel aléatoire de 16 octets). Le mot de passe n'est jamais persisté ;
  la clé ne vit qu'en mémoire pendant la session.

**Édition**
- Rendu fidèle par pdf.js, navigation par page, zoom (boutons, Ctrl + molette, pincement).
- Pose d'une image ou d'un texte, déplacement, redimensionnement, rotation libre,
  réglage de l'opacité, changement de page.
- Texte : Helvetica / Times / Courier, gras, italique, corps, couleur, multi-lignes,
  bouton « Date » pour insérer la date du jour.
- **Valider la position** verrouille l'élément ; on peut alors en poser un autre, puis
  déverrouiller à tout moment.
- Annulation (Ctrl+Z, 60 niveaux), déplacement au clavier (flèches, Maj = 10 pt),
  suppression (Suppr), liste récapitulative de tous les éléments du document.

**Export**
- Génération par pdf-lib à partir du PDF d'origine (structure, signets et champs conservés).
- Enregistrement via `showSaveFilePicker` quand il est disponible, partage natif sur mobile,
  téléchargement classique en repli.

**Interface**
- Thème **sombre / clair / système**, mémorisé sur l'appareil (bouton ◐ de la barre supérieure).
- Disposition adaptative : sur mobile, la bibliothèque et l'inspecteur deviennent des tiroirs.
- PWA : installable, hors ligne, gestionnaire de fichiers `.pdf` sur les navigateurs
  qui le supportent (Chrome / Edge desktop).

---

## Mise en route

L'application doit être servie en **HTTP(S)**. Un simple `file://` fonctionne partiellement
mais désactive le service worker (donc l'installation et le mode hors ligne) et peut bloquer
le worker de pdf.js.

```bash
git clone <url-du-depot> pdf_editor
cd pdf_editor
python3 -m http.server 8080
# puis http://localhost:8080
```

Alternatives : `npx serve .`, `php -S localhost:8080`, ou tout hébergeur statique
(GitHub Pages, Netlify, Cloudflare Pages, nginx…).

> **HTTPS obligatoire en production.** Les service workers et l'installation PWA ne sont
> autorisés que sur `https://` ou `http://localhost`.

### Installation sur l'appareil
- **Android / Chrome** : menu ⋮ → « Installer l'application », ou le bouton « Installer » de la barre.
- **iOS / Safari** : Partager → « Sur l'écran d'accueil ».
- **Desktop Chrome / Edge** : icône d'installation dans la barre d'adresse.

---

## Déploiement sur Cloudflare

Cloudflare recommande depuis 2026 les **Workers avec static assets** plutôt que Pages pour
les nouveaux projets ; c'est ce que configure `wrangler.jsonc`. Aucun code serveur n'est
déployé : le Worker ne sert que des fichiers statiques, et ces requêtes ne sont pas facturées.

```bash
npm install -g wrangler        # ou npx wrangler …
wrangler login
wrangler deploy                # première exécution : crée le Worker "pdf-editor"
```

`.assetsignore` empêche la publication de `README.md`, `wrangler.jsonc`, `.github/` et
consorts. `_headers` est interprété par la plateforme puis exclu des fichiers servis.

**Intégration continue.** Deux options exclusives :
- *Workers Builds* : connectez le dépôt depuis le dashboard Cloudflare (Workers & Pages →
  le Worker → Settings → Build). Rien à ajouter dans le dépôt ; supprimez alors
  `.github/workflows/deploy.yml`.
- *GitHub Actions* : le workflow fourni utilise `cloudflare/wrangler-action@v4`. Créez les
  secrets `CLOUDFLARE_API_TOKEN` (permission « Workers Scripts: Edit ») et
  `CLOUDFLARE_ACCOUNT_ID`.

**Domaine.** Ajoutez un domaine personnalisé (Worker → Settings → Domains & Routes). Le
sous-domaine `*.workers.dev` fonctionne mais n'est pas protégeable par Access : utilisez un
hostname de votre zone.

### Restreindre l'accès (Cloudflare Access)

Zero Trust est gratuit jusqu'à 50 utilisateurs et suffit largement ici.

1. Zero Trust → Settings → Authentication : ajoutez un fournisseur d'identité (Google
   Workspace, Entra ID, GitHub…) ou gardez le **One-time PIN** par e-mail.
2. Access → Applications → *Add an application* → **Self-hosted**, hostname =
   le domaine du Worker.
3. Politique *Allow* : `Emails` avec la liste nominative, ou `Emails ending in @votre-domaine`.
   Ajoutez une politique *Block* explicite en dernier recours si vous exposez plusieurs chemins.
4. Durée de session : **24 h minimum**. Une session courte est pénible sur une application
   installée, chaque expiration renvoyant vers l'écran de connexion.
5. Vérifiez en navigation privée que l'URL redirige bien vers l'écran d'authentification.

### Cohabitation Access ↔ service worker

Quand la session Access expire, l'origine répond par une redirection cross-origin vers
`https://<équipe>.cloudflareaccess.com/…`. Deux conséquences, traitées dans le code :

- **Le cache ne doit pas avaler la page de connexion.** `sw.js` filtre toutes ses écritures
  sur `res.ok && !res.redirected && res.type === 'basic'` : une réponse de connexion n'entre
  jamais en cache, sinon l'application servirait du HTML d'authentification à la place de
  ses propres fichiers, sans moyen de s'en sortir autrement qu'en vidant le stockage.
- **L'expiration doit être visible.** `checkSession()` sonde l'origine avec
  `redirect:'manual'` sur `manifest.webmanifest?ping=1` (le `?ping=1` court-circuite le
  service worker) au démarrage, au retour au premier plan, au retour en ligne et toutes les
  15 minutes. Une redirection opaque déclenche une invite de reconnexion, en avertissant de
  sauvegarder le PDF en cours puisque les éléments posés ne sont pas persistés.

### En-têtes et CSP

`_headers` applique HSTS, `nosniff`, `Referrer-Policy: no-referrer`, une `Permissions-Policy`
restrictive et une CSP `default-src 'none'` avec `frame-ancestors 'none'`.

- `script-src 'self'` sans `'unsafe-inline'` : le script d'amorçage du thème a été sorti dans
  `assets/js/theme-boot.js` exprès pour cela.
- `style-src` conserve `'unsafe-inline'` : l'interface utilise des attributs `style` dans son
  balisage, qui sont bloqués sans cette directive.
- Pas de `'unsafe-eval'` : `getDocument` est appelé avec `isEvalSupported: false`, pdf.js
  bascule alors sur son interpréteur pour les fonctions PostScript.
- `img-src` autorise `blob:` (URLs d'objet des signatures) et `connect-src 'self'` couvre la
  sonde de session.

HSTS peut aussi être activé au niveau de la zone (SSL/TLS → Edge Certificates). Ne l'activez
avec `preload` qu'une fois certain que tous les sous-domaines sont en HTTPS.

Côté zone, complétez avec : mode SSL **Full (strict)**, *Always Use HTTPS*, et une règle WAF
de limitation de débit si le hostname est public avant la mise en place d'Access.

---

## Structure

```
pdf_editor/
├── index.html                  # coquille de l'application
├── manifest.webmanifest        # métadonnées PWA, icônes, file_handlers
├── sw.js                       # service worker (precache, cache-first)
├── _headers                    # en-têtes de sécurité et de cache (Cloudflare)
├── wrangler.jsonc              # Worker "assets only"
├── .assetsignore               # fichiers du dépôt non publiés
├── .github/workflows/deploy.yml
├── README.md
├── .gitignore
├── assets/
│   ├── css/app.css             # thèmes clair/sombre + responsive
│   ├── js/app.js               # toute la logique applicative
│   ├── js/theme-boot.js        # thème appliqué avant le premier rendu
│   └── icons/                  # icônes 192/512, maskable, apple-touch, favicon
└── vendor/
    ├── pdf.min.js              # pdf.js 3.11.174 (build legacy)
    ├── pdf.worker.min.js
    └── pdf-lib.min.js          # pdf-lib 1.17.1
```

Aucune étape de build : les fichiers sont livrés tels quels.

---

## Notes techniques

**Système de coordonnées.** Les éléments sont stockés en unités du *viewport pdf.js à
l'échelle 1*, c'est-à-dire en points PDF. La conversion écran → espace PDF passe par
`viewport.convertToPdfPoint()`, ce qui prend en charge les pages avec `/Rotate` 90, 180 ou 270.
Le point d'ancrage passé à pdf-lib est calculé depuis le centre de l'élément :

```
θ      = rotationPage + rotationÉlément
ancre  = centre + R(θ) · (−w/2, −h/2)
```

Une seule formule couvre donc tous les cas, y compris la rotation libre d'une signature sur
une page elle-même pivotée.

**Texte.** Les polices standard PDF (Helvetica, Times, Courier et leurs variantes) sont utilisées,
en encodage WinAnsi : les accents français passent, les alphabets non latins non. La ligne de
base est *mesurée* dans le DOM (élément `inline-block` de hauteur nulle aligné sur la ligne de
base) plutôt qu'approximée, pour que l'aperçu et le rendu PDF coïncident au pixel près.

**Mémoire.** Le PDF d'origine est conservé en `Uint8Array` et cloné avant chaque usage :
pdf.js détache le `ArrayBuffer` qu'on lui transmet, il ne peut donc pas être partagé avec pdf-lib.

**Mise à jour du service worker.** Incrémenter `CACHE_VERSION` dans `sw.js` à chaque
livraison, sinon les anciens fichiers restent servis depuis le cache.

**Authentification.** L'application ne gère aucun compte : l'accès est filtré en amont par le
proxy (Cloudflare Access). Le contenu de la bibliothèque, lui, reste chiffré côté navigateur
et n'est jamais transmis — un administrateur Cloudflare ne peut pas le lire.

---

## Limites connues

- La signature apposée est **visuelle** : aucune signature cryptographique PAdES/CAdES n'est
  ajoutée, et le document n'est pas horodaté. Pour une valeur probante, passer par un
  prestataire de service de confiance.
- Les éléments posés ne sont pas persistés entre deux sessions ; seule la bibliothèque l'est.
- Les PDF protégés par mot de passe propriétaire sont chargés avec `ignoreEncryption`,
  ce qui peut échouer sur des documents fortement restreints.
- Les très gros PDF (plusieurs centaines de pages ou images lourdes) peuvent être lents
  sur mobile d'entrée de gamme.

---

## Licences

- [pdf.js](https://github.com/mozilla/pdf.js) — Apache-2.0, Mozilla.
- [pdf-lib](https://github.com/Hopding/pdf-lib) — MIT, Andrew Dillon.

Les deux librairies sont figées dans `vendor/` pour garantir le fonctionnement hors ligne
et la reproductibilité des builds.
