import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  collectionData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Tournament, TournamentStatus } from '../models/tournament.model';

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
    const q = query(tournamentsRef, orderBy('createdAt', 'desc'));
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
      status: 'Brouillon' as TournamentStatus,
      participationToken: null,
      createdBy: data.createdBy,
      createdAt: now,
    });

    return {
      id: docRef.id,
      name: data.name,
      date: data.date,
      status: 'Brouillon',
      participationToken: null,
      createdBy: data.createdBy,
      createdAt: now,
    };
  }

  /**
   * Publishes a tournament: sets status to 'Inscriptions ouvertes' and generates a unique participation token.
   * AC: Passage Brouillon → Inscriptions ouvertes + génération lien unique de participation
   */
  async publishTournament(tournamentId: string): Promise<string> {
    const participationToken = crypto.randomUUID();
    const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);

    await updateDoc(tournamentRef, {
      status: 'Inscriptions ouvertes' as TournamentStatus,
      participationToken,
    });

    return participationToken;
  }
}
