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
- **Effacement total de la bibliothèque**, avec une confirmation adaptée à l'état du coffre :
  simple quand le contenu est visible, saisie explicite de `EFFACER` quand il est verrouillé
  (puisqu'on supprime alors des données qu'on ne peut pas vérifier).
- **Chiffrement optionnel au repos** : AES-GCM 256, clé dérivée par PBKDF2-SHA256
  (250 000 itérations, sel aléatoire de 16 octets). Le mot de passe n'est jamais persisté ;
  la clé ne vit qu'en mémoire pendant la session.

**Édition**
- Rendu fidèle par pdf.js, navigation par page, zoom (boutons, Ctrl + molette, pincement).
- **Ajustement plein écran** : à l'ouverture, au changement de page et à la rotation de l'appareil,
  l'échelle est calculée sur la largeur *et* la hauteur pour que la page tienne entièrement,
  sans aucun défilement. Le calcul automatique se désactive dès que l'on zoome à la main.
- Pose d'une image ou d'un texte, déplacement, redimensionnement, rotation libre,
  réglage de l'opacité, changement de page.
- Texte : **Montserrat** (par défaut) et **Roboto**, deux familles libres embarquées, plus
  Helvetica / Times / Courier. Gras, italique, corps, couleur, multi-lignes, bouton « Date ».
  Les deux familles libres couvrent le latin étendu **et le cyrillique** : contrairement aux
  polices standard du PDF, limitées à WinAnsi, elles permettent de saisir de l'ukrainien.
- **Surligneur** : on trace une bande sur la page, et chaque ligne de texte traversée reçoit
  un surlignage calé sur sa hauteur réelle, déduite de la couche de texte du PDF. Sur un
  document scanné, sans couche de texte, le rectangle tracé est conservé tel quel. Rendu en
  mode de fusion *multiply*, à l'écran comme dans le PDF exporté.
- **Commentaires** : on trace un cadre libre autour du passage concerné, on saisit le texte,
  et l'élément reste redimensionnable indépendamment de ce qu'il entoure — poignées d'angle et
  de côté, ou saisie directe de la largeur et de la hauteur. Numérotation automatique dans
  l'ordre de lecture (page, puis de haut en bas).
- **Couleurs récentes** proposées en tête de la rangée de pastilles, mémorisées par usage
  (texte, surlignage et commentaire ont leurs propres historiques).
- Double-clic sur la poignée ronde : l'angle est ramené au multiple de 90° le plus proche.
- Fermeture du document sans enregistrer, avec confirmation et raccourci vers l'export.
- **Valider la position** verrouille l'élément ; on peut alors en poser un autre, puis
  déverrouiller à tout moment.
- **Annulation et rétablissement** sur 80 niveaux (boutons ↶ ↷, Ctrl+Z, Ctrl+Maj+Z, Ctrl+Y).
  L'état sauvegardé comprend la sélection courante, de sorte qu'un retour en arrière
  ramène aussi sur la bonne page.
- Corbeille directement sur l'élément sélectionné et sur chaque ligne de la liste récapitulative,
  en plus de la touche Suppr et du bouton de l'inspecteur.
- Déplacement au clavier (flèches, Maj = 10 pt).

**Export**
- Génération par pdf-lib à partir du PDF d'origine (structure, signets et champs conservés).
- Enregistrement via `showSaveFilePicker` quand il est disponible, partage natif sur mobile,
  téléchargement classique en repli.

