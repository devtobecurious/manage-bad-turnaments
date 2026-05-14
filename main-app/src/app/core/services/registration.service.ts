import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Registration, GameType } from '../models/registration.model';

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

    return collectionData(q, { idField: 'id' }) as Observable<Registration[]>;
  }

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
}
