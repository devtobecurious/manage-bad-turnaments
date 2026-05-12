# Orchestration Multi-Agents par Issue GitHub — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place l'infrastructure d'orchestration qui permet à une session Claude Code principale de lancer un agent dédié par issue GitHub, en parallèle pour les issues indépendantes et en séquence pour les dépendantes, avec reprise idempotente après coupure.

**Architecture:** Un ensemble de scripts PowerShell gère la génération du graphe de dépendances (`deps.json`), la génération du contexte adaptatif par agent, et la réconciliation d'état local vs GitHub. Un runbook orchestrateur (`orchestrator-runbook.md`) décrit exactement ce que la session Claude Code principale doit faire étape par étape. Chaque agent reçoit un contexte minimal (~600-900 tokens) et écrit son avancement dans `.agents/status/issue-N.json`.

**Tech Stack:** PowerShell 5.1, GitHub CLI (`gh`), Claude Code Agent tool, Git worktrees, Vitest (Angular)

---

## Structure des fichiers créés/modifiés

```
manage-bad-turnaments/
  .agents/
    deps.json                      ← graphe de dépendances (généré par gen-deps.ps1)
    agent-prompt-template.md       ← template du prompt injecté dans chaque agent
    orchestrator-runbook.md        ← runbook pas-à-pas pour la session orchestratrice
    status/
      .gitkeep                     ← répertoire des états par agent
    context/
      .gitkeep                     ← répertoire des contextes générés
  scripts/
    gen-deps.ps1                   ← génère deps.json depuis les labels GitHub
    gen-context.ps1                ← génère .agents/context/issue-N.md pour un agent
    check-state.ps1                ← réconcilie état local vs GitHub, retourne JSON
  CLAUDE.md                        ← section "Orchestration" mise à jour
```

---

## Task 1 : Créer la structure de répertoires `.agents/`

**Files:**
- Create: `.agents/status/.gitkeep`
- Create: `.agents/context/.gitkeep`

- [ ] **Step 1 : Créer les répertoires et fichiers `.gitkeep`**

```powershell
New-Item -ItemType Directory -Force ".agents/status" | Out-Null
New-Item -ItemType Directory -Force ".agents/context" | Out-Null
New-Item -ItemType File -Force ".agents/status/.gitkeep" | Out-Null
New-Item -ItemType File -Force ".agents/context/.gitkeep" | Out-Null
```

- [ ] **Step 2 : Vérifier la structure**

```powershell
Get-ChildItem ".agents" -Recurse
```

Résultat attendu :
```
    Répertoire : .agents\context
Mode    LastWriteTime         Length Name
----    -------------         ------ ----
-a----  ...                        0 .gitkeep

    Répertoire : .agents\status
Mode    LastWriteTime         Length Name
----    -------------         ------ ----
-a----  ...                        0 .gitkeep
```

- [ ] **Step 3 : Committer**

```powershell
git add .agents/status/.gitkeep .agents/context/.gitkeep
git commit -m "chore: init .agents/ directory structure"
```

---

## Task 2 : Script `scripts/gen-deps.ps1` — Générer `deps.json` depuis GitHub

**Files:**
- Create: `scripts/gen-deps.ps1`
- Create: `.agents/deps.json`

- [ ] **Step 1 : Créer le répertoire scripts**

```powershell
New-Item -ItemType Directory -Force "scripts" | Out-Null
```

- [ ] **Step 2 : Écrire `scripts/gen-deps.ps1`**

