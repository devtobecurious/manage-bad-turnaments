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

export interface Tournament {
  id: string;
  name: string;
  date: string;
  description?: string;
  gameTypes?: GameType[];
  status: TournamentStatus;
  participationToken: string | null;
  createdBy?: string;
  createdAt: string;
}
