/**
 * Standings for a single participant in a pool.
 *
 * Points rule: Victory = 2 pts | Defeat = 1 pt | Forfeit (forfeiting side) = 0 pt
 * The opponent of a forfeiting player receives a Victory (2 pts).
 *
 * Tiebreaker order:
 *   1. Head-to-head record (mini-league among tied players)
 *   2. Set difference (setsWon - setsLost) across all played matches
 *   3. Point difference (pointsScored - pointsConceded) across all played matches
 */
export interface PoolStanding {
  /** Participant ID — composite string for doubles (e.g. "p1+p2") */
  participantId: string;
  /** Display name */
  name: string;
  /** 1-based ranking within the pool */
  rank: number;
  /** Number of matches played (excludes matches where this participant forfeited) */
  matchesPlayed: number;
  /** Number of victories */
  victories: number;
  /** Number of defeats */
  defeats: number;
  /** Total sets won */
  setsWon: number;
  /** Total sets lost */
  setsLost: number;
  /** Total points scored across all sets */
  pointsScored: number;
  /** Total points conceded across all sets */
  pointsConceded: number;
  /** Total ranking points (V=2, D=1, F=0) */
  totalPoints: number;
  /**
   * Whether this participant occupies a qualifying spot.
   * Determined externally based on pool qualifyingSpots config.
   * Defaults to false; set by the consumer layer when qualifyingSpots is known.
   */
  qualified: boolean;
}

/**
 * Full standings for a pool: ordered list of PoolStanding.
 */
export type PoolStandings = PoolStanding[];
