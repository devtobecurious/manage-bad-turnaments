import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc } from '@angular/fire/firestore';
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

  async registerPlayer(data: RegisterPlayerData): Promise<Player> {
    const playersRef = collection(this.firestore, 'players');
    const now = new Date().toISOString();

    const docRef = await addDoc(playersRef, {
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      createdAt: now,
    });

    return {
      id: docRef.id,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      createdAt: now,
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
