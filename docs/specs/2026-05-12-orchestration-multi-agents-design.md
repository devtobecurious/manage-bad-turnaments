# Orchestration multi-agents par issue GitHub

**Date :** 2026-05-12  
**Projet :** manage-bad-turnaments  
**Approche retenue :** Session Claude Code orchestratrice + outil Agent natif

---

## 1. Vue d'ensemble

Pour chaque issue GitHub ouverte, un agent Claude Code dédié travaille dans une branche et un worktree isolés. L'orchestrateur (session Claude Code principale) résout le graphe de dépendances, lance les agents indépendants en parallèle et débloque les dépendants dès que leurs prérequis passent en `done`. L'état est persisté dans des fichiers JSON locaux dont la cohérence est vérifiée contre GitHub à chaque démarrage — ce qui rend la reprise idempotente après toute coupure.

---

## 2. Architecture globale

```
Session orchestrateur (Claude Code principal)
│
├── Lit .agents/deps.json
├── Reconstruit l'état depuis .agents/status/*.json + GitHub
│
├── Vague 1  ──► Agent issue-1  (US-001 Auth)
│
├── Vague 2  ──► Agent issue-2  (US-003 Créer profil)
│           ──► Agent issue-3  (US-004 Liste membres)
│           ──► Agent issue-4  (US-002 Lien inscription)
│
├── Vague 3  ──► Agent issue-5  (US-005 Créer tournoi)
│           ──► Agent issue-6  (US-006 Format poules)
│
├── Vague 4  ──► Agent issue-7  (US-007 Publier tournoi)
│
├── Vague 5  ──► Agent issue-8  (US-009 Gérer inscrits)
│           ──► Agent issue-9  (US-010 Clôturer inscriptions)
│           ──► Agent issue-10 (US-008 S'inscrire tournoi)
│
├── Vague 6  ──► Agent issue-11 (US-011 Former paires)
│           ──► Agent issue-12 (US-012 Répartir poules)
│
├── Vague 7  ──► Agent issue-13 (US-013 Calendrier matchs)
│           ──► Agent issue-14 (US-014 Saisir score poule)
│           ──► Agent issue-15 (US-015 Calcul classement)
│
├── Vague 8  ──► Agent issue-16 (US-016 Consulter résultats)
│           ──► Agent issue-17 (US-017 Générer tableau final)
│
├── Vague 9  ──► Agent issue-18 (US-018 Saisir score finale)
│           ──► Agent issue-19 (US-019 Consulter tableau final)
│
└── Vague 10 ──► Agent issue-20 (US-020 Stats joueur)
```

**Principe :** chaque vague est un appel `Agent` multi-blocs (parallèle natif). L'orchestrateur attend que TOUS les agents d'une vague terminent avant de calculer et lancer la vague suivante. Le nombre de vagues est calculé dynamiquement depuis `deps.json` — les 10 vagues ci-dessus reflètent le graphe de dépendances actuel.

---

## 3. Structure des fichiers

```
manage-bad-turnaments/
  .agents/
    deps.json              ← graphe de dépendances (auto-généré + éditable)
    status/
      issue-1.json         ← état de chaque agent
      issue-2.json
      ...
    context/
      issue-1.md           ← contexte injecté (généré avant lancement)
      issue-2.md
      ...
manage-bad-turnaments-worktrees/
  issue-1/                 ← worktree isolé par agent
  issue-2/
  ...
```

---

## 4. Graphe de dépendances (`deps.json`)

