import type { ConsultationExpert } from '../types/consultations';
import { useEffect, useMemo, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { collection, doc, documentId, getDocFromServer, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '../lib/firebase';
import type { Certificate, FarmerAccount, FarmerApplication, ProduceItem } from '../types/agriculture';
import { isAccountRestricted, type FarmerAccountState } from '../services/accountModeration';
import { storedAssetUrl } from '../utils/assetUrl';

export function withFarmer(product: ProduceItem, farmer?: FarmerAccount): ProduceItem {
  if (!farmer) return product;
  return {
    ...product, farmer: farmer.name, farmerPhone: farmer.phone, origin: farmer.location,
    location: farmer.gardenLocation || product.location,
    farmerProfile: { ...product.farmerProfile, name: farmer.name, avatar: farmer.avatar, role: farmer.role,
      phone: farmer.phone, zalo: farmer.phone.replace(/\s/g, ''), address: farmer.location,
      orchardAreaHa: farmer.areaHa, treeCount: farmer.treeCount, bio: farmer.bio || '', introductionMedia: farmer.introductionMedia || [], introductionContent: farmer.introductionContent, commitment: farmer.commitment || '',
      coverImage: farmer.orchardPhoto || '', certificates: farmer.certificates || [] },
  };
}

export function useFarmData(traceId = '') {
  const [user, setUser] = useState<User | null>(null);
  const [authVersion, refreshAuth] = useState(0);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [tokenRefresh, setTokenRefresh] = useState<{ uid: string; error?: string } | null>(null);
  const [expertLookup, setExpertLookup] = useState<{ uid: string; data: ConsultationExpert | null; ready: boolean; error?: string } | null>(null);
  const [claims, setClaims] = useState<{ uid: string; version: number; admin: boolean; error?: string } | null>(null);
  const [ownApplication, setOwnApplication] = useState<{ uid: string; data: FarmerApplication | null; ready: boolean; error?: string } | null>(null);
  const [privateCertificates, setPrivateCertificates] = useState<{ key: string; items: Certificate[] }>({ key: '', items: [] });
  const [farmers, setFarmers] = useState<FarmerAccount[]>([]);
  const [farmersReady, setFarmersReady] = useState(!firebaseConfigured);
  const [farmersError, setFarmersError] = useState('');
  const [accountStates, setAccountStates] = useState<Record<string, FarmerAccountState>>({});
  const [accountStatesLoading, setAccountStatesLoading] = useState(firebaseConfigured);
  const [declarations, setDeclarations] = useState<Record<string, { key: string; certificates: Certificate[] }>>({});
  const [rawProducts, setProducts] = useState<ProduceItem[]>([]);
  const [ownedProducts, setOwnedProducts] = useState<ProduceItem[]>([]);
  const [productLimit, setProductLimit] = useState(100);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(firebaseConfigured);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, 'farmerAccountStates'), (snap) => {
      setAccountStates(Object.fromEntries(snap.docs.map((item) => [item.id, item.data() as FarmerAccountState])));
      setAccountStatesLoading(false);
    }, (error) => { setError(error.message); setAccountStatesLoading(false); });
  }, []);
  useEffect(() => {
    // Refresh once per sign-in/page load so newly assigned admin claims appear.
    // Keeping this separate from authVersion avoids a token refresh loop.
    setTokenRefresh(null);
    if (!user || user.isAnonymous) return;
    let active = true;
    user.getIdToken(true).then(() => { if (active) setTokenRefresh({ uid: user.uid }); }, () => {
      if (active) setTokenRefresh({ uid: user.uid, error: 'Chưa tải được quyền tài khoản. Vui lòng tải lại trang.' });
    });
    return () => { active = false; };
  }, [user?.uid]);
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let active = true;
    user.getIdTokenResult().then((token) => {
      if (active) setClaims({ uid: user.uid, version: authVersion, admin: token.claims.admin === true && user.emailVerified });
    }, () => {
      if (active) setClaims({ uid: user.uid, version: authVersion, admin: false, error: 'Chưa xác định được vai trò tài khoản. Vui lòng tải lại trang.' });
    });
    return () => { active = false; };
  }, [user?.uid, authVersion]);
  useEffect(() => {
    setOwnApplication(null); setPrivateCertificates({ key: '', items: [] });
    if (!db || !user || user.isAnonymous) return;
    return onSnapshot(doc(db, 'farmerApplications', user.uid), { includeMetadataChanges: true }, (snapshot) => {
      setOwnApplication({ uid: user.uid, data: snapshot.exists() ? snapshot.data() as FarmerApplication : null, ready: !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites });
    }, () => setOwnApplication({ uid: user.uid, data: null, ready: false, error: 'Chưa tải được hồ sơ tài khoản. Vui lòng tải lại trang.' }));
  }, [user?.uid]);
  useEffect(() => {
    if (!db || !user || user.isAnonymous) return;
    return onSnapshot(doc(db, 'consultationExperts', user.uid), { includeMetadataChanges: true }, (snap) => setExpertLookup({ uid: user.uid, data: snap.exists() ? snap.data() as ConsultationExpert : null, ready: !snap.metadata.fromCache && !snap.metadata.hasPendingWrites }),
      () => setExpertLookup({ uid: user.uid, data: null, ready: false, error: 'Chưa tải được quyền chuyên gia. Vui lòng tải lại trang.' }));
  }, [user?.uid]);
  const expertAccount = expertLookup?.uid === user?.uid ? expertLookup?.data : null;
  const isAdmin = Boolean(user && claims?.uid === user.uid && claims.admin);
  const needsFarmerDirectory = !(ownApplication?.uid === user?.uid && ownApplication?.data) && !isAdmin && !expertAccount?.internalAccount;
  const identityError = user && !user.isAnonymous
    ? (tokenRefresh?.uid === user.uid && tokenRefresh.error) || (claims?.uid === user.uid && claims.error)
      || (ownApplication?.uid === user.uid && ownApplication.error) || (expertLookup?.uid === user.uid && expertLookup.error) || (needsFarmerDirectory && farmersError) || ''
    : '';
  const identityReady = authReady && (!user || user.isAnonymous || Boolean(!identityError && tokenRefresh?.uid === user.uid
    && claims?.uid === user.uid && claims.version === authVersion && ownApplication?.uid === user.uid && ownApplication.ready && expertLookup?.uid === user.uid && expertLookup.ready
    && (ownApplication.data || claims.admin || expertLookup.data?.internalAccount || farmersReady)));
  const application = ownApplication?.uid === user?.uid ? ownApplication?.data : null;
  const privateKey = application ? `${application.id}:${application.revision}:${(application.profile.certificateIds || []).join('|')}` : '';
  useEffect(() => {
    if (!db || !application || !application.profile.certificateIds?.length) return;
    const ids = application.profile.certificateIds;
    return onSnapshot(collection(db, 'farmerApplications', application.id, 'certificates'), (snapshot) => {
      const byId = new Map(snapshot.docs.map((item) => [item.id, item.data() as Certificate]));
      setPrivateCertificates({ key: privateKey, items: ids.map((id) => byId.get(id)).filter((value): value is Certificate => Boolean(value)) });
    }, (error) => setError(error.message));
  }, [privateKey]);
  const ownerKeys = JSON.stringify(farmers.map((farmer) => [farmer.id, farmer.certificateIds || []]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  useEffect(() => {
    if (!db) return;
    const owners = JSON.parse(ownerKeys) as Array<[string, string[]]>;
    const stops = owners.filter(([, ids]) => ids.length).map(([uid, ids]) => onSnapshot(query(collection(db!, 'farmers', uid, 'certificates'), where(documentId(), 'in', ids)), (snap) => {
      const byId = new Map(snap.docs.map((document) => [document.id, document.data() as Certificate]));
      setDeclarations((previous) => ({ ...previous, [uid]: { key: ids.join('|'), certificates: ids.map((id) => byId.get(id)).filter((value): value is Certificate => Boolean(value)) } }));
    }, async (error) => {
      // Removing a certificate revokes the previous query before React swaps it.
      // Ignore that stale query's denial only after checking the current IDs.
      if (error.code === 'permission-denied') {
        try {
          const latest = await getDocFromServer(doc(db!, 'farmers', uid));
          if ((latest.data()?.certificateIds || []).join('|') !== ids.join('|')) return;
        } catch { /* Surface the original failure below. */ }
      }
      setError(error.message);
    }));
    return () => stops.forEach((stop) => stop());
  }, [ownerKeys]);
  useEffect(() => {
    if (!auth || !db) return;
    setLoading(true);
    setFarmersReady(false); setFarmersError('');
    const stopAuth = onIdTokenChanged(auth, (value) => { setUser(value); setAuthReady(true); refreshAuth((version) => version + 1); });
    if (traceId) {
      let stopOwner = () => {};
      const stopProduct = onSnapshot(doc(db, 'products', traceId), { includeMetadataChanges: true }, (snap) => {
        if (!snap.exists() && snap.metadata.fromCache) return;
        stopOwner();
        const product = snap.exists() ? { ...snap.data(), id: snap.id } as ProduceItem : undefined;
        setProducts(product ? [product] : []); setLoading(false); setError('');
        if (product?.ownerId) stopOwner = onSnapshot(doc(db!, 'farmers', product.ownerId), (owner) => {
          setFarmers(owner.exists() ? [{ ...owner.data(), id: owner.id } as FarmerAccount] : []);
        }, (error) => setError(error.message));
      }, (error) => { setError(error.message); setLoading(false); });
      return () => { stopAuth(); stopProduct(); stopOwner(); };
    }
    const stopFarmers = onSnapshot(collection(db, 'farmers'), { includeMetadataChanges: true }, (snap) => {
      setFarmers(snap.docs.map((document) => ({ ...document.data(), id: document.id } as FarmerAccount)));
      if (!snap.metadata.fromCache) { setFarmersReady(true); setFarmersError(''); }
    }, (error) => { setError(error.message); setFarmersError('Chưa tải được thông tin nhà vườn. Vui lòng tải lại trang.'); setLoading(false); });
    const stopProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(productLimit)), (snap) => {
      setProducts(snap.docs.map((document) => ({ ...document.data(), id: document.id } as ProduceItem)));
      setLoading(false); setError('');
    }, (error) => { setError(error.message); setLoading(false); });
    return () => { stopAuth(); stopFarmers(); stopProducts(); };
  }, [traceId, productLimit]);
  useEffect(() => {
    setOwnedProducts([]);
    if (!db || !user || user.isAnonymous || traceId) return;
    return onSnapshot(query(collection(db, 'products'), where('ownerId', '==', user.uid)), (snap) => {
      setOwnedProducts(snap.docs.map((item) => ({ ...item.data(), id: item.id } as ProduceItem)));
    }, (error) => setError(error.message));
  }, [user?.uid, traceId]);
  const hydratedFarmers = useMemo(() => farmers.map((farmer) => ({
    ...farmer,
    avatar: storedAssetUrl(farmer.avatar || ''),
    orchardPhoto: farmer.orchardPhoto && storedAssetUrl(farmer.orchardPhoto),
    certificates: farmer.certificateIds?.length && declarations[farmer.id]?.key === farmer.certificateIds.join('|') ? declarations[farmer.id].certificates : [],
  })), [farmers, declarations]);
  const products = useMemo(() => (accountStatesLoading ? [] : Array.from(new Map([...rawProducts, ...ownedProducts].map((item) => [item.id, item])).values()))
    .filter((product) => !isAccountRestricted(product.ownerId ? accountStates[product.ownerId] : undefined))
    .map((product) => withFarmer({
      ...product,
      image: storedAssetUrl(product.image || ''),
      farmerProfile: product.farmerProfile && {
        ...product.farmerProfile,
        avatar: storedAssetUrl(product.farmerProfile.avatar || ''),
        coverImage: product.farmerProfile.coverImage && storedAssetUrl(product.farmerProfile.coverImage),
      },
    }, hydratedFarmers.find((farmer) => farmer.id === product.ownerId)))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [rawProducts, ownedProducts, hydratedFarmers, accountStates, accountStatesLoading]);
  const publicOwn = hydratedFarmers.find((farmer) => farmer.id === user?.uid);
  const currentFarmer = application ? { ...application.profile, applicationRevision: application.revision,
    avatar: storedAssetUrl(application.profile.avatar || ''),
    orchardPhoto: application.profile.orchardPhoto && storedAssetUrl(application.profile.orchardPhoto),
    certificates: privateCertificates.key === privateKey ? privateCertificates.items : [] } : publicOwn;
  const certificatesLoading = Boolean(application?.profile.certificateIds?.length && privateCertificates.key !== privateKey);
  const applicationLoading = Boolean(user && !user.isAnonymous && (ownApplication?.uid !== user.uid || !ownApplication?.ready));
  return { user, expertAccount: expertAccount?.id === user?.uid ? expertAccount : null, isAdmin, identityReady, identityError, application, applicationLoading, accountState: user ? accountStates[user.uid] : undefined, farmers: hydratedFarmers.filter((farmer) => !isAccountRestricted(accountStates[farmer.id])), products, loading: loading || accountStatesLoading, error: identityError || error, certificatesLoading, currentFarmer,
    canLoadMore: rawProducts.length >= productLimit, loadMore: () => setProductLimit((value) => value + 100) };
}
