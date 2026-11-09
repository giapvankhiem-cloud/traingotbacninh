import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Heart, MessageCircle, MoreHorizontal, Pencil, Send, Share2, Sprout, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import type { FarmerAccount } from '../types/agriculture';
import { MediaEditor, MediaGallery } from './GardenMedia';
import { validateMedia, type GardenMedia } from '../utils/media';
import { requireApprovedFarmer } from '../services/moderation';
import { communityPostUrl } from '../utils/communityLinks';
import { storedAssetUrl } from '../utils/assetUrl';

type Post = { id: string; ownerId: string; author: string; content: string; image: string; media?: GardenMedia[]; createdAt: number };
type Comment = { id: string; ownerId: string; author: string; text: string; createdAt: number };
const relativeTime = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
const hashtagPattern = /(#[\p{L}\p{M}\p{N}_]+)/gu;
const commentLimit = 100;
const recentCommentCount = 3;

function CommunityTime({ value }: { value: number }) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const minutes = Math.round((value - Date.now()) / 60_000);
  const hours = Math.round(minutes / 60);
  const fullDate = date.toLocaleString('vi-VN');
  const label = Math.abs(minutes) < 60
    ? relativeTime.format(minutes, 'minute')
    : Math.abs(hours) < 24 ? relativeTime.format(hours, 'hour') : fullDate;
  return <time dateTime={date.toISOString()} title={fullDate}>{label}</time>;
}

function CommunityAvatar({ name, photo, small = false }: { name: string; photo?: string; small?: boolean }) {
  const [brokenPhoto, setBrokenPhoto] = useState('');
  const initials = name.trim().split(/\s+/).slice(-2).map(word => word[0] || '').join('').toLocaleUpperCase('vi');
  return <span className={small ? 'community-avatar community-avatar-small' : 'community-avatar'} aria-hidden="true">
    {photo && photo !== brokenPhoto ? <img src={photo} alt="" loading="lazy" onError={() => setBrokenPhoto(photo)} /> : initials || <Sprout size={18} />}
  </span>;
}