```powershell
# scripts/gen-deps.ps1
# Génère .agents/deps.json depuis les labels GitHub des issues ouvertes.
# Usage : .\scripts\gen-deps.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Ordre des épics et leurs dépendances inter-épics
$epicOrder = [ordered]@{
    "epic:auth"          = @()
    "epic:joueurs"       = @("epic:auth")
    "epic:tournois"      = @("epic:joueurs")
    "epic:inscriptions"  = @("epic:tournois")
    "epic:poules"        = @("epic:inscriptions")
    "epic:matchs"        = @("epic:poules")
    "epic:tableau-final" = @("epic:matchs")
    "epic:stats"         = @("epic:tableau-final", "epic:matchs")
}

Write-Host "Récupération des issues GitHub..."
$rawIssues = gh issue list --limit 100 --state open --json number,title,labels | ConvertFrom-Json

# Construire un index : épic -> liste de numéros d'issues (triés par numéro croissant)
$epicToIssues = @{}
foreach ($issue in $rawIssues) {
    $epicLabel = ($issue.labels | Where-Object { $_.name -like "epic:*" } | Select-Object -First 1).name
    if (-not $epicLabel) { continue }
    if (-not $epicToIssues.ContainsKey($epicLabel)) {
        $epicToIssues[$epicLabel] = @()
    }
    $epicToIssues[$epicLabel] += $issue.number
}

# Construire le graphe de dépendances
$dependencies = [ordered]@{}
foreach ($issue in ($rawIssues | Sort-Object number)) {
    $epicLabel = ($issue.labels | Where-Object { $_.name -like "epic:*" } | Select-Object -First 1).name
    if (-not $epicLabel) { continue }

    $key = "issue-$($issue.number)"
    $deps = @()

    # Trouver les épics dont dépend cet épic
    $parentEpics = $epicOrder[$epicLabel]
    if ($parentEpics) {
        foreach ($parentEpic in $parentEpics) {
            if ($epicToIssues.ContainsKey($parentEpic)) {
                foreach ($parentIssueNum in $epicToIssues[$parentEpic]) {
                    $deps += "issue-$parentIssueNum"
                }
            }
        }
    }

    $dependencies[$key] = $deps
}

$output = [ordered]@{
    "_generated" = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    "_source"    = "github-labels"
    "dependencies" = $dependencies
}

$outputPath = ".agents/deps.json"
$output | ConvertTo-Json -Depth 5 | Set-Content $outputPath -Encoding utf8
Write-Host "deps.json généré : $outputPath"
Write-Host ($output | ConvertTo-Json -Depth 5)
```

- [ ] **Step 3 : Exécuter le script et vérifier**

```powershell
cd "D:\Works\Projects\Persos\manage-bad-turnaments"
.\scripts\gen-deps.ps1
```

Résultat attendu : un fichier `.agents/deps.json` avec 20 entrées, issue-1 ayant `[]` comme dépendances, issue-2/3/4 ayant `["issue-1"]`, etc.

- [ ] **Step 4 : Vérifier manuellement quelques entrées clés**

```powershell
$deps = Get-Content ".agents/deps.json" | ConvertFrom-Json
Write-Host "issue-1 deps: $($deps.dependencies.'issue-1')"    # attendu : (vide)
Write-Host "issue-2 deps: $($deps.dependencies.'issue-2')"    # attendu : issue-1
Write-Host "issue-5 deps: $($deps.dependencies.'issue-5')"    # attendu : issue-2, issue-3, issue-4
Write-Host "issue-20 deps: $($deps.dependencies.'issue-20')"  # attendu : issues 13-19
```

- [ ] **Step 5 : Committer**

```powershell
git add scripts/gen-deps.ps1 .agents/deps.json
git commit -m "feat(agents): add gen-deps.ps1 + initial deps.json"
```

---

## Task 3 : Script `scripts/gen-context.ps1` — Générer le contexte d'un agent

**Files:**
- Create: `scripts/gen-context.ps1`

- [ ] **Step 1 : Écrire `scripts/gen-context.ps1`**

```powershell
# scripts/gen-context.ps1
# Génère .agents/context/issue-N.md pour un agent donné.
# Usage : .\scripts\gen-context.ps1 -IssueNumber 5 -Step "pending"

param(
    [Parameter(Mandatory)][int]$IssueNumber,
    [string]$Step = "pending"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Génération du contexte pour issue #$IssueNumber..."

# Récupérer le corps de l'issue depuis GitHub
$issueData = gh issue view $IssueNumber --json title,body | ConvertFrom-Json
$title = $issueData.title
$body  = $issueData.body

# Récupérer le nom de branche depuis deps.json (ou construire depuis le titre)
$slug = ($title -replace '^\[US-\d+\]\s*', '' `
               -replace '[^a-zA-Z0-9\s]', '' `
               -replace '\s+', '-' `
               -replace '-+', '-').ToLower().Trim('-')
$slug = $slug.Substring(0, [Math]::Min(40, $slug.Length))
$branch = "feat/issue-$IssueNumber-$slug"
$worktree = "D:/Works/Projects/Persos/manage-bad-turnaments-worktrees/issue-$IssueNumber"