Généré automatiquement depuis les labels GitHub (épic + numéro d'ordre), puis éditable manuellement.

```json
{
  "_generated": "2026-05-12T10:00:00Z",
  "_source": "github-labels",
  "dependencies": {
    "issue-1":  [],
    "issue-2":  ["issue-1"],
    "issue-3":  ["issue-1"],
    "issue-4":  ["issue-1"],
    "issue-5":  ["issue-2", "issue-3", "issue-4"],
    "issue-6":  ["issue-2", "issue-3", "issue-4"],
    "issue-7":  ["issue-5", "issue-6"],
    "issue-8":  ["issue-5", "issue-6", "issue-7"],
    "issue-9":  ["issue-5", "issue-6", "issue-7"],
    "issue-10": ["issue-5", "issue-6", "issue-7"],
    "issue-11": ["issue-8", "issue-9", "issue-10"],
    "issue-12": ["issue-8", "issue-9", "issue-10"],
    "issue-13": ["issue-11", "issue-12"],
    "issue-14": ["issue-11", "issue-12"],
    "issue-15": ["issue-11", "issue-12"],
    "issue-16": ["issue-13", "issue-14", "issue-15"],
    "issue-17": ["issue-13", "issue-14", "issue-15"],
    "issue-18": ["issue-17"],
    "issue-19": ["issue-17"],
    "issue-20": ["issue-16", "issue-17", "issue-18", "issue-19"]
  }
}
```

---

## 5. Machine d'état par issue

### Fichier `.agents/status/issue-N.json`

```json
{
  "issue": 5,
  "status": "in-progress",
  "step": "tests-passing",
  "branch": "feat/issue-5-creer-tournoi",
  "worktree": "D:/Works/Projects/Persos/manage-bad-turnaments-worktrees/issue-5",
  "pr": 42,
  "startedAt": "2026-05-12T10:23:00Z",
  "updatedAt": "2026-05-12T10:47:00Z",
  "error": null
}
```

### Transitions d'état

```
pending → coding → tests-passing → pr-open → review-ok → merged
                                                        ↘ failed
```

- **`pending`** : issue en attente de démarrage
- **`coding`** : agent en cours d'implémentation
- **`tests-passing`** : `ng test` passe sans erreur
- **`pr-open`** : PR créée sur GitHub
- **`review-ok`** : auto-review validée, prête à merger
- **`merged`** : PR mergée dans `main`
- **`failed`** : bloquant non résolvable, notification utilisateur

### Statuts orchestrateur

- `"status": "done"` = `"step": "merged"`
- `"status": "failed"` = agent bloqué, l'orchestrateur arrête les dépendants et notifie

---

## 6. Logique de reprise idempotente

Au démarrage (ou reprise), l'orchestrateur exécute pour chaque issue :

| Fichier local | État GitHub | Action |
|---|---|---|
| `merged` | PR mergée | Skip — rien à faire |
| `in-progress`, step `pr-open` | PR ouverte | Relancer agent depuis `review-ok` |
| `in-progress`, step `coding` | Branch avec commits | Relancer depuis `coding` |
| `in-progress`, step `coding` | Branch vide ou absente | Relancer depuis zéro |
| Absent | Rien | Démarrer normalement |
| `failed` | Peu importe | Notifier utilisateur, ne pas relancer |

Après reconstruction d'état, l'orchestrateur recalcule le graphe — toute issue reconstituée comme `done` débloque immédiatement ses dépendants.

---

## 7. Contexte injecté dans chaque agent

L'orchestrateur génère `.agents/context/issue-N.md` juste avant le lancement.

### Contenu (adaptatif)

```markdown
# Issue #N — [titre]

## Critères d'acceptation
[corps verbatim de l'issue GitHub]

## Stack & règles (extrait CLAUDE.md)
- Framework : Angular 22-next, standalone components, signals
- Tests : Vitest via `cd main-app && ng test`
- Styles : Tailwind CSS v4
- Backend : Firebase uniquement (Firestore, Auth Google, Hosting)
- Pas de Cloud Functions — logique métier dans services Angular
- Chaque service créé = fichier `.spec.ts` obligatoire

## Services Angular existants (grep ciblé)
[liste des services pertinents avec leurs chemins — générée par grep de *.service.ts]

## Interfaces/modèles existants
[liste des *.model.ts et *.interface.ts pertinents]

## Branche de travail
[nom de branche] — worktree : [chemin absolu]

## Étape de reprise
[pending | coding | ...]
```

### Ce qui n'est pas injecté
- Historique git, CDC brut, issues des autres agents
- Fichiers source complets (l'agent les lit si besoin)
- Sections CLAUDE.md non pertinentes (historique, discussions)

**Objectif :** contexte initial de ~600-900 tokens vs ~8000 si tout était injecté.

---

## 8. Prompt de lancement agent

```
Tu es un agent de développement Angular spécialisé dans Firebase/Firestore.

Contexte de ta mission : [contenu de .agents/context/issue-N.md]

Worktree de travail : [chemin absolu] — branche : [nom]
Fichier de statut à maintenir : .agents/status/issue-N.json

Objectif :
1. Implémenter l'issue selon les critères d'acceptation
2. Écrire les tests Vitest (fichier .spec.ts obligatoire par service)
3. Faire passer `ng test` sans erreur
4. Ouvrir une PR vers main
5. Faire la review complète de ta propre PR
6. Merger si tout est OK — sinon passer en "failed" avec détail de l'erreur

Met à jour le fichier de statut JSON à chaque étape franchie.
Ne committe jamais de clés Firebase réelles.
```

---

## 9. Review automatique et merge

### Critères de review (checklist agent)

1. Tous les critères d'acceptation de l'issue ont un test Vitest correspondant
2. Fichier `.spec.ts` présent pour chaque service créé
3. Pas de clés Firebase dans les fichiers committés
4. Conventions Angular respectées : standalone components, signals, services injectables
5. Pas d'import de modules Angular deprecated
6. Pas de `console.log` laissé dans le code de prod

### Décision

| Résultat | Action |
|---|---|
| Tout OK | Merge + `step: "merged"` + notification |
| Problème mineur (manque commentaire, lint) | Auto-fix + re-review (max 2 passes) — si non résolu après 2 passes : `status: "failed"` |
| Bloquant (critère d'acceptation non couvert) | `status: "failed"`, error détaillée, notification |

### Notification agrégée en fin de vague

```
Vague 3 terminée :
✓ Issue #5 — feat/issue-5-creer-tournoi mergée (PR #42)
✓ Issue #6 — feat/issue-6-format-poules mergée (PR #43)
✗ Issue #7 — feat/issue-7-publier-tournoi BLOQUÉE
  → Raison : critère CA-2 "lien de tournoi unique" sans test Vitest
```

---

## 10. Commandes de démarrage

```
# Premier lancement (génère deps.json + lance toutes les vagues)
"Lance l'orchestration multi-agents pour toutes les issues ouvertes"

# Reprise après coupure
"Reprends l'orchestration — reconstruis l'état depuis GitHub"

# Relancer une issue spécifique
"Relance l'agent pour l'issue #7 depuis l'étape coding"

# Générer/régénérer deps.json depuis les labels GitHub
"Regénère le graphe de dépendances depuis les labels GitHub"
```

---

## 11. Invariants et contraintes

- Un seul worktree par issue — jamais deux agents sur la même branche
- Un agent ne modifie jamais le worktree d'un autre agent
- L'orchestrateur ne merge jamais directement — il délègue toujours à l'agent
- Si une issue passe en `failed`, ses dépendants ne démarrent pas
- Les fichiers `.agents/` sont committés dans le repo (traçabilité de l'orchestration)
- Firebase config (`environment.ts`) reste dans `.gitignore` — jamais committée
