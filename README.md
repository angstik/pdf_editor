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

Les deux librairies sont figées dans `vendor/` pour garantir le fonctionnement hors ligne
et la reproductibilité des builds.