# Grep des services Angular existants pertinents pour cette issue
$servicesDir = "main-app/src/app/core/services"
$existingServices = @()
if (Test-Path $servicesDir) {
    $existingServices = Get-ChildItem $servicesDir -Filter "*.service.ts" -Recurse |
        ForEach-Object { "- $($_.Name) : $($_.FullName.Replace((Get-Location).Path + '\', '').Replace('\','/'))" }
}

# Grep des modèles/interfaces existants
$modelsDir = "main-app/src/app/core/models"
$existingModels = @()
if (Test-Path $modelsDir) {
    $existingModels = Get-ChildItem $modelsDir -Filter "*.ts" -Recurse |
        ForEach-Object { "- $($_.Name) : $($_.FullName.Replace((Get-Location).Path + '\', '').Replace('\','/'))" }
}

$servicesSection = if ($existingServices.Count -gt 0) {
    $existingServices -join "`n"
} else {
    "(aucun service existant — tu crées les premiers)"
}

$modelsSection = if ($existingModels.Count -gt 0) {
    $existingModels -join "`n"
} else {
    "(aucun modèle existant — tu crées les premiers)"
}

$contextContent = @"
# Issue #$IssueNumber — $title

## Critères d'acceptation
$body

## Stack & règles
- Framework : Angular 22-next, standalone components, signals
- Tests : Vitest via ``cd main-app && ng test``
- Styles : Tailwind CSS v4
- Backend : Firebase uniquement (Firestore, Auth OAuth Google, Hosting)
- Pas de Cloud Functions — toute logique métier dans des services Angular
- Chaque service créé = fichier ``.spec.ts`` obligatoire
- Ne jamais committer ``environment.ts`` (clés Firebase)
- Convention Git : branche ``feat/issue-N-slug``, merge vers ``main``

## Services Angular existants
$servicesSection

## Interfaces/modèles existants
$modelsSection

## Branche de travail
``$branch``

## Worktree
``$worktree``

## Fichier de statut à maintenir
``.agents/status/issue-$IssueNumber.json``

## Étape de reprise
$Step
"@

$outputPath = ".agents/context/issue-$IssueNumber.md"
$contextContent | Set-Content $outputPath -Encoding utf8
Write-Host "Contexte généré : $outputPath"
```

- [ ] **Step 2 : Tester avec l'issue #1**

```powershell
.\scripts\gen-context.ps1 -IssueNumber 1 -Step "pending"
Get-Content ".agents/context/issue-1.md"
```

Résultat attendu : fichier contenant le titre `[US-001] Connexion administrateur`, le corps de l'issue, la stack, les services (vides au premier run), la branche `feat/issue-1-connexion-administrateur`.

- [ ] **Step 3 : Tester avec l'issue #5**

```powershell
.\scripts\gen-context.ps1 -IssueNumber 5 -Step "pending"
Get-Content ".agents/context/issue-5.md"
```

- [ ] **Step 4 : Supprimer les fichiers de test générés (ils seront recréés à la volée)**

```powershell
Remove-Item ".agents/context/issue-1.md" -ErrorAction SilentlyContinue
Remove-Item ".agents/context/issue-5.md" -ErrorAction SilentlyContinue
```

- [ ] **Step 5 : Committer**

```powershell
git add scripts/gen-context.ps1
git commit -m "feat(agents): add gen-context.ps1 for adaptive agent context"
```

---

## Task 4 : Script `scripts/check-state.ps1` — Réconciliation état local vs GitHub

**Files:**
- Create: `scripts/check-state.ps1`

- [ ] **Step 1 : Écrire `scripts/check-state.ps1`**

```powershell
# scripts/check-state.ps1
# Réconcilie l'état local (.agents/status/*.json) avec GitHub (branches + PRs).
# Retourne un tableau JSON des états réconciliés pour toutes les issues.
# Usage : .\scripts\check-state.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Charger deps.json pour connaître la liste des issues
$deps = Get-Content ".agents/deps.json" | ConvertFrom-Json
$allIssueKeys = $deps.dependencies.PSObject.Properties.Name  # ex: "issue-1", "issue-2"...

# Charger les PRs GitHub ouverts et mergés
$openPRs   = gh pr list --state open   --json number,title,headRefName | ConvertFrom-Json
$mergedPRs = gh pr list --state merged --json number,title,headRefName | ConvertFrom-Json