**Interface**
- **Sept langues** : français, anglais, allemand, espagnol, italien, ukrainien, tchèque.
  Détection depuis `navigator.languages` au premier lancement, choix manuel dans le panneau
  *Propriétés* (avec drapeau dessiné en SVG, les emoji drapeaux n'étant pas rendus sous Windows),
  bascule à chaud sans rechargement.
- **Écran d'accueil** au premier lancement : quatre étapes d'usage et la marche à suivre pour
  installer l'application sur Android, iOS et ordinateur. Réaffichable par le bouton ?,
  masquable définitivement.
- Thème **sombre / clair / système**, choix de la langue avec drapeau, et accès à l'aide :
  tous regroupés dans le panneau *Propriétés* pour dégager la barre supérieure.
- Disposition adaptative : sur mobile, la bibliothèque et l'inspecteur deviennent des tiroirs,
  la barre d'outils se replie sur des icônes et ne défile jamais horizontalement.
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
(GitHub Pages, Netlify, Cloudflare, nginx…).

> **HTTPS obligatoire en production.** Les service workers et l'installation PWA ne sont
> autorisés que sur `https://` ou `http://localhost`.

### Installation sur l'appareil
- **Android / Chrome** : menu ⋮ → « Installer l'application », ou le bouton « Installer » de la barre.
- **iOS / Safari** : Partager → « Sur l'écran d'accueil ».
- **Desktop Chrome / Edge** : icône d'installation dans la barre d'adresse.

---

## Déploiement sur GitHub Pages

Le dépôt est publiable tel quel : aucune étape de build, tous les chemins sont relatifs,
l'application fonctionne donc aussi bien à la racine d'un domaine que dans un sous-chemin
du type `https://<compte>.github.io/pdf_editor/`.

**Option A — sans workflow.** Settings → Pages → Build and deployment → Source =
*Deploy from a branch*, branche `main`, dossier `/ (root)`. Supprimez alors
`.github/workflows/deploy.yml`. Le fichier `.nojekyll` reste indispensable : sans lui,
GitHub Pages fait passer le site par Jekyll.

**Option B — avec workflow (fourni).** Settings → Pages → Source = *GitHub Actions*.
Le workflow publie le dépôt à chaque push sur `main` ; Jekyll n'intervient pas du tout.

Dans les deux cas, cochez **Enforce HTTPS** : le service worker, l'installation de la PWA
et l'API Web Crypto exigent un contexte sécurisé.

### Ce que GitHub Pages ne sait pas faire

- **Pas d'en-têtes HTTP personnalisés.** Il n'existe pas d'équivalent de `_headers`.
  La politique de sécurité de contenu est donc déclarée en `<meta http-equiv>` dans
  `index.html`. Conséquence à connaître : la directive `frame-ancestors` est ignorée
  lorsqu'elle est fournie par balise `meta`, l'application n'est donc pas protégée contre
  l'inclusion dans une iframe tierce. Le reste de la CSP (`default-src 'none'`,
  `script-src 'self'` sans `unsafe-inline` ni `unsafe-eval`) s'applique normalement.
- **Pas de contrôle du cache.** GitHub Pages impose ses propres en-têtes ; une nouvelle
  livraison peut mettre quelques minutes à être vue par un navigateur qui a déjà chargé
  le site. Le service worker prend le relais ensuite, à condition d'incrémenter
  `CACHE_VERSION` dans `sw.js` à chaque livraison.
- **Pas de contrôle d'accès.** Un site GitHub Pages est public, y compris depuis un dépôt
  privé sur la plupart des formules. Il n'y a pas d'équivalent de Cloudflare Access.
  Ce n'est pas un problème de confidentialité des documents — les PDF et la bibliothèque
  ne quittent jamais l'appareil — mais l'outil lui-même est accessible à quiconque
  connaît l'URL.

---

## Structure

