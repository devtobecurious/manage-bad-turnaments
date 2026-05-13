# manage-bad-turnaments

Application PWA de gestion de tournois internes de badminton pour une association.

## Stack
- **Framework** : Angular 22-next (standalone components, signals)
- **Tests** : Vitest via `@angular/build:unit-test` — commande : `cd main-app && ng test`
- **Styles** : Tailwind CSS v4
- **Backend** : Firebase uniquement (pas de serveur)
  - Firestore — base de données
  - Firebase Auth — OAuth Google uniquement
  - Firebase Hosting — déploiement PWA

## Structure du projet
```
main-app/          ← application Angular
  src/app/
    core/          ← services partagés, guards, modèles
    features/      ← un dossier par epic (auth, players, tournaments…)
  src/environments/
    environment.ts         ← config Firebase (fournie par l'utilisateur)
    environment.prod.ts
```

## Services Angular (logique métier, pas de Cloud Functions)
`AuthService` · `PlayerService` · `InviteService` · `TournamentService`
`RegistrationService` · `PairingService` · `PoolService` · `MatchService`
`StandingsService` · `BracketService` · `StatsService`

## Git
- Remote : `https://github.com/devtobecurious/manage-bad-turnaments`
- Branche par issue : `feat/issue-N-slug`
- Merge direct sur `main` dès que les tests Vitest passent

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

## Règles
- Chaque issue = une branche = un worktree isolé
- Tests Vitest obligatoires pour chaque service créé (fichier `.spec.ts`)
- Firebase config : ne jamais committer les vraies clés — utiliser `environment.ts` en `.gitignore`
