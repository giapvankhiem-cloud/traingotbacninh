import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeVideoUrl, validateMedia, validMediaItem, validVideoUrl } from '../src/utils/media';
const image = {type:'image',url:'data:image/jpeg;base64,/9j/2Q==',caption:'Vườn sau thu hoạch'};
test('garden media: six mixed attachments pass and excess/unsafe payloads fail',()=>{
 const video={type:'video',url:'https://www.youtube.com/watch?v=abcDEF123_-',caption:'Thăm vườn'};
 validateMedia([image,image,video,image,video,image]);
 for(const items of [[...Array(7).fill(image)],[{...image,url:'javascript:alert(1)'}],[{...image,caption:'x'.repeat(161)}],[{...image,url:'data:image/svg+xml;base64,AA=='}],[{...image,url:'data:image/jpeg;base64,'+'A'.repeat(65000)}],[{...image,extra:true}],[{...video,url:'http://example.com/x.mp4'}],[{...video,url:'https://user:secret@example.com/x.mp4'}]])assert.throws(()=>validateMedia(items));
});
test('garden media: canonicalizes YouTube sharing, shorts and watch parameters',()=>{
 for(const link of ['https://youtu.be/abcDEF123_-?si=share','https://www.youtube.com/shorts/abcDEF123_-','https://www.youtube.com/watch?feature=shared&v=abcDEF123_-'])assert.equal(normalizeVideoUrl(link),'https://www.youtube.com/watch?v=abcDEF123_-');
 for(const link of ['https://example.com/garden.Mp4?token=x','https://example.com/garden.webm'])assert.ok(validVideoUrl(link));
 for(const link of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=abcDEF123_-','https://example.com/page','data:video/mp4;base64,AA=='])assert.equal(validVideoUrl(link),false);
 assert.equal(validMediaItem(null),false);assert.throws(()=>normalizeVideoUrl('http://youtu.be/abcDEF123_-'));
});
import { insertStory, removeStoryMedia, storyFromLegacy, storyText, validateStory } from '../src/utils/story';
test('inline introduction: insert at cursor, migrate old photos, remove and reject malformed story',()=>{
 const legacy=storyFromLegacy('TrướcSau',[image as any]);validateStory(legacy);
 const inline=insertStory([{type:'text',text:'TrướcSau'}],0,5,5,[image as any]);assert.equal((inline[0] as any).text,'Trước');assert.equal((inline[2] as any).text,'Sau');assert.equal(storyText(inline),'Trước\nSau');
 assert.deepEqual(removeStoryMedia(inline,1),[{type:'text',text:'TrướcSau'}]);
 for(const invalid of [[],[image],[{type:'text',text:'x'.repeat(5001)}],[{type:'text',text:'x'},image],[...Array(15).fill({type:'text',text:''})]])assert.throws(()=>validateStory(invalid));
});
import { decodeStory, encodeStory, validateStoredStory } from '../src/utils/story';
test('inline introduction: compact stored content round-trips and rejects malformed text/media',()=>{
 const blocks=insertStory([{type:'text',text:'TrướcSau'}],0,5,5,[{...image,caption:''} as any]);const stored=encodeStory(blocks);assert.equal(stored.paragraphs[0],'Trước');assert.equal(stored.paragraphs[1],'Sau');validateStoredStory(stored);assert.deepEqual(decodeStory(stored),blocks);
 for(const invalid of [{},'bad JSON',{paragraphs:['x'.repeat(5001)],media:[]},{paragraphs:['x','y'],media:['v:javascript:alert(1)']},{paragraphs:['a','b'],media:['i:data:image/jpeg;base64,'+'A'.repeat(65001)]}])assert.throws(()=>validateStoredStory(invalid));
});
