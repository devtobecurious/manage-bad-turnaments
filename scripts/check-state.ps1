# scripts/check-state.ps1
# Réconcilie l'état local (.agents/status/*.json) avec GitHub (branches + PRs).
# Retourne un tableau JSON des états réconciliés pour toutes les issues.
# Usage : .\scripts\check-state.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Charger deps.json pour connaître la liste des issues
$deps = Get-Content ".agents/deps.json" | ConvertFrom-Json
$allIssueKeys = $deps.dependencies.PSObject.Properties.Name

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
        try {
            $localState = Get-Content $statusFile -Raw | ConvertFrom-Json
        } catch {
            $localState = $null
        }
    }

    # Chercher une PR mergée pour cette issue
    $mergedPR = $mergedPRs | Where-Object { $_.headRefName -like "*issue-$issueNum-*" -or $_.headRefName -like "*issue-$issueNum" } | Select-Object -First 1
    # Chercher une PR ouverte
    $openPR   = $openPRs   | Where-Object { $_.headRefName -like "*issue-$issueNum-*" -or $_.headRefName -like "*issue-$issueNum" } | Select-Object -First 1
    # Chercher une branche distante
    $remoteBranch = $remoteBranches | Where-Object { $_ -like "*issue-$issueNum-*" -or $_ -like "*issue-$issueNum" } | Select-Object -First 1

    # Lire les champs locaux de façon sécurisée (PS 5.1 compatible)
    $localStatus = if ($localState -and $localState.PSObject.Properties['status']) { $localState.status } else { $null }
    $localStep   = if ($localState -and $localState.PSObject.Properties['step'])   { $localState.step }   else { $null }
    $localBranch = if ($localState -and $localState.PSObject.Properties['branch']) { $localState.branch } else { $null }
    $localPr     = if ($localState -and $localState.PSObject.Properties['pr'])     { $localState.pr }     else { $null }

    # Réconcilier
    $reconciledStatus = "pending"
    $reconciledStep   = "pending"
    $prNumber         = $null
    $branch           = $localBranch

    if ($mergedPR) {
        $reconciledStatus = "done"
        $reconciledStep   = "merged"
        $prNumber         = $mergedPR.number
        $branch           = $mergedPR.headRefName
    } elseif ($localStep -eq "merged") {
        # Fichier local dit merged mais pas de PR mergée → incohérence, on remet en pr-open
        $reconciledStatus = "in-progress"
        $reconciledStep   = "pr-open"
        $prNumber         = $localPr
    } elseif ($openPR) {
        $reconciledStatus = "in-progress"
        $reconciledStep   = if ($localStep -eq "review-ok") { "review-ok" } else { "pr-open" }
        $prNumber         = $openPR.number
        $branch           = $openPR.headRefName
    } elseif ($localStatus -eq "failed") {
        $reconciledStatus = "failed"
        $reconciledStep   = "failed"
    } elseif ($remoteBranch) {
        $reconciledStatus = "in-progress"
        $reconciledStep   = "coding"
        $branch           = $remoteBranch
    } elseif ($localStatus -eq "in-progress") {
        # Fichier local dit in-progress mais aucune branche → relancer depuis zéro
        $reconciledStatus = "in-progress"
        $reconciledStep   = "pending"
    }

    $isStale = ($null -ne $localState -and $localStep -ne $reconciledStep)

    $result = [ordered]@{
        issue    = $issueNum
        key      = $key
        status   = $reconciledStatus
        step     = $reconciledStep
        branch   = $branch
        pr       = $prNumber
        stale    = $isStale
    }
    $results += $result

    # Mettre à jour le fichier local si incohérent
    if ($isStale -and $reconciledStatus -ne "pending") {
        $now = (Get-Date -Format "o")
        $updated = [ordered]@{
            issue     = $issueNum
            status    = $reconciledStatus
            step      = $reconciledStep
            branch    = $branch
            pr        = $prNumber
            startedAt = if ($localState -and $localState.PSObject.Properties['startedAt']) { $localState.startedAt } else { $now }
            updatedAt = $now
            error     = if ($localState -and $localState.PSObject.Properties['error']) { $localState.error } else { $null }
        }
        $updated | ConvertTo-Json | Set-Content $statusFile -Encoding utf8
        Write-Host "  [reconciled] issue-$issueNum : $reconciledStatus/$reconciledStep" -ForegroundColor Yellow
    }
}

$results | ConvertTo-Json -Depth 3
