import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { firestoreStream } from '../utils/firestore-stream';
import { Observable } from 'rxjs';
import { Pair } from '../models/pairing.model';
import { GameType } from '../models/registration.model';

@Injectable({
  providedIn: 'root',
})
export class PairingService {
  private readonly firestore = inject(Firestore);

  /**
   * Shuffles an array in-place using the Fisher-Yates algorithm.
   * Returns the same array reference.
   */
  shuffleFisherYates<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Generates random pairs in memory from a list of player IDs.
   * Throws if the number of players is odd (blocking — cannot form complete pairs).
   * AC: Appariement aléatoire 2 par 2 / Alerte et blocage si le nombre d'inscrits est impair.
   */
  generatePairs(tournamentId: string, gameType: GameType, playerIds: string[]): Pair[] {
    if (playerIds.length % 2 !== 0) {
      throw new Error(
        `Nombre impair d'inscrits (${playerIds.length}) pour ${gameType}. Impossible de former des paires complètes.`
      );
    }

    const shuffled = this.shuffleFisherYates([...playerIds]);
    const pairs: Pair[] = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      pairs.push({
        id: '',
        tournamentId,
        gameType,
        player1Id: shuffled[i],
        player2Id: shuffled[i + 1],
        locked: false,
      });
    }

    return pairs;
  }

  /**
   * Returns pairs for a tournament and game type from Firestore as an Observable.
   * AC: Lecture des paires persistées.
   */
  getPairs(tournamentId: string, gameType: GameType): Observable<Pair[]> {
    const pairsRef = collection(this.firestore, 'tournaments', tournamentId, 'pairs');
    const q = query(pairsRef, where('gameType', '==', gameType));
    return firestoreStream(q, 'id') as Observable<Pair[]>;
  }

  /**
   * Saves an array of in-memory pairs to Firestore.
   * Replaces any existing unlocked pairs for this (tournament, gameType).
   * AC: Écriture dans la sous-collection pairs.
   */
  async savePairs(tournamentId: string, gameType: GameType, pairs: Pair[]): Promise<void> {
    // Delete existing unlocked pairs for this gameType
    await this.resetPairs(tournamentId, gameType);

    const pairsRef = collection(this.firestore, 'tournaments', tournamentId, 'pairs');
    for (const pair of pairs) {
      await addDoc(pairsRef, {
        tournamentId: pair.tournamentId,
        gameType: pair.gameType,
        player1Id: pair.player1Id,
        player2Id: pair.player2Id,
        locked: false,
      });
    }
  }

  /**
   * Locks all pairs for a (tournament, gameType), making them non-modifiable.
   * AC: Une fois validées, les paires sont figées.
   */
  async lockPairs(tournamentId: string, gameType: GameType): Promise<void> {
    const pairsRef = collection(this.firestore, 'tournaments', tournamentId, 'pairs');
    const q = query(pairsRef, where('gameType', '==', gameType));
    const snapshot = await getDocs(q);

    const batch = writeBatch(this.firestore);
    for (const docSnap of snapshot.docs) {
      batch.update(doc(this.firestore, 'tournaments', tournamentId, 'pairs', docSnap.id), {
        locked: true,
      });
    }
    await batch.commit();
  }

  /**
   * Deletes all unlocked pairs for a (tournament, gameType).
   * AC: L'admin peut relancer le tirage aléatoire avant de valider.
   */
  async resetPairs(tournamentId: string, gameType: GameType): Promise<void> {
    const pairsRef = collection(this.firestore, 'tournaments', tournamentId, 'pairs');
    const q = query(pairsRef, where('gameType', '==', gameType), where('locked', '==', false));
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(this.firestore, 'tournaments', tournamentId, 'pairs', docSnap.id));
    }
  }

  /**
   * Updates the two players of a specific pair (manual swap/edit).
   * Throws if the pair is locked.
   * AC: L'admin peut modifier manuellement une paire avant de valider.
   */
  async updatePair(
    tournamentId: string,
    pairId: string,
    player1Id: string,
    player2Id: string,
    locked: boolean
  ): Promise<void> {
    if (locked) {
      throw new Error('Cette paire est verrouillée et ne peut pas être modifiée.');
    }
    const pairRef = doc(this.firestore, 'tournaments', tournamentId, 'pairs', pairId);
    await updateDoc(pairRef, { player1Id, player2Id });
  }
}
