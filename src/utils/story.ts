export interface StoryText { type: 'text'; text: string }
import { validateMedia, type GardenMedia } from './media';
export type StoryBlock = StoryText | GardenMedia;
export function storyFromLegacy(bio = '', media: GardenMedia[] = []): StoryBlock[] {
 return [{type:'text',text:bio}, ...media.flatMap(m => [m, {type:'text' as const,text:''}])];
}
export function storyText(blocks: StoryBlock[]): string { return blocks.filter((b): b is StoryText => b.type === 'text').map(b=>b.text).join('\n'); }
export function validateStory(blocks: unknown): asserts blocks is StoryBlock[] {
 if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > 13 || blocks.length % 2 !== 1 || !blocks.every((b,i)=> i%2 === 0 ? b && Object.keys(b).length===2 && b.type==='text' && typeof b.text==='string' : b && b.type !== 'text')) throw new Error('Nội dung giới thiệu chưa hợp lệ.');
 validateMedia(blocks.filter(b=>b.type!=='text'));
 if (storyText(blocks).length > 5000) throw new Error('Giới thiệu tối đa 5.000 ký tự.');
}
export function insertStory(blocks: StoryBlock[], index: number, start: number, end: number, media: GardenMedia[]): StoryBlock[] {
 const block=blocks[index]; if(block?.type!=='text') throw new Error('Hãy chọn vị trí trong phần giới thiệu.');
 const added: StoryBlock[]=[{type:'text',text:block.text.slice(0,start)}];
 for(const m of media) added.push(m,{type:'text',text:''});
 (added[added.length-1] as StoryText).text=block.text.slice(end);
 const next=[...blocks.slice(0,index),...added,...blocks.slice(index+1)];validateStory(next);return next;
}
export function removeStoryMedia(blocks: StoryBlock[], index: number): StoryBlock[] {
 if(index%2!==1) return blocks;
 const before=blocks[index-1] as StoryText,after=blocks[index+1] as StoryText;
 return [...blocks.slice(0,index-1),{type:'text' as const,text:before.text+after.text},...blocks.slice(index+2)];
}
export interface StoredStory { paragraphs: string[]; media: string[] }
export function encodeStory(blocks: StoryBlock[]): StoredStory { validateStory(blocks);return {paragraphs:blocks.filter((b):b is StoryText=>b.type==='text').map(b=>b.text),media:blocks.filter((b):b is GardenMedia=>b.type!=='text').map(m=>(m.type==='image'?'i:':'v:')+m.url)}; }
export function decodeStory(value: StoredStory | StoryBlock[]): StoryBlock[] {
 if(Array.isArray(value)){validateStory(value);return value;}
 const s=value;
 if(!s || Object.keys(s).some(k=>!['paragraphs','media'].includes(k)) || !Array.isArray(s.paragraphs) || !Array.isArray(s.media) || s.paragraphs.length!==s.media.length+1 || !s.paragraphs.every(t=>typeof t==='string') || !s.media.every(m=>typeof m==='string' && /^(i:|v:)/.test(m)))throw new Error('Nội dung giới thiệu chưa hợp lệ.');
 const media:GardenMedia[]=s.media.map(m=>({type:m.startsWith('i:')?'image':'video',url:m.slice(2),caption:''}));
 validateMedia(media);const blocks:StoryBlock[]=s.paragraphs.flatMap((text,i)=>i<media.length?[{type:'text' as const,text},media[i]]:[{type:'text' as const,text}]);validateStory(blocks);return blocks;
}
export function readStory(value: StoredStory | undefined, fallback: StoryBlock[]): StoryBlock[] { try{return value?decodeStory(value):fallback;}catch{return fallback;} }
export function validateStoredStory(value: unknown): asserts value is StoredStory { if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Nội dung giới thiệu chưa hợp lệ.');decodeStory(value as StoredStory); }
