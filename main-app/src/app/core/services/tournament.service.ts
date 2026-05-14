import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Tournament, PoolConfig } from '../models/tournament.model';

export interface CreateTournamentData {
  name: string;
  date: string;
  createdBy: string;
}

@Injectable({
  providedIn: 'root',
})
export class TournamentService {
  private readonly firestore = inject(Firestore);

  getTournaments(): Observable<Tournament[]> {
    const tournamentsRef = collection(this.firestore, 'tournaments');
    const q = query(tournamentsRef, orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Tournament[]>;
  }

  async getTournament(id: string): Promise<Tournament | null> {
    const tournamentRef = doc(this.firestore, 'tournaments', id);
    const snapshot = await getDoc(tournamentRef);
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data() as Omit<Tournament, 'id'>;
    return { id: snapshot.id, ...data };
  }

  async createTournament(data: CreateTournamentData): Promise<Tournament> {
    const tournamentsRef = collection(this.firestore, 'tournaments');
    const now = new Date().toISOString();

    const docRef = await addDoc(tournamentsRef, {
      name: data.name,
      date: data.date,
      status: 'draft',
      gameTypes: [],
      poolConfig: [],
      createdAt: now,
      createdBy: data.createdBy,
    });

    return {
      id: docRef.id,
      name: data.name,
      date: data.date,
      status: 'draft',
      gameTypes: [],
      poolConfig: [],
      createdAt: now,
      createdBy: data.createdBy,
    };
  }

  /**
   * Updates the pool configuration for a tournament.
   * Each PoolConfig entry is independent for a given game type.
   * If poolCount === 1 and qualifiersPerPool === 0, no final phase should be generated.
   */
  async updatePoolConfig(tournamentId: string, configs: PoolConfig[]): Promise<void> {
    const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);
    await updateDoc(tournamentRef, { poolConfig: configs });
  }
}
