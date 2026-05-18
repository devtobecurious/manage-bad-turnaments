# Cahier de Recette — manage-bad-turnaments
> Application PWA de gestion de tournois de badminton
> Version testée : main @ a80401a + fixes locaux
> Date : 2026-05-18
> Testé par : Claude (automatique) + Humain (manuel requis)

---

## Légende statuts
- ⬜ `À TESTER` — non encore testé (nécessite action manuelle)
- ✅ `OK` — fonctionne comme attendu
- ❌ `KO` — bug bloquant
- ⚠️ `PARTIEL` — fonctionne partiellement / bug non bloquant

---

## Bugs et correctifs identifiés

| ID | Fichier | Description | Statut |
|----|---------|-------------|--------|
| B1 | `app.html` | Template Angular par défaut ("Hello main-app") affiché au-dessus du router-outlet | ✅ CORRIGÉ |
| B2 | `bracket.component.ts` | Erreur TypeScript `toSignal` incompatible avec Angular 22 (`initialValue: []`) | ✅ CORRIGÉ |
| B3 | `register.component.ts` | Race condition : formulaire affiché avant fin de validation du token (pas de spinner de chargement pendant la vérification) | ✅ CORRIGÉ |
| B4 | `register.component.ts` | `onSubmit()` ne vérifie pas `inviteInvalid()` avant d'appeler `registerPlayer()` | ✅ CORRIGÉ |

---

## PC-01 — Connexion administrateur

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | Aller sur `http://localhost:4200` | Redirection vers `/login` | ✅ OK | Redirection correcte |
| 2 | La page `/login` affiche "Se connecter avec Google" | Bouton visible, titre "Badminton Club" | ✅ OK | Rendu correct |
| 3 | Naviguer vers `/admin` sans être connecté | Redirection vers `/login` (guard actif) | ✅ OK | adminGuard fonctionne |
| 4 | Route inconnue `/foo-bar` | Redirection vers `/login` | ✅ OK | Wildcard `**` fonctionne |
| 5 | Cliquer "Se connecter avec Google" | Popup OAuth Google s'ouvre | ⬜ À TESTER | Nécessite action manuelle |
| 6 | S'authentifier avec compte Google admin | Redirection vers `/admin`, dashboard visible | ⬜ À TESTER | Nécessite compte admin Firebase |
| 7 | Cliquer "Se déconnecter" | Retour sur `/login` | ⬜ À TESTER | |

**Statut global PC-01 :** ⚠️ PARTIEL (routing/guard OK, OAuth à valider manuellement)

---

## PC-02 — Inscription d'un joueur via lien d'invitation

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | Admin génère un lien d'invitation | Lien `/register/:token` généré | ⬜ À TESTER | Nécessite auth admin |
| 2 | Ouvrir `/register/:token` avec un **token valide** | Formulaire d'inscription visible | ⬜ À TESTER | Nécessite vrai token Firebase |
| 3 | Ouvrir `/register/fake-token` | Formulaire s'affiche d'abord, puis message "lien invalide" | ⚠️ PARTIEL | **Bug B3** : le formulaire est affiché ~2s avant le message d'erreur (race condition), car la vérification Firebase est async. Aucun spinner pendant la vérification. |
| 4 | Remplir et soumettre avec token invalide | Message d'erreur, **pas** de création de joueur | ⚠️ PARTIEL | **Bug B4** : `onSubmit()` appelle `registerPlayer()` avant que `inviteInvalid` soit positionné. Résultat final correct (erreur visible) mais potentielle écriture Firestore avant la vérification. |
| 5 | Champ prénom vide → cliquer S'inscrire | Bouton désactivé | ✅ OK | Validation native HTML (`required`) + `:disabled` Angular |
| 6 | Remplir formulaire complet + token valide → soumettre | Profil créé, lien personnel affiché | ⬜ À TESTER | Nécessite vrai token |
| 7 | Vérifier joueur dans `/admin/players` | Joueur visible dans la liste | ⬜ À TESTER | |

**Statut global PC-02 :** ⚠️ PARTIEL (structure OK, bugs B3+B4 à corriger, tests fonctionnels à valider manuellement)

---

## PC-03 — Création et publication d'un tournoi

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | Aller sur `/admin/tournaments/new` | Formulaire création visible | ⬜ À TESTER | Nécessite auth admin |
| 2 | Remplir et soumettre | Tournoi créé, statut "Brouillon" | ⬜ À TESTER | |
| 3 | Configurer les poules `/admin/tournaments/:id/pool-config` | Config sauvegardée | ⬜ À TESTER | |
| 4 | Publier `/admin/tournaments/:id/publish` | Statut → "Inscriptions ouvertes" | ⬜ À TESTER | |

**Statut global PC-03 :** ⬜ À TESTER (nécessite auth admin)

---