# Charger les branches distantes
$remoteBranches = git branch -r | ForEach-Object { $_.Trim() -replace '^origin/', '' }

$results = @()

foreach ($key in $allIssueKeys) {
    $issueNum = [int]($key -replace 'issue-', '')
    $statusFile = ".agents/status/issue-$issueNum.json"

    # Lire l'état local s'il existe
    $localState = $null
    if (Test-Path $statusFile) {
        $localState = Get-Content $statusFile | ConvertFrom-Json
    }

    # Chercher une PR mergée pour cette issue
    $mergedPR = $mergedPRs | Where-Object { $_.headRefName -like "*issue-$issueNum*" } | Select-Object -First 1
    # Chercher une PR ouverte
    $openPR   = $openPRs   | Where-Object { $_.headRefName -like "*issue-$issueNum*" } | Select-Object -First 1
    # Chercher une branche distante
    $remoteBranch = $remoteBranches | Where-Object { $_ -like "*issue-$issueNum*" } | Select-Object -First 1

    # Réconcilier
    $reconciledStatus = "pending"
    $reconciledStep   = "pending"
    $prNumber         = $null
    $branch           = $localState?.branch

    if ($mergedPR) {
        $reconciledStatus = "done"
        $reconciledStep   = "merged"
        $prNumber         = $mergedPR.number
        $branch           = $mergedPR.headRefName
    } elseif ($localState -and $localState.step -eq "merged") {
        # Fichier local dit merged mais pas de PR mergée → incohérence, on remet en pr-open
        $reconciledStatus = "in-progress"
        $reconciledStep   = "pr-open"
        $prNumber         = $localState.pr
    } elseif ($openPR) {
        $reconciledStatus = "in-progress"
        $reconciledStep   = if ($localState?.step -eq "review-ok") { "review-ok" } else { "pr-open" }
        $prNumber         = $openPR.number
        $branch           = $openPR.headRefName
    } elseif ($localState -and $localState.status -eq "failed") {
        $reconciledStatus = "failed"
        $reconciledStep   = "failed"
    } elseif ($remoteBranch) {
        # Branche existe mais pas de PR → coding en cours
        $reconciledStatus = "in-progress"
        $reconciledStep   = "coding"
        $branch           = $remoteBranch
    } elseif ($localState -and $localState.status -eq "in-progress") {
        # Fichier local dit in-progress mais aucune branche → relancer depuis zéro
        $reconciledStatus = "in-progress"
        $reconciledStep   = "pending"
    }
    # else: pas de fichier, pas de branche, pas de PR → pending

    $result = [ordered]@{
        issue    = $issueNum
        key      = $key
        status   = $reconciledStatus
        step     = $reconciledStep
        branch   = $branch
        pr       = $prNumber
        stale    = ($localState -ne $null -and $localState.step -ne $reconciledStep)
    }
    $results += $result

    # Mettre à jour le fichier local si incohérent
    if ($result.stale -and $reconciledStatus -ne "pending") {
        $updated = if ($localState) { $localState } else {
            [ordered]@{ issue = $issueNum; startedAt = (Get-Date -Format "o"); error = $null }
        }
        $updated.status    = $reconciledStatus
        $updated.step      = $reconciledStep
        $updated.branch    = $branch
        $updated.pr        = $prNumber
        $updated.updatedAt = (Get-Date -Format "o")
        $updated | ConvertTo-Json | Set-Content $statusFile -Encoding utf8
        Write-Host "  [reconciled] issue-$issueNum : $reconciledStatus/$reconciledStep"
    }
}

$results | ConvertTo-Json -Depth 3
```

- [ ] **Step 2 : Exécuter et vérifier (sur état vierge)**

```powershell
.\scripts\check-state.ps1
```

Résultat attendu : tableau JSON de 20 entrées, toutes avec `"status": "pending"`, `"step": "pending"`, `"stale": false`.

- [ ] **Step 3 : Committer**

```powershell
git add scripts/check-state.ps1
git commit -m "feat(agents): add check-state.ps1 for idempotent state reconciliation"
```

---

## Task 5 : Template de prompt agent (`.agents/agent-prompt-template.md`)

**Files:**
- Create: `.agents/agent-prompt-template.md`

- [ ] **Step 1 : Écrire le template**

```markdown
<!-- .agents/agent-prompt-template.md -->
<!-- Ce fichier est le template. L'orchestrateur remplace {{CONTEXT}} par le contenu de .agents/context/issue-N.md -->