```
pdf_editor/
├── index.html                  # coquille de l'application
├── manifest.webmanifest        # métadonnées PWA, icônes, file_handlers
├── sw.js                       # service worker (precache, cache-first)
├── .nojekyll                   # désactive le traitement Jekyll
├── .github/workflows/deploy.yml
├── README.md
├── .gitignore
├── assets/
│   ├── css/app.css             # thèmes clair/sombre + responsive
│   ├── js/app.js               # toute la logique applicative
│   ├── js/i18n.js              # 7 langues, détection et bascule à chaud
│   ├── js/theme-boot.js        # thème appliqué avant le premier rendu
│   └── icons/                  # icônes 192/512, maskable, apple-touch, favicon
└── vendor/
    ├── pdf.min.js              # pdf.js 3.11.174 (build legacy)
    ├── pdf.worker.min.js
    ├── pdf-lib.min.js          # pdf-lib 1.17.1
    ├── fontkit.umd.min.js      # @pdf-lib/fontkit 1.1.1
    └── fonts/                  # Montserrat et Roboto, 4 styles chacune
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

**Commentaires à l'export.** Trois constats tirés d'essais sur iOS gouvernent la génération.
D'abord, l'apparence (`/AP`) d'une annotation `/Link` n'est pas dessinée par tous les lecteurs :
PDFKit, en particulier, considère un lien comme invisible par nature. Tout ce qui doit être vu —
le cadre et la pastille numérotée — est donc écrit dans le flux de contenu de la page, ce qui le
rend visible partout et à l'impression, sans réécrire un seul opérateur d'origine. Ensuite, une
annotation de balisage placée sous un lien capte le toucher et empêche de l'atteindre : la
pastille cliquable est donc posée dans la marge, hors du rectangle du cadre, sans recouvrement.
Enfin, `/Highlight` est le type de balisage qui ouvre le plus fidèlement sa bulle : c'est lui qui
porte le texte du commentaire, en teinte à 15 %. Chaque commentaire produit ainsi un cadre et un
numéro dessinés, un `/Highlight` translucide pour la bulle, un `/Link` sur la pastille vers la
page d'annexe, et un `/Link` de retour depuis l'annexe vers le passage exact. Le rendu du
surlignage reste à la main du lecteur : certains, dont poppler, redessinent les extrémités
arrondies à partir des `/QuadPoints` plutôt que d'utiliser l'apparence fournie.

**Polices.** Montserrat et Roboto sont livrées sous forme d'instances statiques (poids 400 et 700,
romain et italique) extraites des polices variables du dépôt `google/fonts` avec
`fonttools varLib.instancer`, puis réduites avec `pyftsubset` au latin, au latin étendu et au
cyrillique : 8 fichiers pour 432 Ko au total. Les mêmes fichiers servent à l'affichage
(`@font-face`) et à l'intégration dans le PDF via `@pdf-lib/fontkit`, avec sous-ensemble
automatique à l'export — un PDF signé ne contient que les glyphes réellement employés.

**Texte.** Les polices standard PDF (Helvetica, Times, Courier et leurs variantes) restent
disponibles et ne coûtent aucun octet, mais elles sont en encodage WinAnsi :
les accents français passent, les alphabets non latins non. La ligne de
base est *mesurée* dans le DOM (élément `inline-block` de hauteur nulle aligné sur la ligne de
base) plutôt qu'approximée, pour que l'aperçu et le rendu PDF coïncident au pixel près.

**Mémoire.** Le PDF d'origine est conservé en `Uint8Array` et cloné avant chaque usage :
pdf.js détache le `ArrayBuffer` qu'on lui transmet, il ne peut donc pas être partagé avec pdf-lib.

**Mise à jour du service worker.** Incrémenter `CACHE_VERSION` dans `sw.js` à chaque
livraison, sinon les anciens fichiers restent servis depuis le cache.

**Traductions.** `assets/js/i18n.js` contient un dictionnaire plat par langue. Les chaînes
comptables sont formulées « Libellé : {n} » plutôt qu'avec un pluriel accordé : cela évite
d'embarquer les règles de pluriel du tchèque et de l'ukrainien (1 / 2-4 / 5 et plus).
Le balisage statique est traduit par les attributs `data-i18n`, `data-i18n-title` et
`data-i18n-ph` ; le contenu dynamique passe par `t(clé, variables)`. Ajouter une langue
revient à copier un bloc et à l'inscrire dans `LANGS`.

**Authentification.** L'application ne gère aucun compte et GitHub Pages n'offre aucun
contrôle d'accès : l'URL est publique. Les documents et la bibliothèque, eux, ne sont jamais
transmis — ils restent dans le navigateur, chiffrés au repos si la protection est activée.
Pour restreindre l'accès à l'outil lui-même, il faut un hébergement offrant une couche
d'authentification en amont.

**Effacement de la bibliothèque.** Quand le coffre est verrouillé, l'effacement retire aussi
la protection par mot de passe : conserver un mot de passe sur un coffre vide empêcherait
d'y remettre quoi que ce soit, le chiffrement d'un nouvel élément exigeant la clé de session.

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
- [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) — MIT.
- [Montserrat](https://github.com/google/fonts/tree/main/ofl/montserrat) — SIL Open Font License 1.1, Julieta Ulanovsky et contributeurs.
- [Roboto](https://github.com/google/fonts/tree/main/ofl/roboto) — SIL Open Font License 1.1, Christian Robertson et contributeurs.

Les deux librairies sont figées dans `vendor/` pour garantir le fonctionnement hors ligne
et la reproductibilité des builds.
