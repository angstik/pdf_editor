# Journal des livraisons. 

Chaque entrée porte pour titre la version suivie d'une synthèse courte, et reprend
le texte de livraison correspondant.

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