function PostCard({ post, farmer, profiles, linked, onError }: {
  post: Post;
  farmer?: FarmerAccount;
  profiles: ReadonlyMap<string, FarmerAccount>;
  linked: boolean;
  onError: (text: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [allComments, setAllComments] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'copied' | 'manual'>();
  const article = useRef<HTMLElement>(null);
  const postMenu = useRef<HTMLDetailsElement>(null);
  const moreButton = useRef<HTMLElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const cancelDeleteButton = useRef<HTMLButtonElement>(null);
  const pointerStartedOnBackdrop = useRef(false);
  const deleteTitle = useId();
  const deleteDescription = useId();
  const discussionId = useId();
  const authorProfile = profiles.get(post.ownerId);
  const isOwner = farmer?.id === post.ownerId;
  const liked = Boolean(farmer && likes.includes(farmer.id));
  const visibleComments = allComments ? comments : comments.slice(-recentCommentCount);
  const olderCommentCount = comments.length - recentCommentCount;
  const commentLabel = comments.length === commentLimit ? '100 bình luận gần nhất' : `${comments.length} Bình luận`;
  const authorMeta = [authorProfile?.shortLocation || authorProfile?.commune, authorProfile?.role].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!db) return;
    const a = onSnapshot(query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'desc'), limit(commentLimit)), (snap) => setComments(snap.docs.map((item) => item.data() as Comment).reverse()), (error) => onError(error.message));
    const b = onSnapshot(collection(db, 'posts', post.id, 'likes'), (snap) => setLikes(snap.docs.map((item) => item.id)), (error) => onError(error.message));
    return () => { a(); b(); };
  }, [post.id]);
  useEffect(() => {
    if (linked) article.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [linked]);
  async function action(work: () => Promise<void>) {
    if (busy) return; setBusy(true);
    try { await requireApprovedFarmer(); await work(); onError(''); } catch (error) { onError((error as Error).message); } finally { setBusy(false); }
  }
  function openDeleteDialog() {
    const dialog = deleteDialog.current;
    if (!dialog || dialog.open) return;
    if (postMenu.current) postMenu.current.open = false;
    moreButton.current?.focus({ preventScroll: true });
    dialog.showModal();
    cancelDeleteButton.current?.focus();
  }
  async function sharePost() {
    try {
      await navigator.clipboard.writeText(communityPostUrl(post.id));
      setShareFeedback('copied');
    } catch {
      setShareFeedback('manual');
    }
  }

  return <article ref={article} className={linked ? 'community-post is-linked' : 'community-post'}>
    <header className="community-post-header">
      <div className="community-author">
        <CommunityAvatar name={post.author} photo={authorProfile?.avatar} />
        <div>
          <div className="community-author-line">
            <strong>{post.author}</strong>
            {isOwner && <span className="community-owner">Bài viết của bạn</span>}
          </div>
          <div className="community-meta">{authorMeta && <span>{authorMeta}</span>}<CommunityTime value={post.createdAt} /></div>
        </div>
      </div>
      {isOwner && <div className="community-post-tools">
        <button type="button" className="community-edit-button" disabled={busy || editing} onClick={() => { setContent(post.content); setEditing(true); }}>
          <Pencil size={15} aria-hidden="true" /> Sửa bài viết
        </button>
        <details ref={postMenu} className="community-post-menu" onBlur={event => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
        }} onKeyDown={event => {
          if (event.key === 'Escape' && event.currentTarget.open) {
            event.currentTarget.open = false;
            moreButton.current?.focus();
          }
        }}>
          <summary ref={moreButton} aria-label="Tùy chọn bài viết"><MoreHorizontal size={21} aria-hidden="true" /></summary>
          <div><button type="button" disabled={busy} onClick={openDeleteDialog}><Trash2 size={15} aria-hidden="true" /> Xóa bài</button></div>
        </details>
      </div>}
    </header>
    {editing && isOwner ? <form onSubmit={event => {
      event.preventDefault();
      if (!content.trim()) return;
      void action(async () => {
        await updateDoc(doc(db!, 'posts', post.id), { content: content.trim() });
        setEditing(false);
      });
    }}>
      <textarea aria-label="Nội dung bài viết" autoFocus required maxLength={5000} value={content} readOnly={busy} onChange={event => setContent(event.target.value)} className="w-full border rounded-xl p-3" />
      <div className="community-edit-actions">
        <button type="button" className="community-action" disabled={busy} onClick={() => setEditing(false)}>Hủy</button>
        <button disabled={busy || !content.trim()} className="ui-button-primary">Lưu chỉnh sửa</button>
      </div>
    </form> : <p className="community-post-content">{post.content.split(hashtagPattern).map((part, index) =>
      index % 2 ? <span key={index} className="community-hashtag">{part}</span> : part
    )}</p>}
    {(post.media?.length || post.image) && <div className="community-post-media">
      {post.media?.length ? <MediaGallery items={post.media} /> : <img loading="lazy" src={storedAssetUrl(post.image)} alt="Ảnh chia sẻ từ nhà vườn" />}
    </div>}
    <div className="community-actions">
      <button type="button" className="community-action community-like" aria-pressed={liked} disabled={busy || !farmer} onClick={() => action(async () => {
        if (!farmer) return;
        const ref = doc(db!, 'posts', post.id, 'likes', farmer.id);
        if (liked) await deleteDoc(ref);
        else await setDoc(ref, { ownerId: farmer.id });
      })}><Heart size={18} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" /> {likes.length} {liked ? 'Đã thích' : 'Yêu thích'}</button>
      <button type="button" className="community-action" aria-controls={discussionId} aria-expanded={commentsOpen} onClick={() => setCommentsOpen(open => !open)}>
        <MessageCircle size={18} aria-hidden="true" /> {commentLabel}
      </button>
      <button type="button" className="community-action community-share" onClick={sharePost}><Share2 size={17} aria-hidden="true" /> Chia sẻ</button>
    </div>
    {shareFeedback && <div className="community-share-feedback" role="status">
      {shareFeedback === 'copied' ? 'Đã sao chép liên kết bài viết.' : <label>Liên kết bài viết
        <input value={communityPostUrl(post.id)} readOnly onFocus={event => event.currentTarget.select()} />
      </label>}
    </div>}
    <div id={discussionId} className="community-discussion" hidden={!commentsOpen}>
      {comments.length > 0 && <div className="community-comments">
        {olderCommentCount > 0 && <button type="button" className="community-action" onClick={() => setAllComments(show => !show)}>
          {allComments ? 'Thu gọn bình luận' : `Xem ${olderCommentCount} bình luận trước`}
        </button>}
        {visibleComments.map(comment => <div key={comment.id} className="community-comment">
          <CommunityAvatar name={comment.author} photo={profiles.get(comment.ownerId)?.avatar} small />
          <div className="community-comment-card">
            <div className="community-comment-header"><strong>{comment.author}</strong><CommunityTime value={comment.createdAt} /></div>
            <p>{comment.text}</p>
          </div>
        </div>)}
      </div>}
      {farmer && <form className="community-reply" onSubmit={event => {
        event.preventDefault();
        if (!text.trim()) return;
        void action(async () => {
          const ref = doc(collection(db!, 'posts', post.id, 'comments'));
          await setDoc(ref, { id: ref.id, ownerId: farmer.id, author: farmer.name, text: text.trim(), createdAt: Date.now() });
          setText('');
        });
      }}>
        <input aria-label="Bình luận" required maxLength={1000} value={text} readOnly={busy} onChange={event => setText(event.target.value)} placeholder="Viết lời bình luận hoặc trao đổi kinh nghiệm…" />
        <button type="submit" className="community-send" disabled={busy || !text.trim()} aria-label="Gửi bình luận"><Send size={18} aria-hidden="true" /></button>
      </form>}
    </div>
    {isOwner && <dialog
          ref={deleteDialog}
          className="ui-dialog fixed inset-0 m-0 h-full max-h-none w-full max-w-none p-4 open:grid place-items-center overscroll-contain backdrop:bg-transparent"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={deleteTitle}
          aria-describedby={deleteDescription}
          onPointerDown={(event) => { pointerStartedOnBackdrop.current = event.target === event.currentTarget; }}
          onPointerUp={(event) => { if (event.target !== event.currentTarget) pointerStartedOnBackdrop.current = false; }}
          onPointerCancel={() => { pointerStartedOnBackdrop.current = false; }}
          onClick={(event) => {
            if (pointerStartedOnBackdrop.current && event.target === event.currentTarget) event.currentTarget.close();
            pointerStartedOnBackdrop.current = false;
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-xl">
            <header className="ui-banner px-5 py-4">
              <h3 id={deleteTitle} className="ui-section-title">Xóa bài viết?</h3>
            </header>
            <div className="space-y-4 p-5">
              <p id={deleteDescription}>Bài viết sẽ bị xóa khỏi cộng đồng nhà vườn.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button ref={cancelDeleteButton} type="button" className="rounded-xl border px-4 py-2" onClick={() => deleteDialog.current?.close()}>Hủy</button>
                <button type="button" disabled={busy} className="rounded-xl bg-rose-700 px-4 py-2 text-white hover:bg-rose-800" onClick={() => {
                  deleteDialog.current?.close();
                  void action(() => deleteDoc(doc(db!, 'posts', post.id)));
                }}>Xóa bài viết</button>
              </div>
            </div>
          </div>
    </dialog>}
  </article>;
}
const noProfiles: FarmerAccount[] = [];

export function RealtimeCommunity({ farmer, farmers = noProfiles, onLogin, blockedMessage, postId }: {
  farmer?: FarmerAccount;
  farmers?: FarmerAccount[];
  onLogin: () => void;
  blockedMessage?: string;
  postId?: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedReady, setFeedReady] = useState(!db);
  const [sharedPost, setSharedPost] = useState<{ id: string; post: Post | null }>();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<GardenMedia[]>([]);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const profiles = useMemo(() => {
    const entries = new Map(farmers.map(profile => [profile.id, profile]));
    if (farmer && !entries.has(farmer.id)) entries.set(farmer.id, farmer);
    return entries;
  }, [farmer, farmers]);
  const sharedInFeed = posts.find(post => post.id === postId);
  const linkedPost = sharedInFeed ?? (sharedPost?.id === postId ? sharedPost?.post : undefined);
  const visiblePosts = linkedPost ? [linkedPost, ...posts.filter(post => post.id !== linkedPost.id)] : posts;
  const linkedInFeed = Boolean(sharedInFeed);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setPosts(snap.docs.map(item => ({ ...item.data(), id: item.id }) as Post));
      setFeedReady(true);
    }, error => { setFeedReady(true); setError(error.message); });
  }, []);
  useEffect(() => {
    if (!db || !postId || linkedInFeed) return;
    setSharedPost(undefined);
    return onSnapshot(doc(db, 'posts', postId), { includeMetadataChanges: true }, snap => {
      if (snap.exists()) setSharedPost({ id: postId, post: { ...snap.data(), id: snap.id } as Post });
      else if (!snap.metadata.fromCache) setSharedPost({ id: postId, post: null });
    }, error => {
      setSharedPost({ id: postId, post: null });
      setError(error.message);
    });
  }, [postId, linkedInFeed]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (busy || processingMedia || !content.trim()) return;
    setBusy(true);
    setError('');
    try {
      validateMedia(media);
      const user = await requireApprovedFarmer();
      const ref = doc(collection(db!, 'posts'));
      await setDoc(ref, { id: ref.id, ownerId: user.uid, author: farmer!.name, content: content.trim(), image: '', media, createdAt: Date.now() });
      setContent('');
      setMedia([]);
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="community-page" aria-labelledby="community-title">
    <h2 id="community-title" className="sr-only">Bài viết cộng đồng nhà vườn</h2>
    {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-800 p-3">{error}</p>}
    {farmer ? <form onSubmit={publish} className="community-composer">
      <div className="community-composer-header">
        <CommunityAvatar name={farmer.name} photo={profiles.get(farmer.id)?.avatar} />
        <div><h3 className="ui-label-title">Tạo bài viết</h3><p className="community-meta">{farmer.name}</p></div>
      </div>
      <textarea aria-label="Bài viết mới" required maxLength={5000} placeholder="Chia sẻ kinh nghiệm canh tác…" value={content} readOnly={busy} onChange={event => setContent(event.target.value)} className="border rounded-2xl p-3 w-full" />
      <MediaEditor value={media} onChange={setMedia} onBusy={setProcessingMedia} disabled={busy} />
      <div className="community-publish-actions"><button disabled={busy || processingMedia || !content.trim()} className="ui-button-primary"><Send size={16} aria-hidden="true" /> {busy ? 'Đang đăng…' : 'Đăng bài'}</button></div>
    </form> : blockedMessage ? <p className="community-state community-state-warning">{blockedMessage}</p> : <div className="community-state">
      <button type="button" onClick={onLogin} className="ui-button-primary">Đăng nhập để chia sẻ và bình luận</button>
    </div>}
    {postId && linkedPost === undefined && db && <p className="community-state" role="status">Đang tải bài viết được chia sẻ…</p>}
    {postId && (linkedPost === null || !db) && <p className="community-state" role="status">Bài viết được chia sẻ hiện không còn hiển thị.</p>}
    <div className="community-feed">
      {visiblePosts.map(post => <PostCard key={post.id} post={post} farmer={farmer} profiles={profiles} linked={post.id === postId} onError={setError} />)}
      {!visiblePosts.length && !error && <p className="community-state">{feedReady ? 'Chưa có bài chia sẻ nào.' : 'Đang tải bài chia sẻ…'}</p>}
    </div>
  </section>;
}
