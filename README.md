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
- **Enregistrement et chargement de la bibliothèque** dans un fichier `.pdfedlib` autonome,
  chiffré par un mot de passe obligatoire d'au moins huit caractères. Le champ de saisie propose
  une bascule d'affichage et une jauge de robustesse qui se met à jour à la frappe. Le fichier ne
  dépend ni du coffre local ni de l'appareil : il transporte la bibliothèque d'un poste à l'autre.
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
- Thème **sombre / clair / système**, choix de la langue et accès à l'aide : accessibles depuis
  la première ligne du panneau *Propriétés*, par deux fenêtres distinctes, de sorte que le corps
  du panneau reste entièrement dédié à l'élément sélectionné.
- **Reprise d'un document déjà commenté** : les annotations présentes sont relues à l'ouverture
  et la numérotation repart au numéro suivant plutôt que de recommencer à 1. L'annexe produite
  lors d'un passage antérieur est repérée par deux clés privées, `PDFEdAnnex` qui l'identifie et
  `PDFEdY` qui mémorise où s'est arrêtée la mise en page : les nouvelles notes s'ajoutent à la
  suite sur cette même page, et une page n'est ouverte que si la place vient à manquer.
- **Nom du fichier proposé** avant l'enregistrement, avec un suffixe paramétrable dans les
  réglages.
- **Navigation par balayage et par molette** : quand la page tient à l'écran, un simple geste
  change de page ; sinon il faut avoir atteint le bord et pousser encore. Le geste est suivi
  jusqu'au relâchement du doigt, de sorte que l'inertie du défilement ne fait jamais tourner la
  page. Au clavier, les flèches parcourent le document tant qu'aucun élément n'est sélectionné.
- **Barre d'outils en haut, à gauche ou à droite**, au choix. La colonne latérale ne s'active
  qu'en paysage : en portrait elle prendrait une largeur déjà rare, et la préférence est
  simplement mise en sommeil jusqu'à la rotation suivante.
- **Assemblage de la sélection** : plusieurs PDF sont concaténés dans l'ordre choisi, les images
  deviennent des pages A4, et une sélection mixte se comporte comme on l'attend. Un PDF seul est
  chargé tel quel, sans recopie page à page qui lui ferait perdre ce que nous ne savons pas
  transporter.
- **Double-clic sur les chevrons** : première ou dernière page.
- **Récapitulatif dans le presse-papiers** à l'enregistrement, en option : texte et HTML, avec
  les vignettes intégrées en `data:` URI.
- **Annexe des commentaires en tête ou en fin de document**, au choix.
- **Copie du passage dans l'annexe** : chaque note peut reprendre en image la zone encadrée, à
  sa taille d'origine, redressée si le cadre est pivoté, tronquée par le bas au-delà d'une
  hauteur réglable. Un écran d'aide montre le rendu avec et sans copie.
- **Brouillon de commentaire** conservé si la fenêtre de saisie est fermée par un clic à côté,
  et restitué à la saisie suivante. Valider et Annuler l'effacent tous deux.
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
Enfin, aucun balisage n'est posé par-dessus le texte : un `/Highlight` y déclenche la sélection
de texte plutôt que sa bulle sur certains lecteurs, et son opacité comme ses contours sont
réinterprétés à chaque fois. Chaque commentaire produit donc un cadre, une teinte à 6 % et un
numéro **dessinés dans le contenu**, un `/Link` couvrant la zone et un second sur la pastille,
tous deux vers la note en annexe, un `/Link` de retour depuis l'annexe, et une note `/Text`
isolée dans la marge qui porte le texte pour les lecteurs sachant ouvrir une bulle.

**Partage sur iOS.** `navigator.share({files, title})` produit deux éléments sur iOS : le fichier
et un second document texte reprenant le titre. Seul `files` est transmis.

**Zone d'accueil.** `.drophint` porte `display:flex`, qui l'emporte sur la règle `[hidden]` du
navigateur : la zone restait cliquable par-dessus le document chargé et rouvrait le sélecteur de
fichiers. Une règle `.drophint[hidden]{display:none}` explicite rétablit le comportement attendu.

**Centrage et débordement.** La page est centrée par des marges automatiques sur l'élément,
et non par `justify-content` / `align-items` sur le conteneur : un enfant centré par un
conteneur flexible voit son débordement haut et gauche devenir inatteignable au défilement dès
qu'il dépasse la zone visible, ce qui rendait le haut du document inaccessible une fois agrandi.

