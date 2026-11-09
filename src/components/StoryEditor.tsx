import React, { useRef, useState } from 'react';
import { MediaGallery } from './GardenMedia';
import { compressImage } from '../utils/images';
import { MAX_MEDIA, normalizeVideoUrl, validVideoUrl, type GardenMedia } from '../utils/media';
import { decodeStory, insertStory, removeStoryMedia, storyText, type StoryBlock, type StoredStory } from '../utils/story';
export function StoryViewer({ blocks }: { blocks: StoryBlock[] | StoredStory }) {
 let safe: StoryBlock[];try{safe=decodeStory(blocks);}catch{return <p>Nội dung giới thiệu chưa hợp lệ.</p>;}
 return <div aria-label="Nội dung giới thiệu" className="space-y-3">{safe.map((block,i)=>block.type==='text' ? <p key={i} className="whitespace-pre-wrap break-words">{block.text}</p> : <MediaGallery key={i} items={[block]} />)}</div>;
}
export function StoryEditor({ value, onChange, onBusy, disabled }: {value: StoryBlock[];onChange:(v:StoryBlock[])=>void;onBusy:(v:boolean)=>void;disabled:boolean}) {
 const [link,setLink]=useState(''),[showLink,setShowLink]=useState(false),[processing,setProcessing]=useState(false),[error,setError]=useState('');
 const selection=useRef({index:0,start:0,end:0});const locked=useRef(false);const busy=processing||disabled;
 const mediaCount=value.filter(b=>b.type!=='text').length;
 function insert(media:GardenMedia[]) { const p=selection.current;const next=insertStory(value,p.index,p.start,p.end,media);onChange(next);selection.current={index:p.index+media.length*2,start:0,end:0}; }
 async function upload(e:React.ChangeEvent<HTMLInputElement>) {
  const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length||busy||locked.current)return;
  if(mediaCount+files.length>MAX_MEDIA){setError('Tối đa 6 ảnh/video trong phần giới thiệu.');return;}
  locked.current=true;setProcessing(true);onBusy(true);setError('');
  try{const media:GardenMedia[]=[];for(const file of files)media.push({type:'image',url:await compressImage(file,900,65000),caption:''});insert(media);}catch(e){setError((e as Error).message);}finally{locked.current=false;setProcessing(false);onBusy(false);}
 }
 return <section aria-label="Soạn giới thiệu nhà vườn" className="border rounded-xl bg-white p-3 space-y-3"><h4 className="font-semibold">Giới thiệu nhà vườn</h4>
 <div className="flex flex-wrap gap-3 items-center border-b pb-3"><label className="cursor-pointer border rounded-xl px-3 py-2">Thêm ảnh<input aria-label="Chèn ảnh vào giới thiệu" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy||mediaCount>=MAX_MEDIA} onChange={upload}/></label><button type="button" disabled={busy||mediaCount>=MAX_MEDIA} className="border rounded-xl px-3 py-2" onClick={()=>setShowLink(!showLink)}>Chèn video</button></div>
 {showLink&&<div className="flex flex-wrap gap-2"><label className="flex-1 min-w-0">Liên kết video<input type="url" maxLength={1200} value={link} disabled={busy} onChange={e=>setLink(e.target.value)} className="block w-full border rounded-xl p-2"/></label><button type="button" disabled={busy||!link.trim()||mediaCount>=MAX_MEDIA} onClick={()=>{try{const url=normalizeVideoUrl(link);if(!validVideoUrl(url))throw new Error('Chọn liên kết YouTube hoặc MP4/WebM qua HTTPS.');insert([{type:'video',url,caption:''}]);setLink('');setShowLink(false);setError('');}catch(e){setError((e as Error).message);}}}>Chèn vào nội dung</button></div>}
 {error&&<p role="alert" className="text-rose-800">{error}</p>}{processing&&<p role="status">Đang xử lý ảnh…</p>}
 {value.map((block,i)=>block.type==='text'?<textarea key={i} aria-label={i===0?'Giới thiệu nhà vườn':'Đoạn giới thiệu '+(i/2+1)} placeholder="Viết giới thiệu nhà vườn…" disabled={busy} rows={3} maxLength={Math.max(0,5000-storyText(value).length+block.text.length)} value={block.text} onSelect={e=>{const el=e.currentTarget;selection.current={index:i,start:el.selectionStart,end:el.selectionEnd};}} onChange={e=>{onChange(value.map((b,j)=>j===i?{type:'text',text:e.target.value}:b));selection.current={index:i,start:e.target.selectionStart,end:e.target.selectionEnd};}} className="block w-full resize-y border-0 rounded-xl p-2"/>:<div key={i} className="space-y-2"><MediaGallery items={[block]}/><button type="button" disabled={busy} className="text-sm underline" onClick={()=>{onChange(removeStoryMedia(value,i));selection.current={index:i-1,start:0,end:0};}}>Bỏ {block.type==='image'?'ảnh':'video'}</button></div>)}
 </section>;
}
