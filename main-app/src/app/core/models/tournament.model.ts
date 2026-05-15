export type GameType =
  | 'simple-homme'
  | 'simple-femme'
  | 'double-homme'
  | 'double-femme'
  | 'mixte';

export type TournamentStatus =
  | 'Brouillon'
  | 'Inscriptions ouvertes'
  | 'Inscriptions clôturées'
  | 'En cours'
  | 'Terminé';

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
  description?: string;
  gameTypes?: GameType[];
  status: TournamentStatus;
  participationToken: string | null;
  /** Independent pool configuration for each game type (US-006) */
  poolConfig?: PoolConfig[];
  createdBy?: string;
  createdAt: string;
  /** ID of the tournament champion (set when bracket final is played) */
  champion?: string;
}
