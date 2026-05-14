export type GameType =
  | 'simple-homme'
  | 'simple-femme'
  | 'double-homme'
  | 'double-femme'
  | 'double-mixte';

export const GAME_TYPES: GameType[] = [
  'simple-homme',
  'simple-femme',
  'double-homme',
  'double-femme',
  'double-mixte',
];

export const DOUBLE_GAME_TYPES: GameType[] = [
  'double-homme',
  'double-femme',
  'double-mixte',
];

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  'simple-homme': 'Simple Homme',
  'simple-femme': 'Simple Femme',
  'double-homme': 'Double Homme',
  'double-femme': 'Double Femme',
  'double-mixte': 'Double Mixte',
};

export interface Registration {
  id: string;
  tournamentId: string;
  playerId: string;
  gameType: GameType;
  registeredAt: string;
}
