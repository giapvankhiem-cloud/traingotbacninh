import { useEffect, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { createConsultation, watchConsultationExperts } from '../services/consultations';
import type { FarmerAccount } from '../types/agriculture';
import { expertStatusLabels, type ConsultationDraft, type ConsultationExpert } from '../types/consultations';
import { ConsultationStartDialog, type ConsultationStartInput } from './ConsultationStartDialog';
import { ConsultationWorkspace } from './ConsultationWorkspace';
import { ExpertDirectory } from './ExpertDirectory';
import { FarmerConsultationHub } from './FarmerConsultationHub';
import { SeasonalNoticeEditor } from './SeasonalNotices';

interface ExpertChatTabProps {
  currentFarmer?: FarmerAccount;
  onLogin?: () => void;
  onConsultationLogin?: (draft: ConsultationDraft) => void;
  resumeDraft?: ConsultationDraft;
  onResumeHandled?: () => void;
}

export function ExpertChatTab({ currentFarmer, onLogin, onConsultationLogin, resumeDraft, onResumeHandled }: ExpertChatTabProps) {
  const [identity, setIdentity] = useState<{ user: User | null }>({ user: auth?.currentUser || null });
  const member = identity.user && !identity.user.isAnonymous ? identity.user : null;
  const memberId = member?.uid || '';
  const [lookup, setLookup] = useState<{ uid: string; profile: ConsultationExpert | null; error?: string }>();
  const [experts, setExperts] = useState<ConsultationExpert[]>([]);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [starter, setStarter] = useState<{ expert: ConsultationExpert; memberId: string; draft?: ConsultationDraft }>();
  const [created, setCreated] = useState<{ id: string; uid: string }>();

  useEffect(() => auth ? onIdTokenChanged(auth, user => setIdentity({ user })) : undefined, []);
  useEffect(() => {
    if (!db || !memberId) return;
    return onSnapshot(doc(db, 'consultationExperts', memberId), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      setLookup({ uid: memberId, profile: snapshot.exists() ? snapshot.data() as ConsultationExpert : null });
    }, error => setLookup({ uid: memberId, profile: null, error: error.message }));
  }, [memberId]);
  useEffect(() => {
    if (!db) {
      setDirectoryLoaded(true);
      setDirectoryError('Chưa kết nối được danh sách chuyên gia. Vui lòng thử lại sau.');
      return;
    }
    return watchConsultationExperts(false, items => {
      setExperts(items);
      setDirectoryLoaded(true);
      setDirectoryError('');
    }, error => {
      setExperts([]);
      setDirectoryLoaded(true);
      setDirectoryError(error.message);
    });
  }, []);

  const currentLookup = lookup?.uid === memberId ? lookup : undefined;
  const profile = currentLookup?.profile;
  const roleReady = !member || Boolean(currentLookup);
  const canDraft = roleReady && !profile && !currentLookup?.error;
  const canSend = Boolean(member?.emailVerified && canDraft);
  const currentStarter = starter?.memberId === memberId ? starter : undefined;
  const liveExpert = experts.find(expert => expert.id === currentStarter?.expert.id && expert.active && expert.status === 'active');

  useEffect(() => {
    if (!resumeDraft || !roleReady || !directoryLoaded) return;
    const expert = experts.find(item => item.id === resumeDraft.expertId && item.active && item.status === 'active');
    if (canDraft && expert && expert.id !== memberId) {
      setStarter({ expert, memberId, draft: resumeDraft });
    } else if (canDraft) {
      setResumeError('Chuyên gia đã tạm ngừng nhận câu hỏi. Bác có thể chọn chuyên gia khác.');
    }
    onResumeHandled?.();
  }, [resumeDraft, roleReady, directoryLoaded, experts, canDraft, memberId, onResumeHandled]);

  function openStarter(expert: ConsultationExpert) {
    if (!canDraft) return;
    setResumeError('');
    setStarter({ expert, memberId });
  }

  async function startConsultation(input: ConsultationStartInput, requestId: string) {
    if (!canDraft) throw new Error('Tài khoản hiện chưa thể bắt đầu tư vấn.');
    if (!member || !canSend) {
      if (onConsultationLogin) {
        onConsultationLogin({ expertId: input.expertId, question: input.question, crop: input.crop });
        setStarter(undefined);
      } else if (onLogin) onLogin();
      else throw new Error('Vui lòng đăng nhập và xác minh email để gửi câu hỏi.');
      return;
    }
    if (auth?.currentUser?.uid !== member.uid) throw new Error('Tài khoản vừa thay đổi. Vui lòng mở lại câu hỏi trước khi gửi.');
    const id = await createConsultation(input, requestId);
    setStarter(undefined);
    setCreated({ id, uid: member.uid });
  }

  const error = directoryError || currentLookup?.error || resumeError;
  return <div className="space-y-5">
    {error && <p role="alert" className="consultation-error">{error}</p>}
    {canSend && member ? <FarmerConsultationHub
      key={memberId} uid={memberId} experts={experts} loading={!directoryLoaded}
      onStartChat={openStarter} newConversationId={created?.uid === memberId ? created.id : undefined}
    /> : <>
      <ExpertDirectory experts={experts} loading={!directoryLoaded} onChat={openStarter} currentUserId={memberId}
        chatUnavailableReason={profile ? 'Tài khoản chuyên gia nhận và trả lời trong hộp thư.' : !canDraft ? 'Đang kiểm tra quyền tư vấn của tài khoản.' : undefined} />
      {!member && <section className="bg-white border rounded-2xl p-5 space-y-3">
        <p>Đăng nhập để gửi yêu cầu và theo dõi phản hồi riêng tư.</p>
        <button type="button" onClick={onLogin} className="ui-button-primary p-3">Đăng nhập để được tư vấn</button>
      </section>}
      {!roleReady && <p role="status">Đang kiểm tra tài khoản…</p>}
      {member && profile && <section className="space-y-4">
        <p className="rounded-xl bg-emerald-50 p-4">{profile.name} · {expertStatusLabels[profile.status]}{!profile.active && ' · Quản trị cần xác nhận quyền tư vấn trước khi bạn nhận và trả lời yêu cầu.'}</p>
        {profile.active && (member.emailVerified || profile.internalAccount) && <>
          <SeasonalNoticeEditor key={memberId + ':notices'} uid={memberId} />
          <ConsultationWorkspace key={memberId} mode="expert" uid={memberId} />
        </>}
      </section>}
      {member && canDraft && !member.emailVerified && <section className="bg-amber-50 p-4 rounded-xl">
        <p>Xác minh email trước khi gửi yêu cầu tư vấn.</p>
        <button type="button" onClick={onLogin} className="underline p-2">Xác minh tài khoản</button>
      </section>}
    </>}
    {currentStarter && canDraft && <ConsultationStartDialog
      key={currentStarter.expert.id} expert={liveExpert || currentStarter.expert} available={Boolean(liveExpert && liveExpert.id !== memberId)}
      defaultCrop={currentFarmer?.cropFocus} draft={currentStarter.draft} signInRequired={!canSend}
      onClose={() => setStarter(undefined)} onStart={startConsultation}
    />}
  </div>;
}
