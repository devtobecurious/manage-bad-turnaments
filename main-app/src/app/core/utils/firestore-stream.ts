import { Query, CollectionReference, DocumentData, onSnapshot } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

/**
 * Drop-in replacement for AngularFire's `collectionData`.
 *
 * `collectionData` in AngularFire 18+ internally calls `inject(Firestore)` for
 * instance validation and must be called inside an Angular injection context.
 * When invoked from a service method (outside the constructor), Angular 22 throws
 * "Type does not match the expected instance. Did you pass a reference from a
 * different Firestore SDK?" even though all imports come from `@angular/fire/firestore`.
 *
 * This helper uses `onSnapshot` from the Firebase JS SDK directly, bypassing
 * AngularFire's instance check while keeping a real-time Observable interface.
 */
export function firestoreStream<T extends DocumentData>(
  queryOrRef: Query<T> | CollectionReference<T>,
  idField?: string,
): Observable<T[]> {
  return new Observable<T[]>(subscriber => {
    const unsubscribe = onSnapshot(
      queryOrRef as Query<T>,
      snapshot => {
        const data = snapshot.docs.map(docSnap =>
          idField
            ? ({ [idField]: docSnap.id, ...docSnap.data() } as unknown as T)
            : (docSnap.data() as T),
        );
        subscriber.next(data);
      },
      error => subscriber.error(error),
    );
    return unsubscribe;
  });
}
