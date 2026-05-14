import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionGroup,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collectionData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Registration, GameType } from '../models/registration.model';
import { Tournament } from '../models/tournament.model';

@Injectable({
  providedIn: 'root',
})
export class RegistrationService {
  private readonly firestore = inject(Firestore);

  /**
   * Returns all tournaments with status 'Inscriptions ouvertes'.
   */
  getOpenTournaments(): Observable<Tournament[]> {
    const tournamentsRef = collection(this.firestore, 'tournaments');
    const q = query(tournamentsRef, where('status', '==', 'Inscriptions ouvertes'));
    return collectionData(q, { idField: 'id' }) as Observable<Tournament[]>;
  }

  /**
   * Registers a player for a tournament with the specified game type.
   * Throws if the tournament is not open for registrations.
   * Throws if the player is already registered for the same (tournament, gameType).
   */
  async registerForTournament(
    tournamentId: string,
    playerId: string,
    gameType: GameType
  ): Promise<Registration> {
    // Guard: tournament must be open
    const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists() || tournamentSnap.data()['status'] !== 'Inscriptions ouvertes') {
      throw new Error("Le tournoi n'est pas ouvert aux inscriptions.");
    }

    // Guard: idempotency — no duplicate (tournamentId, playerId, gameType)
    const registrationsRef = collection(
      this.firestore,
      'tournaments',
      tournamentId,
      'registrations'
    );
    const existingQuery = query(
      registrationsRef,
      where('playerId', '==', playerId),
      where('gameType', '==', gameType)
    );
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty) {
      throw new Error('Le joueur est déjà inscrit pour ce type de jeu dans ce tournoi.');
    }

    const now = new Date().toISOString();
    const docRef = await addDoc(registrationsRef, {
      tournamentId,
      playerId,
      gameType,
      registeredAt: now,
    });

    return {
      id: docRef.id,
      tournamentId,
      playerId,
      gameType,
      registeredAt: now,
    };
  }

  /**
   * Unregisters a player from a tournament.
   * Throws if the tournament is no longer open for registrations.
   */
  async unregisterFromTournament(tournamentId: string, registrationId: string): Promise<void> {
    // Guard: tournament must still be open
    const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists() || tournamentSnap.data()['status'] !== 'Inscriptions ouvertes') {
      throw new Error("La désinscription n'est plus possible : les inscriptions sont fermées.");
    }

    const registrationRef = doc(
      this.firestore,
      'tournaments',
      tournamentId,
      'registrations',
      registrationId
    );
    await deleteDoc(registrationRef);
  }

  /**
   * Returns all registrations for a given player (across all tournaments).
   */
  getPlayerRegistrations(playerId: string): Observable<Registration[]> {
    const registrationsGroup = collectionGroup(this.firestore, 'registrations');
    const q = query(registrationsGroup, where('playerId', '==', playerId));
    return collectionData(q, { idField: 'id' }) as Observable<Registration[]>;
  }
}
