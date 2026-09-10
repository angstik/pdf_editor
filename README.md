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

## Structure

```
pdf_editor/
├── index.html                  # coquille de l'application
├── manifest.webmanifest        # métadonnées PWA, icônes, file_handlers
├── sw.js                       # service worker (precache, cache-first)
├── README.md
├── .gitignore
├── assets/
│   ├── css/app.css             # thèmes clair/sombre + responsive
│   ├── js/app.js               # toute la logique applicative
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
