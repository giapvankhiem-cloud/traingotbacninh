import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

/** Trusted fixture setup for existing commerce regression tests. The moderation
 * suite separately exercises real admin credentials, Rules and review actions. */
export async function approveFixture(env: RulesTestEnvironment, uid: string) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const ref = doc(db, 'farmerApplications', uid);
    const application = (await getDoc(ref)).data();
    if (!application || application.status !== 'pending') throw new Error('Fixture must submit a profile first.');
    const old = await getDocs(collection(db, 'farmers', uid, 'certificates'));
    const proofs = await getDocs(collection(db, 'farmerApplications', uid, 'certificates'));
    const batch = writeBatch(db);
    batch.set(doc(db, 'farmers', uid), application.profile);
    batch.update(ref, { status: 'approved', reviewedAt: Date.now(), reviewedBy: 'fixture-admin', reviewNote: 'Approved fixture' });
    for (const snapshot of old.docs) batch.delete(snapshot.ref);
    for (const snapshot of proofs.docs) if (application.profile.certificateIds.includes(snapshot.id)) batch.set(doc(db, 'farmers', uid, 'certificates', snapshot.id), snapshot.data());
    await batch.commit();
  });
}
