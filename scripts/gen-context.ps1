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

# Construire le slug de branche depuis le titre
$slug = ($title -replace '^\[US-\d+\]\s*', '' `
               -replace '[^a-zA-Z0-9\s]', '' `
               -replace '\s+', '-' `
               -replace '-+', '-').ToLower().Trim('-')
$slug = $slug.Substring(0, [Math]::Min(40, $slug.Length))
$branch = "feat/issue-$IssueNumber-$slug"
$worktree = "D:/Works/Projects/Persos/manage-bad-turnaments-worktrees/issue-$IssueNumber"

# Grep des services Angular existants
$servicesDir = "main-app/src/app/core/services"
$existingServices = @()
if (Test-Path $servicesDir) {
    $existingServices = @(Get-ChildItem $servicesDir -Filter "*.service.ts" -Recurse |
        ForEach-Object { "- $($_.Name) : $($_.FullName.Replace((Get-Location).Path + '\', '').Replace('\','/'))" })
}

# Grep des modèles/interfaces existants
$modelsDir = "main-app/src/app/core/models"
$existingModels = @()
if (Test-Path $modelsDir) {
    $existingModels = @(Get-ChildItem $modelsDir -Filter "*.ts" -Recurse |
        ForEach-Object { "- $($_.Name) : $($_.FullName.Replace((Get-Location).Path + '\', '').Replace('\','/'))" })
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
