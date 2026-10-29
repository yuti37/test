const test=require('node:test'),assert=require('node:assert/strict');
const {game}=require('./helpers/simulator-harness');
function ready(snapshot){const h=game(snapshot);h.start();return h}
function morning(){const h=ready();h.open();for(const id of ['join','pay','tease','contact'])h.select(id);h.run('activateDrinkingMorning(drinkingNightState().morningDate)');h.select('fine');h.run("for(const e of gameEventMemory.events)if(!['completed','cancelled','inapplicable'].includes(e.status))cancelGameEvent(e.id);for(const c of [lostPhoneStory.call,lostPhoneStory.openingCall])if(c){c.status='completed';c.pendingOutsideCallback=false}markShownuPreciseRead();saveLostPhoneStory()");return h}
function story(h){return h.run('narrativeStoryTimestamp()')}
function opening(h){return h.messages().filter(m=>m.id==='shownu-shoes-memory-v1:opening-message')}
function setNight(h,day=24,hour=23){h.run(`drinkingNightState().lastStoryTimestamp=new Date(2026,9,${day},${hour},30).getTime();saveLostPhoneStory()`)}
function select(h,id){h.run(`stageElevenCommitActiveMessage(stageElevenActiveOptions('shownu').find(i=>i.id.endsWith(':${id}')))`);h.advance(4000)}
test('late save automatically advances once to next story daytime and all new messages follow it',()=>{
 let h=morning();setNight(h);const from=story(h),history=JSON.stringify(h.messages()),expected=h.run('new Date(2026,9,25,9).getTime()');
 h.run("showScreen('home-screen');syncShownuShoes()");assert.equal(story(h),from,'scheduling alone does not publish a time transition');h.advance(1600);
 assert.equal(story(h),opening(h)[0].storyTimestamp);assert.equal(h.run('shownuShoesState().timeCorrection.to'),expected);assert.equal(opening(h).length,1);assert.equal(h.run('drinkingNightState().lastStoryTimestamp'),from);assert.equal(JSON.stringify(h.messages().filter(m=>m.id!=='shownu-shoes-memory-v1:opening-message')),history);
 const correction=h.run('shownuShoesState().timeCorrection.to');
 h=ready(h.snapshot());h.open();h.run("stageElevenCommitActiveMessage(stageElevenActiveOptions('shownu').find(i=>i.id.endsWith(':shoes-natural')));showScreen('home-screen')");h.advance(4000);const notices=h.notifications().filter(n=>n.eventId.includes('conversation:shownu:shoes-memory:'));assert.equal(notices.length,3);assert.ok(notices.every(n=>n.storyTimestamp>=expected));h.open();select(h,'shoes-accept');
 assert.equal(h.run('shownuShoesState().status'),'completed');assert.equal(h.run('shownuShoesState().timeCorrection.to'),correction);
 const all=h.messages().filter(m=>m.id==='shownu-shoes-memory-v1:opening-message'||m.id?.includes('conversation:shownu:shoes-memory:'));assert.equal(all.length,7);assert.ok(all.every(m=>m.storyTimestamp>=expected));assert.deepEqual(all.map(m=>m.deliverySequence),all.map(m=>m.deliverySequence).sort((a,b)=>a-b));
 const snapshot=h.snapshot();h=ready(snapshot);h.advance(10000);assert.equal(story(h),Math.max(...all.map(m=>m.storyTimestamp)));assert.equal(h.run('shownuShoesState().timeCorrection.to'),expected);assert.equal(opening(h).length,1);
});
test('daytime behavior has no correction and no story clock change',()=>{const h=morning(),at=story(h);h.advance(3000);assert.equal(story(h),at);assert.equal(h.run('shownuShoesState().timeCorrection'),undefined);assert.equal(opening(h).length,1)});
test('early-hours save uses the same date morning, not another full day',()=>{const h=morning();setNight(h,25,1);h.advance(3000);assert.equal(h.run('shownuShoesState().timeCorrection.to'),h.run('new Date(2026,9,25,9).getTime()'));assert.equal(opening(h).length,1)});
for(const [name,setup] of [
 ['unread morning',"delete getGameEvent(drinkingNightState().choices.morning.replyId).effects.preciseReadAt;showScreen('home-screen')"],
 ['declined drinks',"drinkingNightState().invitationStatus='declined'"],
 ['phone',"lostPhoneStory.call.status='ringing'"],
 ['callback',"lostPhoneStory.call.pendingOutsideCallback=true"],
 ['pending conversation',"lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pendingReply='still-waiting'"],
 ['unproved agreement',"lostPhoneStory.stageEleven.romance.invitationStatus='agreed'"],
 ['pending agreement',"lostPhoneStory.stageEleven.romance.invitationStatus='awaiting-date'"],
 ['deferred agreement',"lostPhoneStory.stageEleven.romance.invitationStatus='deferred'"]
])test(`${name} prevents both the clock correction and opening`,()=>{const h=morning();setNight(h);h.run(setup);const at=story(h);h.advance(3000);assert.equal(story(h),at);assert.equal(opening(h).length,0);assert.equal(h.run('shownuShoesState()?.timeCorrection'),undefined)});
test('another app message retains its deadline and story stamp, and is delivered before the night correction',()=>{
 const h=morning();setNight(h);h.run("stageSevenQueueMessage('other-app-before-shoes','minhyuk','민혁','test','測試',5000,{notify:true,storyTimestamp:narrativeStoryTimestamp()})");const from=story(h),before=h.run("JSON.stringify(getGameEvent('other-app-before-shoes').payload.message)"),due=h.run("getGameEvent('other-app-before-shoes').scheduledAt");
 h.advance(4500);assert.equal(story(h),from);assert.equal(h.run("getGameEvent('other-app-before-shoes').status"),'pending');assert.equal(h.run("getGameEvent('other-app-before-shoes').scheduledAt"),due);
 h.advance(4000);assert.equal(h.run("getGameEvent('other-app-before-shoes').status"),'completed');assert.equal(h.run("JSON.stringify(getGameEvent('other-app-before-shoes').payload.message)"),before);assert.equal(opening(h).length,1);
 assert.ok(h.run("CONFIG.chats.find(c=>c.id==='minhyuk').messages.find(m=>m.id==='other-app-before-shoes').deliverySequence")<opening(h)[0].deliverySequence);
});
test('a real photo reply completes before the story date changes',()=>{
 const h=morning();setNight(h);h.run("photoShareOpen('photo-9334');photoShareSelect('photo-share-v1:restaurant-shownu-9334');photoShareUI.assetReady=true;photoShareConfirm()");const from=story(h);h.advance(2500);assert.equal(story(h),from);assert.equal(opening(h).length,0);
 h.advance(5000);assert.equal(h.run("getGameEvent('photo-share-v1:restaurant-shownu-9334:reply').status"),'completed');assert.equal(opening(h).length,1);
});
test('saving failure rolls back the new time and can retry without crossing twice',()=>{
 const h=morning();setNight(h);const from=story(h);h.run('syncShownuShoes();globalThis.beforeTimeSave=saveLostPhoneStory;saveLostPhoneStory=()=>false');h.advance(1600);assert.equal(story(h),from);assert.equal(opening(h).length,0);assert.equal(h.run('shownuShoesState().timeCorrection'),undefined);
 h.run('saveLostPhoneStory=beforeTimeSave');h.advance(6000);assert.equal(opening(h).length,1);assert.equal(h.run('shownuShoesState().timeCorrection.to'),h.run('new Date(2026,9,25,9).getTime()'));
});
function datedAgreement(day=26){const h=morning();h.run("delete getGameEvent(drinkingNightState().choices.morning.replyId).effects.preciseReadAt;globalThis.oldMarkRead=markShownuPreciseRead;markShownuPreciseRead=()=>{};drinkingNightState().lastStoryTimestamp=new Date(2026,9,26,10).getTime();const c=lostPhoneStory.stageEleven.activeMessaging.conversations.shownu;c.status='active';c.activeTopicId='invitation';c.stage='start'");for(const id of ['invite-two','invite-friday','invite-thanks'])select(h,id);setNight(h,day);h.run('markShownuPreciseRead=oldMarkRead;markShownuPreciseRead()');return h}
for(const ending of ['shoes-existing-natural','shoes-existing-joke'])test(`night / ${ending}: keeps the confirmed date and finishes once after reload`,()=>{
 let h=datedAgreement();assert.equal(h.run('shownuShoesValidAgreement().date'),'2026-10-30');const memories=h.run('JSON.stringify(lostPhoneStory.stageEleven.activeMessaging.memories.shownu)');h.advance(3000);
 assert.equal(h.run('shownuShoesState().endingMode'),'existing');assert.equal(h.run('shownuShoesState().timeCorrection.to'),h.run('new Date(2026,9,27,9).getTime()'));assert.equal(h.run('shownuShoesState().agreementRef.date'),'2026-10-30');
 h=ready(h.snapshot());h.open();select(h,'shoes-thanks');select(h,ending);assert.equal(h.run('shownuShoesState().meeting'),'existing-confirmed');assert.equal(h.run('JSON.stringify(lostPhoneStory.stageEleven.activeMessaging.memories.shownu)'),memories);assert.equal(opening(h).length,1);
});
test('Thursday night to Friday morning does not invalidate a proven Friday-evening meeting',()=>{
 const h=datedAgreement(29);h.advance(3000);assert.equal(h.run('shownuShoesState().timeCorrection.to'),h.run('new Date(2026,9,30,9).getTime()'));assert.equal(h.run('shownuShoesState().endingMode'),'existing');assert.equal(h.run('shownuShoesState().agreementRef.date'),'2026-10-30');
});
test('crash after saving the clock but before writing the opening resumes without another advance',()=>{
 let h=morning();setNight(h);h.advance(3000);const at=story(h),snap=h.snapshot();
 snap.local=snap.local.map(([key,value])=>{const data=JSON.parse(value);if(key==='phone-sim-lost-phone-story-v1'){const a=data.stageEleven.activeMessaging;a.specialEvents.shoesMemoryV1.status='starting';delete a.specialEvents.shoesMemoryV1.timeCorrection.latestMessageTimestamp;a.conversations.shownu.activeTopicId=null;a.conversations.shownu.status='idle';return [key,JSON.stringify(data)]}if(key==='phone-sim-event-store-v2'){data.events=data.events.filter(e=>e.id!=='shownu-shoes-memory-v1:opening-message');data.notifications=data.notifications.filter(n=>n.eventId!=='shownu-shoes-memory-v1:opening-message');return [key,JSON.stringify(data)]}return [key,value]});
 h=ready(snap);h.advance(3000);assert.equal(story(h),at);assert.equal(opening(h).length,1,h.run('JSON.stringify({state:shownuShoesState(),eligibility:shownuShoesEligibility(),convo:lostPhoneStory.stageEleven.activeMessaging.conversations.shownu})'));
});
test('correction never moves behind a later already-delivered message',()=>{
 const h=morning();setNight(h);const future=h.run('new Date(2026,9,26,15).getTime()');h.run(`stageSevenQueueMessage('already-future','minhyuk','민혁','test','測試',0,{notify:false,storyTimestamp:${future}})`);h.advance(3000);assert.ok(story(h)>=future);assert.ok(opening(h)[0].storyTimestamp>=future);
});
