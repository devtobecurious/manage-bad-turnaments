export type Gender = 'M' | 'F';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  active: boolean;
}