**Numérotation des commentaires.** Le dernier numéro utilisé est inscrit dans les mots-clés du
document (`pdfed-cmt-max:N`), lu à l'ouverture suivante. Le balayage des annotations reste en
secours pour un fichier annoté par un autre outil ; il lit `contentsObj.str`, la propriété
qu'expose pdf.js 3.x — `contents` a disparu de son interface et le balayage ne trouvait rien.

**Images vers PDF.** Le sélecteur accepte indifféremment un PDF ou des images, ce qui déclenche
sur mobile le menu natif habituel : photothèque, appareil photo, fichiers. Des images choisies
sont assemblées en un document A4, une par page, à l'échelle `min(largeur/l, hauteur/h)` : l'image
sature l'axe qui contraint le premier, sans rotation, sans recadrage et sans déformation.

**Îlot et barre d'état sur iOS.** Deux métadonnées décident si l'application installée dessine
sous l'îlot ou sous lui. `viewport-fit=cover` étend la zone de rendu à tout l'écran, encoches
comprises, et `apple-mobile-web-app-status-bar-style: black-translucent` rend la barre d'état
transparente par-dessus le contenu. Les deux ont été retirées : sans `viewport-fit=cover`, iOS
insère lui-même la marge et la mise en page commence sous l'îlot ; avec le style `default`, la
barre d'état reste opaque et prend la teinte de `theme-color`, que l'application met à jour à
chaque changement de thème. Les valeurs `env(safe-area-inset-*)` retombent alors à zéro et ne
subsistent dans la feuille de style, assorties d'un repli explicite, que pour les plateformes
qui dessinent réellement sous les encoches.

**Cadre du navigateur.** Sur iPhone, l'API plein écran ne s'applique qu'aux vidéos : seul un
ajout à l'écran d'accueil supprime les barres du navigateur, y compris en paysage. Le bouton
Plein écran des réglages fonctionne partout ailleurs et le signale poliment quand il ne peut rien.

**Tracé et défilement.** `touch-action: pan-x pan-y` sur la visionneuse, nécessaire au
pincement, a pour effet que le navigateur fait défiler la page pendant un glissement à un doigt
dès que le document dépasse l'écran. Le rectangle de référence capturé au début du tracé devient
alors obsolète et le cadre obtenu n'a plus aucun rapport avec le geste. La couche d'éléments
passe donc en `touch-action: none` dès qu'un outil est armé, le pointeur est capturé, et les
coordonnées sont relues à chaque déplacement plutôt que figées au départ.

**Zoom.** Le pincement ne doit modifier que l'échelle du rendu, pas celle de l'interface.
Cela demande trois choses simultanées : `user-scalable=no` dans la balise viewport,
`touch-action: pan-x pan-y` sur la zone de visualisation, et la neutralisation des événements
`gesturestart` / `gesturechange` propres à Safari, qui appliquent sinon leur propre zoom de page.

**Mode paysage.** La hauteur est exprimée en `dvh` lorsque le navigateur le gère : sans cela,
`100%` se réfère à la hauteur avec barres d'outils rétractées et le bas de l'application passe
sous les menus du navigateur dès que celles-ci réapparaissent.

**Gestionnaires en ligne.** La politique de sécurité interdit `script-src 'unsafe-inline'` :
tout attribut `onclick` du balisage est donc silencieusement ignoré. Les boutons de fermeture
des fenêtres portent un attribut `data-close` et sont câblés par délégation depuis JavaScript.

**Format du fichier de bibliothèque.** Une enveloppe JSON portant un identifiant `PDFED-LIB-1`,
les paramètres de dérivation, le sel, le vecteur d'initialisation et les données chiffrées en
base64. Le contenu clair est lui-même un JSON contenant les images en base64 avec leur nom et
leurs dimensions. Le déchiffrement échoue de lui-même sur un mauvais mot de passe — l'étiquette
d'authentification d'AES-GCM y pourvoit — et l'identifiant est vérifié avant et après
déchiffrement, ce qui distingue un fichier étranger d'un mot de passe erroné.

**Robustesse du mot de passe.** L'estimation combine longueur et variété des classes de
caractères, plafonne les chaînes d'une seule classe, annule les répétitions pures et rabat les
débuts de suites connues. Elle est indicative et volontairement lisible : ce n'est pas un
estimateur d'entropie.

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
