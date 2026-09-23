# Journal des livraisons

Chaque entrée porte pour titre la version suivie d'une synthèse courte, et reprend
le texte de livraison correspondant.

---

## v1.3-multi — suppressions datées, annonce fidèle

La fenêtre d'import annonçait un élément « nouveau » que la fusion refusait ensuite en silence :
l'élément avait été supprimé localement, et la pierre tombale bloquait son retour sans que
l'analyse en tienne compte. Deux corrections.

L'analyse compte désormais une catégorie « supprimés ici » et l'affiche : ce qui est annoncé est
ce qui sera fait.

La suppression ne l'emporte plus indéfiniment. Elle ne vaut que contre ce qu'elle a vu : une
version de l'élément postérieure à la suppression le fait revenir, et une suppression reçue ne
s'applique pas à une version locale plus récente. C'est la règle attendue d'un registre
répliqué, et elle évite qu'une suppression prononcée par erreur ne devienne définitive pour
tout le monde.

Troisième point, moins visible mais nécessaire : toute retouche avance maintenant le compteur de
l'élément — validation d'un commentaire, changement dans l'inspecteur, déplacement. Sans cela,
deux appareils modifiant le même élément n'auraient pu être départagés que par l'ordre des
exports.

Le bouton « Mettre à jour » annonce enfin le numéro de version réellement publié, lu hors cache.

---

## v1.3.4-multi / v1.0.4 — pastilles lisibles, couleur fidèle

Le décompte de l'import passe sur deux lignes, chaque chiffre dans sa pastille : nouveaux et mis à
jour d'abord, connus et bloqués ensuite.

La pastille numérotée du commentaire était un disque de vingt pixels, ce qui convenait à un
chiffre mais rognait une étiquette comme « DWE-12 ». Elle devient une gélule de largeur libre,
posée dans la marge à gauche du cadre, et bascule au-dessus lorsque la marge manque.

La couleur revenait sans cesse à une valeur ancienne parce qu'un choix fait dans la palette du
panneau n'était jamais mémorisé : seule la liste des couleurs récentes l'était. Un choix confirmé,
comme la validation d'un commentaire, enregistre désormais la couleur comme défaut du suivant, et
la palette rouvre sur cette couleur sélectionnée.

---

## v1.3.3-multi / v1.0.3 — commentaire perdu à la validation

Signalement précisé : le commentaire n'est pas créé lorsque la reproduction de la source n'est pas
cochée. Le banc d'essai ne reproduit rien, quel que soit l'ordre des gestes — la cause tient donc
au navigateur. Mais l'observation désigne le coupable : le seul chemin qui supprime un commentaire
à la validation est un texte lu vide, et `innerText` dépend du rendu, si bien qu'un champ venant
de perdre le focus peut se lire vide alors que le texte existe.

Le texte de l'élément, tenu à jour à chaque frappe, sert désormais de filet : si la lecture du
champ revient vide, c'est lui qui fait foi. La gomme vide les deux, pour que le filet ne
ressuscite pas un texte volontairement effacé. Et l'abandon d'un commentaire vide affiche
maintenant un message, au lieu de faire disparaître le cadre sans explication.

---

## v1.3.2-multi / v1.0.2 — total affiché, identité au démarrage

Signalement : « commentaire enregistré » s'affiche mais le commentaire ne l'est pas, dans les deux
applications. Je n'ai pas su le reproduire — le banc d'essai montre l'élément présent après
validation, et l'export le restitue. Deux mesures en attendant d'en savoir plus. Le message
annonce désormais le nombre total de commentaires du document, ce qui rend le doute vérifiable
d'un coup d'oeil. Et un vrai défaut trouvé au passage dans la variante multi est corrigé :
l'identité n'était pas chargée au démarrage, si bien qu'après un rechargement les commentaires
restaurés étaient pris pour ceux d'un autre participant, donc affichés en lecture seule.

---

## v1.3.1-multi — imports clarifiés, restauration

