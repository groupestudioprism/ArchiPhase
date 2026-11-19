# ARCHIPHASE · Studio Prism

Planification et phasage de projets : diagramme de Gantt, ressources, réseau PERT, chemin critique, planning de référence.
Une app du pôle **Prism App** de Studio Prism, dans la gamme **Archi** (ARCHIPLAN, ARCHITRAFIC, Archi Vision). Reprend l'esprit de GanttProject, en plus moderne, sur téléphone, tablette et ordinateur.

**En ligne :** https://archiphase.studio-prism.com/

## Fonctions
- **Gantt** : tâches, sous-tâches (phases), jalons ; glisser une barre pour la déplacer, son bord droit pour la durée, le triangle pour l'avancement, le rond pour lier à une autre tâche.
- **Durées** en jours, semaines, mois ou années (stockées en jours ouvrés : 1 sem. = jours travaillés de la semaine, 1 mois ≈ 22 j, 1 an = 52 sem.) ; saisie libre dans le tableau (« 3 sem », « 2 mois »).
- **Nivellement des ressources** (menu Fichier) : décale automatiquement les tâches non commencées pour supprimer les surcharges, en une action annulable.
- **Rattraper les retards** (menu Fichier) : replanifie à partir d'aujourd'hui ce qui devait être fait, en une action annulable.
- **Palette de commandes** (Ctrl+K ou loupe) : retrouver une tâche, lancer une action, créer une tâche au clavier (« Pose bordures 2 sem »).
- **Courbe en S** (onglet Projet) : avancement prévu et réel d'aujourd'hui.
- **Grands plannings** : au-delà de 250 lignes visibles, seules les lignes proches de l'écran sont dessinées (1 200 tâches : affichage en quelques millisecondes).
- **Liens** FD / DD / FF / DF avec décalage (positif ou négatif) ; les liens poussent les tâches suivantes ; boucles détectées.
- **Calendrier** : jours travaillés de la semaine, jours fériés français calculés automatiquement (Pâques, Ascension, Pentecôte…), fermetures et congés, jours travaillés exceptionnels.
- **Chemin critique** et marges totales, **planning de référence** et écarts, tâches en retard sur l'avancement attendu.
- **Ressources** : équipes, personnes, engins, sous-traitants ; affectation en %, coût par jour, capacité, vue de charge avec surcharges.
- **PERT** : réseau des tâches avec dates au plus tôt et au plus tard.
- **Imports** : GanttProject (.gan), MS Project (.xml), tableur (.csv), ARCHIPHASE (.json).
- **Exports** (licence) : GanttProject (.gan), MS Project (.xml), CSV, image PNG HD, impression / PDF A3, jalons dans l'agenda (.ics), sauvegarde .json.
- **Modèles** : réseaux EU / EP et voirie, conduite AEP, maison individuelle, projet BIM, projet logiciel.
- **Compte Studio Prism** commun aux apps (code PIN, licences `licenses/{uid}_archiphase`), cloud avec dossiers et partage (`aphProjects`, `aphFolders`, `aphShares`, `aphGrants`, `aphUsage`, `aphLibrary`).

## Contenu du dépôt
| Fichier | Rôle |
| --- | --- |
| `src/parts/` | En-tête et structure de la page (intro, compte, planning, accueil) |
| `src/css/` | Charte Studio Prism (`app.css`, `auth.css`, `home.css`), couleurs ARCHIPHASE (`brand.css`), intro (`splash.css`), planning (`gantt.css`) |
| `src/js/` | Intro animée (`intro.js`), compte et code PIN (`auth.js`), cloud et accueil (`cloud.js`), menu du compte (`auth-end.js`) |
| `src/engine/` | Moteur : calendrier, modèle, ordonnancement, vues Gantt / Ressources / PERT, panneau, imports / exports, outils (`75-tools.js` : nivellement, rattrapage, palette, courbe en S) |
| `tools/build.py` | `python3 tools/build.py` → `index.html` (en ligne, Firebase branché) et `dist/archiphase-demo.html` (démo autonome) |
| `assets/` | Logo, emblème, icônes (`logo-source.svg` : source vectorielle du logo) |

On modifie `src/`, on lance `python3 tools/build.py`, on enregistre sur `main` : GitHub Pages met le site à jour.
Les règles Firestore sont dans le dépôt **Studio-Prism** (`firebase/rules/16-archiphase.rules`).
