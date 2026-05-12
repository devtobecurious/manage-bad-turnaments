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

## Coordination multi-agents
Fichiers de statut dans `.agents/status/` (à la racine du repo) :
- `issue-N.json` → `{ "status": "done"|"failed"|"in-progress", "branch": "feat/issue-N-…" }`
- Un agent dépendant poll ce fichier toutes les 60 s avant de démarrer
- Si `status: "failed"` → l'agent s'arrête et notifie l'utilisateur

## Règles
- Chaque issue = une branche = un worktree isolé
- Tests Vitest obligatoires pour chaque service créé (fichier `.spec.ts`)
- Firebase config : ne jamais committer les vraies clés — utiliser `environment.ts` en `.gitignore`
