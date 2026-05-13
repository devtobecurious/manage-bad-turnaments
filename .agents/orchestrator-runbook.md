# Orchestrator Runbook

Ce document décrit exactement ce que la session Claude Code principale doit faire
pour orchestrer tous les agents. Lis-le entièrement avant de commencer.

---

## Pré-requis

- `gh` authentifié sur le repo `devtobecurious/manage-bad-turnaments`
- PowerShell disponible dans le terminal
- Être à la racine de `manage-bad-turnaments/`

---

## Phase 0 — Initialisation

### 0.1 Régénérer le graphe de dépendances

**But :** mettre à jour `deps.json` si des issues ont été ajoutées ou modifiées depuis la dernière fois.

```powershell
.\scripts\gen-deps.ps1
```

Vérifie que `.agents/deps.json` contient bien toutes les issues ouvertes.

### 0.2 Réconcilier l'état

**But :** reconstruire l'état réel depuis GitHub — même après une coupure, on sait exactement où on en est.

```powershell
$state = .\scripts\check-state.ps1 | ConvertFrom-Json
```

`$state` est un tableau d'objets. Chaque objet a : `issue`, `key`, `status`, `step`, `branch`, `pr`, `stale`.

### 0.3 Calculer les vagues

**But :** grouper les issues dont tous les prérequis sont `done` pour les lancer en parallèle.

Algorithme de tri topologique :
- Une issue est "prête" si tous ses prérequis ont `status == "done"`
- Regroupe les issues prêtes (ni `done`, ni `failed`) en une vague
- Retire les issues `done` et `failed` de la liste
- Répète jusqu'à épuisement

Vagues attendues au démarrage (toutes `pending`) :
```
Vague 1  : issue-1   (US-001 Auth)
Vague 2  : issue-2   (US-003 Créer profil)
Vague 3  : issue-3   (US-004 Liste membres)
Vague 4  : issue-4   (US-002 Inscription lien)
Vague 5  : issue-5   (US-005 Créer tournoi)
Vague 6  : issue-6   (US-006 Format poules)
Vague 7  : issue-7   (US-007 Publier tournoi)
Vague 8  : issue-8   (US-009 Gérer inscrits)
Vague 9  : issue-9   (US-010 Clôturer inscriptions)
Vague 10 : issue-10  (US-008 S'inscrire tournoi)
Vague 11 : issue-11  (US-011 Former paires)
Vague 12 : issue-12  (US-012 Répartir poules)
Vague 13 : issue-13  (US-013 Calendrier matchs)
Vague 14 : issue-14  (US-014 Saisir score poule)
Vague 15 : issue-15  (US-015 Calcul classement)
Vague 16 : issue-16  (US-016 Consulter résultats)
Vague 17 : issue-17  (US-017 Générer tableau final)
Vague 18 : issue-18  (US-018 Saisir score finale)
Vague 19 : issue-19  (US-019 Consulter tableau final)
Vague 20 : issue-20  (US-020 Stats joueur)
```
Note : les vagues sont séquentielles (1 issue par vague) car chaque issue dépend
de la précédente dans son épic — garantit que les services/modèles existent avant usage.

---

## Phase 1 — Exécution des vagues

Pour chaque vague, dans l'ordre :

### 1.1 Générer les contextes de la vague

**But :** préparer le briefing minimal de chaque agent (critères d'acceptation + services existants).

Pour chaque issue N de la vague :

```powershell
$step = ($state | Where-Object { $_.issue -eq N }).step
.\scripts\gen-context.ps1 -IssueNumber N -Step $step
```

### 1.2 Lancer les agents en parallèle

**But :** implémenter toutes les issues de la vague simultanément.

Utilise l'outil Agent avec autant de blocs que d'issues dans la vague, **dans un seul appel**.
Pour chaque issue N, construis le prompt en :
1. Lisant `.agents/agent-prompt-template.md`
2. Remplaçant `{{CONTEXT}}` par le contenu de `.agents/context/issue-N.md`
3. Remplaçant `{{ISSUE_NUMBER}}` par N
4. Remplaçant `{{BRANCH}}` par la branche lue dans le contexte
5. Remplaçant `{{WORKTREE}}` par le worktree lu dans le contexte
6. Remplaçant `{{TITLE}}` par le titre de l'issue
7. Remplaçant `{{NOW}}` par le timestamp ISO actuel

### 1.3 Attendre la fin de la vague

L'outil Agent est bloquant : quand tous les appels retournent, la vague est terminée.

### 1.4 Lire les résultats

```powershell
$state = .\scripts\check-state.ps1 | ConvertFrom-Json
```

### 1.5 Afficher le rapport de vague

```
Vague X terminée :
✓ Issue #N — <branche> mergée (PR #M)
✗ Issue #N — BLOQUÉE → <contenu du champ error>
```

### 1.6 Traiter les échecs

Si une issue est `failed` :
- Identifie ses dépendants (issues qui l'ont comme prérequis dans `deps.json`)
- Exclue l'issue et ses dépendants des vagues suivantes
- Continue avec les vagues restantes qui n'en dépendent pas
- Notifie l'utilisateur avec le détail de l'erreur

---

## Phase 2 — Reprise après coupure

Si la session orchestratrice a été interrompue :

1. Relancer depuis Phase 0 — `check-state.ps1` reconstruit l'état depuis GitHub
2. Les issues `done` sont automatiquement exclues du calcul des vagues
3. Les issues `in-progress` avec une branche existante sont relancées à leur étape courante
4. Les issues `failed` sont signalées sans être relancées

---

## Commandes rapides

```powershell
# Voir l'état actuel de toutes les issues
.\scripts\check-state.ps1 | ConvertFrom-Json | Format-Table issue, status, step, branch -AutoSize

# Lancer l'orchestration complète depuis zéro
.\scripts\gen-deps.ps1
# Puis calculer les vagues et lancer les agents vague par vague (voir Phase 1)

# Relancer uniquement l'issue #7
.\scripts\gen-context.ps1 -IssueNumber 7 -Step "pending"
# Puis lancer un seul Agent pour l'issue #7 avec le template

# Régénérer le graphe de dépendances (après ajout d'issues)
.\scripts\gen-deps.ps1
```