Tu es un agent de développement Angular spécialisé dans Firebase/Firestore.
Tu travailles seul dans un worktree Git isolé. Tu ne touches aucun autre worktree.

---

{{CONTEXT}}

---

## Objectif

Complète les étapes suivantes dans l'ordre. Mets à jour `.agents/status/issue-{{ISSUE_NUMBER}}.json`
après chaque étape franchie.

### Étape 1 — Implémentation (`step: "coding"`)

1. Crée le worktree et la branche :
```powershell
git worktree add "{{WORKTREE}}" -b "{{BRANCH}}"
```
Si le worktree existe déjà (reprise) : `git worktree list` pour vérifier, puis `cd {{WORKTREE}}`.

2. Implémente l'issue selon les critères d'acceptation
3. Pour chaque service Angular créé, crée son fichier `.spec.ts`
4. Ne committe pas `environment.ts` ni aucun fichier contenant des clés Firebase

Mets à jour le JSON de statut :
```json
{ "issue": {{ISSUE_NUMBER}}, "status": "in-progress", "step": "coding",
  "branch": "{{BRANCH}}", "worktree": "{{WORKTREE}}", "pr": null,
  "startedAt": "{{NOW}}", "updatedAt": "{{NOW}}", "error": null }
```

### Étape 2 — Tests (`step: "tests-passing"`)

1. Exécute `cd main-app && ng test --watch=false`
2. Tous les tests doivent passer (0 erreur, 0 échec)
3. Si un test échoue, corrige le code ou le test avant de continuer

Mets à jour le JSON : `"step": "tests-passing"`

### Étape 3 — Pull Request (`step: "pr-open"`)

1. Pousse la branche : `git push -u origin {{BRANCH}}`
2. Crée la PR :
```
gh pr create --title "{{TITLE}}" \
  --body "Closes #{{ISSUE_NUMBER}}\n\n## Critères couverts\n[liste des CA implémentés]" \
  --base main
```
3. Note le numéro de PR retourné

Mets à jour le JSON : `"step": "pr-open"`, `"pr": <numéro>`

### Étape 4 — Review (`step: "review-ok"`)

Vérifie chaque point de la checklist. Si un point échoue, corrige et recommite (max 2 passes) :

- [ ] Chaque critère d'acceptation de l'issue a au moins un test Vitest correspondant
- [ ] Fichier `.spec.ts` présent pour chaque service créé
- [ ] `ng test --watch=false` passe sans erreur après les corrections
- [ ] Aucune clé Firebase dans les fichiers committés (`git log -p | grep -i "apiKey\|authDomain"`)
- [ ] Composants Angular en mode standalone, utilisant signals si état local nécessaire
- [ ] Aucun `console.log` dans le code de production (hors `.spec.ts`)
- [ ] Aucun import de module Angular deprecated

Si la checklist passe : `"step": "review-ok"`
Si bloquant non résolu après 2 passes : `"status": "failed"`, `"error": "<détail précis>"`

### Étape 5 — Merge (`step: "merged"`)

1. `gh pr merge <numéro> --squash --auto`
2. Mets à jour le JSON : `"status": "done"`, `"step": "merged"`, `"updatedAt": "{{NOW}}"`
```

- [ ] **Step 2 : Sauvegarder le fichier**

Utilise le tool Write pour écrire le contenu du Step 1 dans `.agents/agent-prompt-template.md`.

Puis vérifie :
```powershell
Get-Content ".agents/agent-prompt-template.md" | Measure-Object -Line
```

Résultat attendu : plus de 60 lignes.

- [ ] **Step 3 : Committer**

```powershell
git add .agents/agent-prompt-template.md
git commit -m "feat(agents): add agent prompt template with 5-step workflow"
```

---

## Task 6 : Runbook orchestrateur (`.agents/orchestrator-runbook.md`)

**Files:**
- Create: `.agents/orchestrator-runbook.md`

- [ ] **Step 1 : Écrire le runbook**

```markdown
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

```powershell
.\scripts\gen-deps.ps1
```

Vérifie que `.agents/deps.json` contient 20 issues.

### 0.2 Réconcilier l'état

```powershell
$state = .\scripts\check-state.ps1 | ConvertFrom-Json
```

