export type TournamentStatus = 'Brouillon' | 'Inscriptions ouvertes' | 'Inscriptions clôturées' | 'En cours' | 'Terminé';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  status: TournamentStatus;
  participationToken: string | null;
  createdBy: string;
  createdAt: string;
}
