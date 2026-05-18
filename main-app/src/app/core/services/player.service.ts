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
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { firestoreStream } from '../utils/firestore-stream';
import { Player, Gender } from '../models/player.model';

export interface RegisterPlayerData {
  firstName: string;
  lastName: string;
  gender: Gender;
}

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private readonly firestore = inject(Firestore);

  getPlayers(): Observable<Player[]> {
    const playersRef = collection(this.firestore, 'players');
    const q = query(playersRef, orderBy('lastName', 'asc'));
    return firestoreStream(q, 'id') as Observable<Player[]>;
  }

  async deactivatePlayer(playerId: string): Promise<void> {
    const playerRef = doc(this.firestore, 'players', playerId);
    await updateDoc(playerRef, { active: false });
  }

  async registerPlayer(data: RegisterPlayerData): Promise<Player> {
    const playersRef = collection(this.firestore, 'players');
    const now = new Date().toISOString();

    const docRef = await addDoc(playersRef, {
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      createdAt: now,
      active: true,
    });

    return {
      id: docRef.id,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      createdAt: now,
      active: true,
    };
  }

  async getPlayer(id: string): Promise<Player | null> {
    const playerRef = doc(this.firestore, 'players', id);
    const snapshot = await getDoc(playerRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Omit<Player, 'id'>;
    return { id: snapshot.id, ...data };
  }
}
