import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  getDocs,
  writeBatch,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import {
  Match,
  SetScore,
  generateRoundRobinPairs,
  validateMatch,
  determineMatchWinner,
} from '../models/match.model';
import { PoolService } from './pool.service';
import { PlayerService } from './player.service';

@Injectable({
  providedIn: 'root',
})
export class MatchService {
  private readonly firestore = inject(Firestore);
  private readonly poolService = inject(PoolService);
  private readonly playerService = inject(PlayerService);

  /**
   * Returns the Firestore subcollection reference for matches of a pool.
   */
  private matchesRef(tournamentId: string, poolId: string) {
    return collection(this.firestore, 'tournaments', tournamentId, 'pools', poolId, 'matches');
  }

  /**
   * Generates round-robin matches for a pool and writes them to Firestore.
   * Deletes existing matches for the pool before writing new ones.
   *
   * For singles game types, each memberIds entry is a player ID.
   * For doubles game types, memberIds are grouped pairwise: [p1A, p1B, p2A, p2B, ...]
   * and each pair is treated as one participant.
   *
   * N*(N-1)/2 matches are generated for N participants.
   */
  async generateMatches(tournamentId: string, poolId: string): Promise<void> {
    // Load pool data
    const poolRef = collection(this.firestore, 'tournaments', tournamentId, 'pools');
    const poolDoc = await getDocs(
      collection(this.firestore, 'tournaments', tournamentId, 'pools')
    );
    const poolSnap = poolDoc.docs.find((d) => d.id === poolId);
    if (!poolSnap) {
      throw new Error(`Pool ${poolId} not found in tournament ${tournamentId}`);
    }

    const pool = { id: poolSnap.id, ...poolSnap.data() } as {
      id: string;
      tournamentId: string;
      gameType: string;
      memberIds: string[];
    };

    const isDoubles = pool.gameType.startsWith('double-');

    // Build participant list: for doubles, group pairwise
    let participantIds: string[];
    if (isDoubles) {
      // Group pairs: [p1A, p1B, p2A, p2B] → ['p1A+p1B', 'p2A+p2B']
      // We use '+' separator for the composite ID
      participantIds = [];
      for (let i = 0; i + 1 < pool.memberIds.length; i += 2) {
        participantIds.push(`${pool.memberIds[i]}+${pool.memberIds[i + 1]}`);
      }
    } else {
      participantIds = [...pool.memberIds];
    }

    // Resolve participant names
    const participantNames: Record<string, string> = {};
    if (isDoubles) {
      for (const compositeId of participantIds) {
        const [idA, idB] = compositeId.split('+');
        const [playerA, playerB] = await Promise.all([
          this.playerService.getPlayer(idA),
          this.playerService.getPlayer(idB),
        ]);
        const nameA = playerA ? `${playerA.lastName} ${playerA.firstName}` : idA;
        const nameB = playerB ? `${playerB.lastName} ${playerB.firstName}` : idB;
        participantNames[compositeId] = `${nameA} / ${nameB}`;
      }
    } else {
      for (const playerId of participantIds) {
        const player = await this.playerService.getPlayer(playerId);
        participantNames[playerId] = player
          ? `${player.lastName} ${player.firstName}`
          : playerId;
      }
    }

    // Generate round-robin pairs
    const pairs = generateRoundRobinPairs(participantIds);

    // Delete existing matches
    const matchesRef = this.matchesRef(tournamentId, poolId);
    const existingSnap = await getDocs(matchesRef);
    const batch = writeBatch(this.firestore);
    existingSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    // Write new matches
    for (const [idA, idB] of pairs) {
      await addDoc(matchesRef, {
        tournamentId,
        poolId,
        gameType: pool.gameType,
        participantA: { id: idA, name: participantNames[idA] },
        participantB: { id: idB, name: participantNames[idB] },
        status: 'pending',
      });
    }
  }

  /**
   * Returns a real-time observable of matches for a given pool.
   */
  getMatchesForPool(tournamentId: string, poolId: string): Observable<Match[]> {
    return collectionData(this.matchesRef(tournamentId, poolId), {
      idField: 'id',
    }) as Observable<Match[]>;
  }

  /**
   * Updates the score of a match in Firestore.
   * Validates the sets against badminton rules, determines the winner,
   * sets status to 'played', and persists the result.
   *
   * @param tournamentId - Tournament ID
   * @param poolId - Pool ID
   * @param matchId - Match document ID
   * @param sets - Array of set scores (up to 3 sets, best of 3)
   * @param forfeitParticipantId - Optional: ID of the forfeiting participant
   */
  async updateMatchScore(
    tournamentId: string,
    poolId: string,
    matchId: string,
    sets: SetScore[],
    forfeitParticipantId?: string
  ): Promise<void> {
    // Load the match to get participant IDs
    const matchesRef = this.matchesRef(tournamentId, poolId);
    const matchesSnap = await getDocs(matchesRef);
    const matchDoc = matchesSnap.docs.find((d) => d.id === matchId);

    if (!matchDoc) {
      throw new Error(`Match ${matchId} not found in pool ${poolId}`);
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

    // Validate the match result
    const validation = validateMatch(sets, forfeitParticipantId);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Score invalide.');
    }

    // Determine the winner
    const winnerId = determineMatchWinner(
      sets,
      match.participantA.id,
      match.participantB.id,
      forfeitParticipantId
    );

    if (!winnerId) {
      throw new Error('Impossible de déterminer le gagnant.');
    }

    // Build the update payload
    const update: Partial<Match> & Record<string, unknown> = {
      status: 'played',
      sets,
      winnerId,
    };

    if (forfeitParticipantId) {
      update['forfeitParticipantId'] = forfeitParticipantId;
    }

    // Write to Firestore
    const matchDocRef = doc(this.firestore, 'tournaments', tournamentId, 'pools', poolId, 'matches', matchId);
    await updateDoc(matchDocRef, update);
  }
}
