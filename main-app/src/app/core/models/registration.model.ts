import { Gender } from './player.model';

export type GameType =
  | 'simple homme'
  | 'double homme'
  | 'simple femme'
  | 'double femme'
  | 'mixte';

export interface Registration {
  id: string;
  tournamentId: string;
  playerId: string;
  gameType: GameType;
  registeredAt: string;
}

/**
 * Returns the compatible game types for a given player gender.
 * - Homme: simple homme, double homme, mixte
 * - Femme: simple femme, double femme, mixte
 */
export function getCompatibleGameTypes(gender: Gender): GameType[] {
  if (gender === 'homme') {
    return ['simple homme', 'double homme', 'mixte'];
  }
  return ['simple femme', 'double femme', 'mixte'];
}