## PC-04 — Inscription d'un joueur à un tournoi

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | `/player/:id/tournaments` avec faux ID | "Chargement..." (pas d'erreur JS) | ✅ OK | Rendu sans crash |
| 2 | `/player/:id/tournaments` avec vrai joueur | Liste tournois ouverts visible | ⬜ À TESTER | Nécessite données réelles |
| 3 | S'inscrire à un tournoi | Inscription enregistrée | ⬜ À TESTER | |
| 4 | Se désinscrire | Inscription supprimée | ⬜ À TESTER | |

**Statut global PC-04 :** ⬜ À TESTER

---

## PC-05 — Workflow admin : tirage des poules

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | Clôturer les inscriptions | Statut → "Inscriptions clôturées" | ⬜ À TESTER | Nécessite auth admin + données |
| 2 | Former les paires doubles/mixte | Paires générées aléatoirement | ⬜ À TESTER | |
| 3 | Tirer les poules `/admin/tournaments/:id/pool-draw` | Joueurs répartis | ⬜ À TESTER | |
| 4 | Verrouiller les poules | Statut → "En cours" | ⬜ À TESTER | |
| 5 | Calendrier `/admin/tournaments/:id/pools/:poolId/matches` | N*(N-1)/2 matchs générés | ⬜ À TESTER | |

**Statut global PC-05 :** ⬜ À TESTER

---

## PC-06 — Saisie des scores de poule et classement

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | Saisir score valide : 21-15, 21-18 | Accepté, match "Joué" | ⬜ À TESTER | Nécessite données |
| 2 | Saisir score invalide : 21-20 | Message d'erreur (pas 2 pts d'écart) | ⬜ À TESTER | |
| 3 | Saisir score invalide : 30-28 | Message d'erreur (30 only valid at 30-29) | ⬜ À TESTER | |
| 4 | Tester forfait | 0 pt forfaitaire, adversaire gagne | ⬜ À TESTER | |
| 5 | Classement recalculé automatiquement | Standings à jour après chaque score | ⬜ À TESTER | |

**Statut global PC-06 :** ⬜ À TESTER

---

## PC-07 — Consultation classement de poule (joueur)

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | `/player/p1/tournaments/t1/pools/pool1` avec faux IDs | "Impossible de charger les données de la poule." (pas de crash) | ✅ OK | Gestion d'erreur correcte |
| 2 | Avec vraies données | Tableau rang/V/D/pts + matchs + qualifiés | ⬜ À TESTER | |
| 3 | Mise à jour temps réel | Classement se rafraîchit sans rechargement | ⬜ À TESTER | |

**Statut global PC-07 :** ⚠️ PARTIEL (gestion erreur OK, données réelles à tester)

---

## PC-08 — Génération et progression du tableau final

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | `/admin/tournaments/:id/bracket` | Page bracket visible | ⬜ À TESTER | Nécessite auth + tous matchs poule joués |
| 2 | Générer le bracket | Qualifiés placés, byes attribués | ⬜ À TESTER | |
| 3 | Pas de confrontation intra-poule au T1 | Vérification anti-collision | ⬜ À TESTER | |
| 4 | Saisir scores jusqu'à la finale | Progression correcte, champion mis en évidence | ⬜ À TESTER | |

**Statut global PC-08 :** ⬜ À TESTER

---

## PC-09 — Consultation du tableau final (joueur)

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | `/player/p1/tournaments/t1/bracket` avec faux IDs | "Impossible de charger le tableau final." (pas de crash) | ✅ OK | Gestion d'erreur correcte |
| 2 | Avec vraies données | Bracket complet, scores, "(vous)" surligné | ⬜ À TESTER | |
| 3 | Champion visible en fin de tournoi | Bannière dorée | ⬜ À TESTER | |

**Statut global PC-09 :** ⚠️ PARTIEL (gestion erreur OK, données réelles à tester)

---

## PC-10 — Statistiques personnelles du joueur

| Étape | Action | Résultat attendu | Statut | Remarques |
|-------|--------|-----------------|--------|-----------|
| 1 | `/player/test-player-id` avec faux ID | "Chargement..." (pas de crash) | ✅ OK | |
| 2 | Avec vrai joueur ayant des matchs | Section stats visible en bas du profil | ⬜ À TESTER | |
| 3 | Bilan global + ventilation par type de jeu | Données cohérentes | ⬜ À TESTER | |
| 4 | Historique des tournois avec rang | Liste correcte | ⬜ À TESTER | |

**Statut global PC-10 :** ⚠️ PARTIEL (rendu de base OK, données réelles à tester)

---

## Récapitulatif

| Parcours | Description | Statut auto | Statut manuel |
|----------|-------------|-------------|---------------|
| PC-01 | Connexion administrateur | ✅ Routing/guard OK | ⬜ OAuth à valider |
| PC-02 | Inscription joueur via lien | ⚠️ Bugs B3+B4 | ⬜ Token réel à tester |
| PC-03 | Création et publication d'un tournoi | — | ⬜ |
| PC-04 | Inscription joueur à un tournoi | ⚠️ Route OK | ⬜ |
| PC-05 | Tirage des poules (admin) | — | ⬜ |
| PC-06 | Saisie scores poule + classement | — | ⬜ |
| PC-07 | Consultation classement poule (joueur) | ✅ Erreur OK | ⬜ Données réelles |
| PC-08 | Génération et progression bracket | — | ⬜ |
| PC-09 | Consultation bracket (joueur) | ✅ Erreur OK | ⬜ Données réelles |
| PC-10 | Statistiques personnelles joueur | ✅ Route OK | ⬜ Données réelles |

---

## Bugs corrigés

| ID | Priorité | Fichier | Description | Statut |
|----|----------|---------|-------------|--------|
| B1 | 🔴 | `app.html` | Template Angular par défaut non supprimé | ✅ CORRIGÉ |
| B2 | 🔴 | `bracket.component.ts` | `toSignal` incompatible Angular 22 | ✅ CORRIGÉ |
| B3 | 🟡 | `register.component.ts` | Race condition token : spinner ajouté, formulaire bloqué pendant vérification | ✅ CORRIGÉ |
| B4 | 🔴 | `register.component.ts` | `onSubmit()` n'empêchait pas l'écriture avec un token invalide | ✅ CORRIGÉ |

---

> **Note :** Les PC-03 à PC-08 et les étapes nécessitant une authentification Google réelle ne peuvent pas être testées automatiquement. Ils nécessitent une session admin active dans le navigateur.
