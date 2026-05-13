import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, updateDoc } from '@angular/fire/firestore';
import { Invite } from '../models/invite.model';

@Injectable({
  providedIn: 'root',
})
export class InviteService {
  private readonly firestore = inject(Firestore);

  /**
   * Creates a global invite link for the club.
   * Deactivates any previously active invite before creating a new one.
   * AC1: L'admin génère un lien d'invitation global pour le club (non nominatif)
   */
  async createInvite(adminUid: string): Promise<Invite> {
    const invitesRef = collection(this.firestore, 'invites');

    // Deactivate existing active invites
    const activeQuery = query(invitesRef, where('active', '==', true));
    const existingDocs = await getDocs(activeQuery);
    const deactivatePromises = existingDocs.docs.map((d) =>
      updateDoc(d.ref, { active: false })
    );
    await Promise.all(deactivatePromises);

    const token = crypto.randomUUID();
    const now = new Date().toISOString();

    const docRef = await addDoc(invitesRef, {
      token,
      createdBy: adminUid,
      createdAt: now,
      active: true,
    });

    return {
      id: docRef.id,
      token,
      createdBy: adminUid,
      createdAt: now,
      active: true,
    };
  }

  /**
   * Retrieves an active invite by its token.
   * Returns null if the token is invalid or the invite is inactive.
   */
  async getInviteByToken(token: string): Promise<Invite | null> {
    const invitesRef = collection(this.firestore, 'invites');
    const q = query(invitesRef, where('token', '==', token), where('active', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data() as Omit<Invite, 'id'>;
    return { id: docSnap.id, ...data };
  }
}