`$state` est un tableau de 20 objets. Chaque objet a : `issue`, `key`, `status`, `step`, `branch`, `pr`, `stale`.

### 0.3 Calculer les vagues

Implémente le tri topologique depuis `deps.json` :
- Une issue est "prête" si tous ses prérequis ont `status == "done"`
- Regroupe les issues prêtes en une vague
- Retire les issues `done` et `failed` de la liste
- Répète jusqu'à épuisement

Vagues attendues avec l'état initial (toutes pending) :
```
Vague 1  : issue-1
Vague 2  : issue-2, issue-3, issue-4
Vague 3  : issue-5, issue-6
Vague 4  : issue-7
Vague 5  : issue-8, issue-9, issue-10
Vague 6  : issue-11, issue-12
Vague 7  : issue-13, issue-14, issue-15
Vague 8  : issue-16, issue-17
Vague 9  : issue-18, issue-19
Vague 10 : issue-20
```

---

## Phase 1 — Exécution des vagues

Pour chaque vague, dans l'ordre :

### 1.1 Générer les contextes de la vague

Pour chaque issue N de la vague :

```powershell
$step = ($state | Where-Object { $_.issue -eq N }).step
.\scripts\gen-context.ps1 -IssueNumber N -Step $step
```

### 1.2 Lancer les agents en parallèle

Utilise l'outil Agent de Claude Code avec autant de blocs Agent que d'issues dans la vague,
**dans un seul appel** (parallèle natif). Pour chaque issue N :

```
Agent(
  description: "Implémenter issue #N",
  prompt: [contenu de .agents/agent-prompt-template.md
           avec {{CONTEXT}} = contenu de .agents/context/issue-N.md,
           {{ISSUE_NUMBER}} = N,
           {{BRANCH}} = branche lue dans le contexte,
           {{WORKTREE}} = worktree lu dans le contexte,
           {{TITLE}} = titre de l'issue,
           {{NOW}} = timestamp ISO actuel]
)
```

### 1.3 Attendre la fin de la vague

