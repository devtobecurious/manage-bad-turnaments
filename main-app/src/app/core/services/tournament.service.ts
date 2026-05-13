import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  getDoc,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Tournament, GameType } from '../models/tournament.model';

export interface CreateTournamentData {
  name: string;
  date: string;
  description?: string;
  gameTypes: GameType[];
}

@Injectable({
  providedIn: 'root',
})
export class TournamentService {
  private readonly firestore = inject(Firestore);

  getTournaments(): Observable<Tournament[]> {
    const tournamentsRef = collection(this.firestore, 'tournaments');
    const q = query(tournamentsRef, orderBy('date', 'asc'));
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
      ...(data.description !== undefined ? { description: data.description } : {}),
      gameTypes: data.gameTypes,
      status: 'Brouillon',
      createdAt: now,
    });

    return {
      id: docRef.id,
      name: data.name,
      date: data.date,
      ...(data.description !== undefined ? { description: data.description } : {}),
      gameTypes: data.gameTypes,
      status: 'Brouillon',
      createdAt: now,
    };
  }
}
