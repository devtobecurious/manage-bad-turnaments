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

# Construire le graphe de dépendances (minimal chain)
# Stratégie : chaque issue dépend uniquement de la DERNIÈRE issue de chaque épic parent.
# Les issues d'un même épic sont indépendantes entre elles → parallélisme maximal au sein d'un épic.
$dependencies = [ordered]@{}
foreach ($issue in ($rawIssues | Sort-Object number)) {
    $epicLabel = ($issue.labels | Where-Object { $_.name -like "epic:*" } | Select-Object -First 1).name
    if (-not $epicLabel) { continue }

    $key = "issue-$($issue.number)"
    $deps = @()

    $parentEpics = $epicOrder[$epicLabel]
    if ($parentEpics) {
        foreach ($parentEpic in $parentEpics) {
            if ($epicToIssues.ContainsKey($parentEpic)) {
                # Seulement la dernière issue du parent (numéro max)
                $lastParentIssue = ($epicToIssues[$parentEpic] | Sort-Object | Select-Object -Last 1)
                $deps += "issue-$lastParentIssue"
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
