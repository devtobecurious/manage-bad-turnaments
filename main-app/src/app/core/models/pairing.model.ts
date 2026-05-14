import { GameType } from './registration.model';

export interface Pair {
  id: string;
  tournamentId: string;
  gameType: GameType;
  player1Id: string;
  player2Id: string;
  locked: boolean;
}
