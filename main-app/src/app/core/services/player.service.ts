import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Player } from '../models/player.model';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private readonly firestore = inject(Firestore);

  getPlayers(): Observable<Player[]> {
    const playersRef = collection(this.firestore, 'players');
    const q = query(playersRef, orderBy('lastName', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Player[]>;
  }

  async deactivatePlayer(playerId: string): Promise<void> {
    const playerRef = doc(this.firestore, 'players', playerId);
    await updateDoc(playerRef, { active: false });
  }
}
