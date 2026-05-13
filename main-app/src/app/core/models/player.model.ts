export type Gender = 'homme' | 'femme';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  createdAt: string;
  active: boolean;
}
