import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionGroup,
  addDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { firestoreStream } from '../utils/firestore-stream';
import { Observable } from 'rxjs';
import { Registration, GameType } from '../models/registration.model';
import { Tournament } from '../models/tournament.model';

export interface AddRegistrationData {
  tournamentId: string;
  playerId: string;
  gameType: GameType;
}

@Injectable({
  providedIn: 'root',
})
export class RegistrationService {
  private readonly firestore = inject(Firestore);

  /**
   * Returns all tournaments with status 'Inscriptions ouvertes'.
   * US-008: Player sees open tournaments.
   */
  getOpenTournaments(): Observable<Tournament[]> {
    const tournamentsRef = collection(this.firestore, 'tournaments');
    const q = query(tournamentsRef, where('status', '==', 'Inscriptions ouvertes'));
    return firestoreStream(q, 'id') as Observable<Tournament[]>;
  }

  /**
   * Returns registrations for a tournament, optionally filtered by game type.
   * US-009 (admin): view registrations by game type.
   */
  getRegistrations(tournamentId: string, gameType?: GameType): Observable<Registration[]> {
    const registrationsRef = collection(
      this.firestore,
      'tournaments',
      tournamentId,
      'registrations'
    );

    const q = gameType
      ? query(registrationsRef, where('gameType', '==', gameType), orderBy('registeredAt', 'asc'))
      : query(registrationsRef, orderBy('registeredAt', 'asc'));

    return firestoreStream(q, 'id') as Observable<Registration[]>;
  }

  /**
   * Registers a player for a tournament with the specified game type.
   * Throws if the tournament is not open for registrations.
   * Throws if the player is already registered for the same (tournament, gameType).
   * US-008: Player registration.
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
   * Adds a registration manually (admin use case).
   * US-009: Admin adds a player to a game type.
   */
  async addRegistration(data: AddRegistrationData): Promise<Registration> {
    const registrationsRef = collection(
      this.firestore,
      'tournaments',
      data.tournamentId,
      'registrations'
    );
    const now = new Date().toISOString();

    const docRef = await addDoc(registrationsRef, {
      tournamentId: data.tournamentId,
      playerId: data.playerId,
      gameType: data.gameType,
      registeredAt: now,
    });

    return {
      id: docRef.id,
      tournamentId: data.tournamentId,
      playerId: data.playerId,
      gameType: data.gameType,
      registeredAt: now,
    };
  }

  /**
   * Unregisters a player from a tournament.
   * Throws if the tournament is no longer open for registrations.
   * US-008: Player unregistration.
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
   * Removes a registration (admin use case, no status guard).
   * US-009: Admin removes a player from a game type.
   */
  async removeRegistration(tournamentId: string, registrationId: string): Promise<void> {
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
   * US-008: Player sees their own registrations.
   */
  getPlayerRegistrations(playerId: string): Observable<Registration[]> {
    const registrationsGroup = collectionGroup(this.firestore, 'registrations');
    const q = query(registrationsGroup, where('playerId', '==', playerId));
    return firestoreStream(q, 'id') as Observable<Registration[]>;
  }
}
