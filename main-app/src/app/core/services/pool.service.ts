import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { firestoreStream } from '../utils/firestore-stream';
import { Observable } from 'rxjs';
import { Pool, isDoubleGameType, maxPerPool } from '../models/pool.model';
import { GameType } from '../models/registration.model';

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 * Accepts a custom random-number generator for testability.
 */
export function fisherYatesShuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Distributes participants equitably across poolCount pools.
 * Participants are shuffled first (Fisher-Yates).
 * Throws if the pool count would exceed the max-per-pool constraint.
 */
export function distributeIntoPools(
  participants: string[],
  poolCount: number,
  gameType: GameType,
  rng: () => number = Math.random
): string[][] {
  const max = maxPerPool(gameType);

  if (participants.length > poolCount * max) {
    throw new Error(
      `Impossible de répartir ${participants.length} participants en ${poolCount} poules ` +
        `(max ${max} par poule pour ${gameType}).`
    );
  }

  if (poolCount <= 0) {
    throw new Error('Le nombre de poules doit être supérieur à 0.');
  }

  const shuffled = fisherYatesShuffle(participants, rng);
  const pools: string[][] = Array.from({ length: poolCount }, () => []);

  shuffled.forEach((participant, index) => {
    pools[index % poolCount].push(participant);
  });

  return pools;
}

@Injectable({
  providedIn: 'root',
})
export class PoolService {
  private readonly firestore = inject(Firestore);

  /**
   * Returns the Firestore subcollection reference for pools of a tournament.
   */
  private poolsRef(tournamentId: string) {
    return collection(this.firestore, 'tournaments', tournamentId, 'pools');
  }

  /**
   * Generates pool assignments in memory for a given game type.
   * Does NOT write to Firestore — call savePools() to persist.
   *
   * @param tournamentId - the tournament ID
   * @param gameType - the game type to generate pools for
   * @param poolCount - the number of pools to distribute participants into
   * @param participantIds - array of player IDs registered for this game type
   * @param rng - optional custom RNG (for testing)
   * @returns array of Pool objects (not yet persisted, id is empty string)
   */
  generatePools(
    tournamentId: string,
    gameType: GameType,
    poolCount: number,
    participantIds: string[],
    rng: () => number = Math.random
  ): Pool[] {
    const distribution = distributeIntoPools(participantIds, poolCount, gameType, rng);

    return distribution.map((memberIds, index) => ({
      id: '',
      tournamentId,
      gameType,
      poolNumber: index + 1,
      memberIds,
      locked: false,
    }));
  }

  /**
   * Persists generated pools to Firestore.
   * Existing pools for the same (tournamentId, gameType) are deleted first.
   */
  async savePools(pools: Pool[]): Promise<Pool[]> {
    if (pools.length === 0) return [];

    const { tournamentId, gameType } = pools[0];

    // Delete existing pools for this (tournament, gameType) before writing new ones
    const existingQuery = query(
      this.poolsRef(tournamentId),
      where('gameType', '==', gameType)
    );
    const existingSnap = await getDocs(existingQuery);

    const batch = writeBatch(this.firestore);
    existingSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    // Write new pools
    const saved: Pool[] = [];
    for (const pool of pools) {
      const docRef = await addDoc(this.poolsRef(tournamentId), {
        tournamentId: pool.tournamentId,
        gameType: pool.gameType,
        poolNumber: pool.poolNumber,
        memberIds: pool.memberIds,
        locked: pool.locked,
      });
      saved.push({ ...pool, id: docRef.id });
    }

    return saved;
  }

  /**
   * Locks all pools for a given (tournamentId, gameType) and transitions the tournament
   * to 'En cours' if all configured game types are now locked.
   */
  async lockPools(tournamentId: string, gameType: GameType): Promise<void> {
    // Lock all pools for this game type
    const poolsQuery = query(
      this.poolsRef(tournamentId),
      where('gameType', '==', gameType)
    );
    const poolsSnap = await getDocs(poolsQuery);

    const batch = writeBatch(this.firestore);
    poolsSnap.docs.forEach((d) => batch.update(d.ref, { locked: true }));
    await batch.commit();

    // Check if all game types for this tournament are locked
    await this.checkAndStartTournament(tournamentId);
  }

  /**
   * Checks if all configured game types have locked pools and transitions the tournament
   * to 'En cours' if so.
   */
  private async checkAndStartTournament(tournamentId: string): Promise<void> {
    const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);

    if (!tournamentSnap.exists()) return;

    const tournamentData = tournamentSnap.data() as {
      poolConfig?: { gameType: GameType; poolCount: number }[];
      status: string;
    };

    const configuredGameTypes = (tournamentData.poolConfig ?? []).map((c) => c.gameType);
    if (configuredGameTypes.length === 0) return;

    // Check each configured game type has at least one locked pool
    for (const gt of configuredGameTypes) {
      const poolsQuery = query(
        this.poolsRef(tournamentId),
        where('gameType', '==', gt),
        where('locked', '==', true)
      );
      const snap = await getDocs(poolsQuery);
      if (snap.empty) return; // This game type has no locked pools yet
    }

    // All game types have locked pools — transition to 'En cours'
    await updateDoc(tournamentRef, { status: 'En cours' });
  }

  /**
   * Returns pools for a tournament, optionally filtered by game type.
   */
  getPools(tournamentId: string, gameType?: GameType): Observable<Pool[]> {
    const poolsRef = this.poolsRef(tournamentId);
    const q = gameType
      ? query(poolsRef, where('gameType', '==', gameType))
      : poolsRef;

    return firestoreStream(q, 'id') as Observable<Pool[]>;
  }

  /**
   * Returns all pools for a given player across all game types in a tournament.
   */
  getPoolsForPlayer(tournamentId: string, playerId: string): Observable<Pool[]> {
    const poolsRef = this.poolsRef(tournamentId);
    const q = query(poolsRef, where('memberIds', 'array-contains', playerId));
    return firestoreStream(q, 'id') as Observable<Pool[]>;
  }
}
