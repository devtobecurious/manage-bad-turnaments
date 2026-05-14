export type GameType = 'simple-homme' | 'simple-femme' | 'double-homme' | 'double-femme' | 'double-mixte';

export type TournamentStatus = 'draft' | 'open' | 'in-progress' | 'completed' | 'cancelled';

/**
 * Pool configuration for a single game type.
 * qualifiersPerPool === 0 and poolCount === 1 → no final phase generated.
 */
export interface PoolConfig {
  gameType: GameType;
  poolCount: number;
  /** Number of qualified players/pairs per pool: 0, 1, or 2 */
  qualifiersPerPool: 0 | 1 | 2;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  status: TournamentStatus;
  gameTypes: GameType[];
  /** Independent pool configuration for each game type */
  poolConfig: PoolConfig[];
  createdAt: string;
  createdBy: string;
}
