import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AppUser, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  private readonly _currentUser = signal<AppUser | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  constructor() {
    setPersistence(this.auth, browserLocalPersistence).catch(() => {
      // Persistence setting failure is non-fatal
    });

    onAuthStateChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await this.loadOrCreateUser(firebaseUser);
        this._currentUser.set(appUser);
      } else {
        this._currentUser.set(null);
      }
    });
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    this._currentUser.set(null);
  }

  private async loadOrCreateUser(firebaseUser: User): Promise<AppUser> {
    const userRef = doc(this.firestore, 'users', firebaseUser.uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data() as { role: UserRole };
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        role: data.role ?? 'player',
      };
    }

    // New user: default role is 'player'
    const newUser: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      role: 'player',
    };
    await setDoc(userRef, { role: newUser.role, email: newUser.email, displayName: newUser.displayName });
    return newUser;
  }
}