L'outil Agent est bloquant : quand tous les appels Agent retournent, la vague est terminée.

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
- Note ses dépendants (issues qui l'ont comme prérequis)
- Exclue l'issue et ses dépendants des vagues suivantes
- Continue avec les vagues restantes qui ne dépendent pas d'elle

---

## Phase 2 — Reprise après coupure

Si la session orchestratrice a été interrompue :

1. `$state = .\scripts\check-state.ps1 | ConvertFrom-Json` — reconstruit l'état depuis GitHub
2. Recalculer les vagues en traitant les issues `done` comme terminées
3. Reprendre à la première vague incomplète

Les agents dont le worktree et la branche existent ont peut-être avancé :
leur `step` dans le JSON local indique où ils en sont.
Relancer un agent avec `Step` = étape courante le fait reprendre là où il s'est arrêté.

---

## Commandes rapides

```powershell
# Lancer toute l'orchestration depuis zéro
.\scripts\gen-deps.ps1
$state = .\scripts\check-state.ps1 | ConvertFrom-Json
# Puis calculer les vagues et lancer les agents vague par vague

# Voir l'état actuel de toutes les issues
.\scripts\check-state.ps1 | ConvertFrom-Json | Format-Table issue, status, step, branch

# Relancer uniquement l'issue #7
.\scripts\gen-context.ps1 -IssueNumber 7 -Step "pending"
# Puis lancer un seul Agent pour l'issue #7

# Régénérer le graphe de dépendances (après ajout d'issues)
.\scripts\gen-deps.ps1
```
```

- [ ] **Step 2 : Sauvegarder le fichier**

Utilise le tool Write pour écrire le contenu du Step 1 dans `.agents/orchestrator-runbook.md`.

Puis vérifie :
```powershell
Get-Content ".agents/orchestrator-runbook.md" | Measure-Object -Line
```

Résultat attendu : plus de 80 lignes.

- [ ] **Step 3 : Committer**

```powershell
git add .agents/orchestrator-runbook.md
git commit -m "feat(agents): add orchestrator runbook"
```

---

## Task 7 : Mettre à jour `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Lire le CLAUDE.md actuel**

```powershell
Get-Content CLAUDE.md
```

- [ ] **Step 2 : Remplacer la section "Coordination multi-agents" existante**

Remplace la section actuelle :
```markdown
## Coordination multi-agents
Fichiers de statut dans `.agents/status/` (à la racine du repo) :
- `issue-N.json` → `{ "status": "done"|"failed"|"in-progress", "branch": "feat/issue-N-…" }`
- Un agent dépendant poll ce fichier toutes les 60 s avant de démarrer
- Si `status: "failed"` → l'agent s'arrête et notifie l'utilisateur
```

Par :
```markdown
## Orchestration multi-agents

Infrastructure complète dans `.agents/` et `scripts/`. Voir la spec :
`docs/specs/2026-05-12-orchestration-multi-agents-design.md`

### Scripts disponibles
- `.\scripts\gen-deps.ps1` — génère `.agents/deps.json` depuis les labels GitHub
- `.\scripts\gen-context.ps1 -IssueNumber N [-Step <step>]` — génère le contexte d'un agent
- `.\scripts\check-state.ps1` — réconcilie l'état local vs GitHub, retourne JSON

### Structure d'état par issue (`.agents/status/issue-N.json`)
```json
{
  "issue": 5, "status": "in-progress", "step": "coding",
  "branch": "feat/issue-5-creer-tournoi",
  "worktree": "D:/Works/Projects/Persos/manage-bad-turnaments-worktrees/issue-5",
  "pr": null, "startedAt": "...", "updatedAt": "...", "error": null
}
```

### Transitions de step
`pending → coding → tests-passing → pr-open → review-ok → merged`
`failed` = bloquant non résolu, dépendants non lancés

### Lancer l'orchestration
Lis `.agents/orchestrator-runbook.md` pour le protocole complet.
Commande de démarrage : `.\scripts\gen-deps.ps1` puis `.\scripts\check-state.ps1`
```

- [ ] **Step 3 : Vérifier que le fichier est valide**

```powershell
Get-Content CLAUDE.md
```

- [ ] **Step 4 : Committer**

```powershell
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with full orchestration infrastructure"
```

---

## Task 8 : Vérification end-to-end

- [ ] **Step 1 : Vérifier que tous les fichiers sont en place**

```powershell
@(
  ".agents/deps.json",
  ".agents/agent-prompt-template.md",
  ".agents/orchestrator-runbook.md",
  ".agents/status/.gitkeep",
  ".agents/context/.gitkeep",
  "scripts/gen-deps.ps1",
  "scripts/gen-context.ps1",
  "scripts/check-state.ps1"
) | ForEach-Object {
  $exists = Test-Path $_
  Write-Host ("$_ : " + $(if ($exists) { "OK" } else { "MANQUANT" }))
}
```

Résultat attendu : tous `OK`.

- [ ] **Step 2 : Simuler un run complet (dry run)**

```powershell
.\scripts\gen-deps.ps1
$state = .\scripts\check-state.ps1 | ConvertFrom-Json
$state | Format-Table issue, status, step -AutoSize
```

Résultat attendu : 20 lignes, toutes `pending`.

- [ ] **Step 3 : Vérifier la génération de contexte pour issue #1**

```powershell
.\scripts\gen-context.ps1 -IssueNumber 1 -Step "pending"
Get-Content ".agents/context/issue-1.md"
Remove-Item ".agents/context/issue-1.md"
```

Résultat attendu : fichier contenant le titre US-001, le corps de l'issue, la stack, la branche `feat/issue-1-*`.

- [ ] **Step 4 : Vérifier le git log final**

```powershell
git log --oneline -10
```

Résultat attendu : 5 commits de ce plan visibles (structure, gen-deps, gen-context, check-state, agent-template, runbook, CLAUDE.md).

---

## Résumé des fichiers produits

| Fichier | Rôle |
|---|---|
| `.agents/deps.json` | Graphe de dépendances généré depuis GitHub |
| `.agents/agent-prompt-template.md` | Template du prompt injecté dans chaque agent |
| `.agents/orchestrator-runbook.md` | Protocole pas-à-pas pour la session orchestratrice |
| `.agents/status/.gitkeep` | Répertoire des états par agent |
| `.agents/context/.gitkeep` | Répertoire des contextes générés |
| `scripts/gen-deps.ps1` | Génère `deps.json` depuis les labels GitHub |
| `scripts/gen-context.ps1` | Génère le contexte adaptatif pour un agent |
| `scripts/check-state.ps1` | Réconcilie état local vs GitHub |
| `CLAUDE.md` | Mis à jour avec la section orchestration |