La version installée contenait trois défauts qui, combinés, produisent exactement le symptôme
observé. La fenêtre de validation comptait comme « nouveau » tout élément absent localement,
sans regarder les suppressions locales, alors que la fusion, elle, les respectait : un élément
supprimé ici était annoncé comme nouveau, puis silencieusement écarté. Une suppression reçue
effaçait l'élément local même quand celui-ci était plus récent. Et une modification faite par le
panneau de saisie ne relevait pas le compteur logique, si bien que la comparaison ne la voyait pas.

Les trois sont corrigés. La fenêtre distingue désormais les éléments nouveaux, mis à jour, connus,
et bloqués par une suppression locale ; pour ces derniers, une case permet de les restaurer. Le
bouton de mise à jour affiche la version publiée en regard de la version installée.

---

## v1.2.1-multi — correction du numéro de version

Le paquet v1.2 portait encore les numéros de la v1.1, dans l'application comme dans le service
worker : le cache ne voyant aucun changement, rien ne se réinstallait. Le script de dérivation
refuse désormais de produire `/multi/` si le numéro affiché et celui du cache divergent.

---

## v1.2-multi — import validé, participants, journal

Le fichier joint m'a donné le diagnostic exact : ses éléments portaient `au` égal à mon propre
identifiant, et la fusion les ignorait délibérément — un commentaire ajouté dans le code disait
« mes propres éléments font foi ici ». Un aller-retour sur le même appareil, ou une restauration
depuis un second appareil, ne pouvait donc rien importer. Les éléments portant mon identifiant
sont désormais fusionnés comme les autres, le compteur logique tranchant, la copie locale
l'emportant à égalité pour ne pas écraser une retouche non exportée. Rejoué sur votre fichier :
trois commentaires importés, étiquetés DW-1 à DW-3, et un réimport immédiat n'ajoute rien.

**L'import avec validation** montre le fichier, le document visé et s'il correspond à celui qui
est ouvert, la date de création, la répartition par type, et le détail de ce que l'import
changerait — nouveaux, mis à jour, déjà connus. Les initiales de l'expéditeur sont modifiables
avant fusion. Si elles coïncident avec les vôtres, une case « c'est moi » vous permet de
reprendre cette identité : vos deux appareils cessent alors de compter pour deux participants.
Un réglage bascule en import silencieux.

**Les échecs sont nommés** : fichier illisible avec le message de l'analyseur, fichier qui n'est
pas un fichier d'annotations, fichier vide, document différent.

**Les participants** apparaissent en compteur sur le bouton de partage, avec la liste des
initiales en infobulle, et ouvrent l'annexe du PDF exporté — sans quoi les sigles des pastilles
resteraient des énigmes.

---

## Versions antérieures

Le journal démarre à la v1.2-multi. Pour mémoire, les grandes étapes précédentes :

- **v1.1-multi** — partage d'annotations par fichier : identité par initiales avec résolution
  déterministe des collisions, numérotation stable `TAG-n`, propriété des éléments, fusion par
  union avec pierres tombales, vérification de l'empreinte du document.
- **v1.0-multi** — bac à sable `/multi/` dérivé de l'application par `tools/build-multi.cjs`,
  portée et cache distincts, session isolée.
- **v1.0.1** — guide illustré des véritables captures d'écran, libellés courts, engrenage pour
  les propriétés.
- **v1.0** — guide PDF embarqué, licence MIT, partage de l'adresse, numéro de page éditable.
- **v0.24** — saisie des commentaires par panneau non modal devenue l'unique voie.
- **v0.22** — ligne de couleur unifiée, reprise de session après mise en arrière-plan.
- **v0.13** — bibliothèque de signatures exportable, chiffrée par mot de passe obligatoire.
- **v0.06** — commentaires : cadre libre, annexe liée, aller-retour par liens internes.
- **v0.05** — polices libres embarquées, surligneur accroché aux lignes de texte.
- **v0.02** — application web installable, thème, sept langues.
