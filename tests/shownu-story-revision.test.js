const test=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/simulator-harness');
function ready(snapshot){const h=game(snapshot);h.start();return h}
function idle(h){h.run("for(const e of gameEventMemory.events)if(!['completed','cancelled','inapplicable'].includes(e.status))cancelGameEvent(e.id);for(const c of [lostPhoneStory.call,lostPhoneStory.openingCall])if(c){c.status='completed';c.pendingOutsideCallback=false;}saveLostPhoneStory()");return h}
function morning({read=true,route='kakaotalk_first'}={}){const h=ready();if(route==='instagram_first')h.run("showScreen('app-instagram')");h.open();for(const id of ['join','pay','tease','contact'])assert.equal(h.select(id),true);assert.equal(h.run('activateDrinkingMorning(drinkingNightState().morningDate)'),true);assert.equal(h.select('fine'),true);idle(h);if(read)h.run('markShownuPreciseRead()');else h.run("showScreen('home-screen')");return h}
function choose(h,id){h.run(`globalThis.testChoice=stageElevenActiveOptions('shownu').find(item=>item.id.endsWith(':${id}'))`);assert.ok(h.run('!!testChoice'),id);assert.equal(h.run('stageElevenCommitActiveMessage(testChoice)'),true);h.advance(3600)}
function shoesMessages(h){return JSON.parse(h.run("JSON.stringify(CONFIG.chats.find(c=>c.id==='shownu').messages.filter(m=>m.id==='shownu-shoes-memory-v1:opening-message'||m.id?.includes('conversation:shownu:shoes-memory:')))"))}
for(const first of ['shoes-natural','shoes-joke','shoes-thanks'])for(const second of ['shoes-accept','shoes-test'])test(`special story ${first}/${second}: seven messages, two choices, ordered and durable`,()=>{
 let h=morning();h.run('syncShownuShoes()');h.advance(1500);
 assert.equal(shoesMessages(h)[0].text,'아 맞다. 미국에서 사 준 신발 잘 신고 있어?');assert.equal(shoesMessages(h)[0].from,'셔누');
 assert.equal(h.run('stageElevenActiveOptions("shownu").length'),3);
 h.run(`globalThis.testChoice=stageElevenActiveOptions('shownu').find(item=>item.id.endsWith(':${first}'))`);
 assert.equal(h.run('stageElevenCommitActiveMessage(testChoice)'),true);
 assert.equal(h.run('stageElevenCommitActiveMessage(testChoice)'),false);
 assert.equal(h.run('stageElevenActiveOptions("shownu").length'),0);
 // Reload while the existing Stage Twelve reply is pending.
 h=ready(h.snapshot());h.run("showScreen('app-kakao');openChat('shownu')");h.advance(6000);
 assert.equal(h.run('stageElevenActiveOptions("shownu").length'),2);
 assert.deepEqual(shoesMessages(h).slice(3,5).map(m=>m.text),['근데 너 오늘 뭐 해?','시간 되면 잠깐 볼까 해서.']);
 choose(h,second);assert.equal(h.run('shownuShoesState().status'),'completed');
 const messages=shoesMessages(h);assert.equal(messages.length,7);assert.equal(messages.filter(m=>m.from==='형원').length,2);assert.equal(new Set(messages.map(m=>m.id)).size,7);
 assert.ok(messages.every(m=>m.translation));assert.deepEqual(messages.map(m=>m.deliverySequence),messages.map(m=>m.deliverySequence).sort((a,b)=>a-b));
 h=ready(h.snapshot());h.advance(10000);assert.deepEqual(shoesMessages(h),messages);
});
for(const [start,branch] of [['casual-v2-ask','casual-v2-music'],['casual-v2-ask','casual-v2-video'],['casual-v2-ask','casual-v2-nothing'],['casual-v2-share','casual-v2-explain'],['casual-v2-share','casual-v2-show']])for(const close of branch==='casual-v2-nothing'?[null]:['casual-v2-next','casual-v2-tell'])test(`casual V2 ${start}/${branch}/${close}: no invitation state`,()=>{
 const h=ready();h.run("showScreen('app-kakao');openChat('shownu');drinkingNightState().stage='complete';drinkingNightState().completed=true;drinkingNightState().invitationStatus='declined'");
 const romance=h.run('JSON.stringify(lostPhoneStory.stageEleven.romance.invitationStatus)');
 choose(h,start);choose(h,branch);if(close)choose(h,close);
 assert.equal(h.run("lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pausedTopics.invitation.status"),'completed');
 assert.equal(h.run('JSON.stringify(lostPhoneStory.stageEleven.romance.invitationStatus)'),romance);
 assert.equal(h.run("Object.keys(lostPhoneStory.stageEleven.activeMessaging.memories.shownu||{}).filter(key=>['shownu-invited','shownu-date-set','shownu-invite-pending','shownu-walk-planned'].includes(key)).length"),0);
});
for(const status of ['active','paused','completed'])test(`V1 invitation ${status} stays on old data after reload`,()=>{
 const h=ready();h.run(`const c=lostPhoneStory.stageEleven.activeMessaging.conversations.shownu;c.status='${status}';${status==='active'?"c.activeTopicId='invitation';c.stage='invite-date'":`c.pausedTopics.invitation={status:'${status}',stage:'invite-date'}`};saveLostPhoneStory()`);
 const r=ready(h.snapshot());assert.equal(r.run("stageTwelveGetFlow('shownu','invitation').stages.start[0].text"),'이번 주에 우리 둘이 밥 먹을래?');
 if(status==='active'){r.open();r.run("drinkingNightState().stage='complete'");choose(r,'invite-flex')}
});
test('legacy pending invitation retains its saved reply and advances correctly',()=>{
 let h=ready();h.open();h.run("drinkingNightState().stage='complete';const c=lostPhoneStory.stageEleven.activeMessaging.conversations.shownu;c.status='active';c.activeTopicId='invitation';c.stage='start'");
 h.run("stageElevenCommitActiveMessage(stageElevenActiveOptions('shownu').find(i=>i.id.endsWith(':invite-two')))");
 const pending=h.run('lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pendingReply');assert.ok(pending);
 h=ready(h.snapshot());h.advance(4000);assert.equal(h.run("lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.stage"),'invite-date');
 assert.equal(h.run('getGameEvent('+JSON.stringify(pending+':message')+').payload.message.text'),'좋아. 이번 주 일정 보고 가능한 날 먼저 알려줄게.');
});
test('approved copy is exact while original special/meaning and wind-down remain',()=>{
 const h=ready();assert.equal(h.run("STAGE_TWELVE_FLOWS.shownu.flirt.stages['flirt-after'][0].reply"),'안 될 건 없지 ㅋㅋ 그냥 물어본 거야.');
 assert.equal(h.run("STAGE_TWELVE_FLOWS.shownu.daily.stages['day-follow'][0].translation"),'行程結束後在休息，今天忙得有點亂。');
 assert.equal(h.run("STAGE_TWELVE_FLOWS.shownu.daily.stages['day-follow'][1].replyTranslation"),'最近在重聽以前聽的歌，熟悉的聽起來挺好。');
 assert.equal(h.run("STAGE_TWELVE_FLOWS.shownu.daily.stages['end-day'][0].text"),'응 ㅋㅋ 그냥 잠깐 얘기하고 싶었어.');
 assert.equal(h.run("STAGE_TWELVE_FLOWS.shownu.flirt.stages.start[1].text"),'형한테는 내가 좀 특별한 편이야?');assert.equal(h.run("STAGE_TWELVE_FLOWS.shownu.flirt.stages['special-meaning'][0].text"),'그냥 형이랑 있으면 편하고, 자주 생각나.');
 assert.equal(require('node:crypto').createHash('sha256').update(h.run("JSON.stringify(STAGE_TWELVE_FLOWS.shownu['wind-down'])")).digest('hex'),'9b2dcabe4655d813e6ed311ad755123acca559e5679cdfea8765d2e769a3e90a');
});
test('no new memory revisit, but saved memory-answer can still finish',()=>{
 const h=ready();h.open();h.run("drinkingNightState().stage='complete';const a=lostPhoneStory.stageEleven.activeMessaging;a.memories.shownu={'shownu-special':{receivedAt:1,revisitAfterTurn:0}};const c=a.conversations.shownu;c.pausedTopics.flirt={status:'completed'}");
 assert.equal(h.run("stageElevenActiveOptions('shownu').some(i=>i.id.includes('special-revisit'))"),false);
 h.run("const c2=lostPhoneStory.stageEleven.activeMessaging.conversations.shownu;c2.activeTopicId='flirt';c2.stage='memory-answer';c2.status='active'");choose(h,'memory-retreat');
 assert.equal(h.run("lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.status"),'completed');
});
test('unread morning cannot start; opening the actual room records exact read and allows opening',()=>{
 const h=morning({read:false});h.advance(3000);assert.equal(shoesMessages(h).length,0);assert.equal(h.run('shownuShoesEligibility().reason'),'morning-not-read');h.open();h.advance(3000);assert.equal(shoesMessages(h).length,1);
});
test('fresh and declined games never start the shoes event',()=>{for(const decline of [false,true]){const h=ready();h.open();if(decline)h.select('decline');h.advance(5000);assert.equal(shoesMessages(h).length,0)}});
for(const [label,setup] of [
 ['ringing',"lostPhoneStory.call.status='ringing'"],['callback',"lostPhoneStory.call.pendingOutsideCallback=true"],
 ['pending main',"createGameEvent({id:'blocked-main',type:'kkt-message',source:'kakao',scheduledAt:Date.now()+50000,payload:{chatId:'shownu',message:{id:'blocked-main',text:'test'}}})"],
 ['pending photo',"gameEventMemory.events.push({id:'blocked-photo',status:'pending',type:'kkt-message',payload:{chatId:'shownu',photoShareId:'photo-share-v1:restaurant-shownu-9334'}})"],
 ['old agreement',"lostPhoneStory.stageEleven.romance.invitationStatus='agreed'"],['awaiting date',"lostPhoneStory.stageEleven.romance.invitationStatus='awaiting-date'"],
 ['deferred date',"lostPhoneStory.stageEleven.romance.invitationStatus='deferred'"]
])test(`${label} safely defers opening without marking story complete`,()=>{const h=morning();h.run(setup);h.run('syncShownuShoes()');assert.equal(shoesMessages(h).length,0);assert.notEqual(h.run('shownuShoesState()?.status'),'completed');assert.equal(h.run('shownuShoesEligibility().allowed'),false)});
test('scheduled opening revalidates a new conflict without cancelling the photo reply',()=>{
 const h=morning();h.run("syncShownuShoes();photoShareOpen('photo-9334');photoShareSelect('photo-share-v1:restaurant-shownu-9334');photoShareUI.assetReady=true;photoShareConfirm()");h.advance(1700);
 assert.equal(shoesMessages(h).length,0);assert.equal(h.run("getGameEvent('photo-share-v1:restaurant-shownu-9334:reply').status"),'pending');
 h.advance(5000);assert.equal(shoesMessages(h).length,1);
});
for(const route of ['instagram_first','kakaotalk_first'])test(`${route} can reach the common shoes opening`,()=>{const h=morning({route});h.run('syncShownuShoes()');h.advance(1500);assert.equal(shoesMessages(h).length,1);assert.equal(h.run('lostPhoneStory.openingRoute'),route)});
test('late-night save now advances once after eligibility instead of awaiting a missing time UI',()=>{
 const h=morning();h.run('drinkingNightState().lastStoryTimestamp=new Date(2026,9,24,23).getTime()');h.advance(3000);
 assert.equal(shoesMessages(h).length,1);assert.equal(h.run('shownuShoesState().timeCorrection.to'),h.run('new Date(2026,9,25,9).getTime()'));assert.equal(h.run('shownuShoesState().timeCorrection.version'),1);
});
test('V2 pending save missing the optional version marker infers its own IDs and finishes new flow',()=>{
 let h=ready();h.open();h.run("drinkingNightState().stage='complete';stageElevenCommitActiveMessage(stageElevenActiveOptions('shownu').find(i=>i.id.endsWith(':casual-v2-share')));delete lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.topicVersions;saveLostPhoneStory()");
 h=ready(h.snapshot());h.advance(4000);h.open();assert.equal(h.run("stageTwelveGetFlow('shownu','invitation').version"),2);choose(h,'casual-v2-explain');choose(h,'casual-v2-tell');
});
test('existing dated memory with missing receipt metadata safely waits instead of assuming no agreement',()=>{
 const h=morning();h.run("lostPhoneStory.stageEleven.activeMessaging.memories.shownu={'shownu-date-set':{messageId:'old-unavailable'}}");assert.equal(h.run('shownuShoesAgreement()'),'pending');h.advance(3000);assert.equal(shoesMessages(h).length,0);
});
test('active special conversation safely defers an independent new phone without cancelling it',()=>{
 const h=morning();h.run('syncShownuShoes()');h.advance(1500);
 assert.equal(h.run("narrativeEventEligibility({id:'lost-phone-shownu-checkin-v1:call:test',type:'lost-phone-incoming-call',source:'phone',payload:{}}).phase"),'deferred');
 assert.equal(h.run('shownuShoesState().status'),'active');
});
test('confirmation consumes no new game state when opening save fails',()=>{
 const h=morning();h.run('saveLostPhoneStory=()=>false;syncShownuShoes()');assert.equal(h.run('shownuShoesState()'),null);assert.equal(h.run("getGameEvent('shownu-shoes-memory-v1:opening')"),null);
});
test('old memory-revisit entry remains playable through its original answer stage',()=>{
 const h=ready();h.open();h.run("drinkingNightState().stage='complete';const c=lostPhoneStory.stageEleven.activeMessaging.conversations.shownu;c.status='active';c.activeTopicId='flirt';c.stage='memory-revisit'");choose(h,'special-revisit');choose(h,'memory-explain');
 assert.equal(h.run('lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.status'),'completed');
});
test('new story requires selected morning IDs and evidence, not a generic complete flag',()=>{
 const h=morning();h.run('drinkingNightState().choices.morning.replyId="unrelated-completed"');assert.equal(h.run('shownuShoesEligibility().reason'),'morning-evidence-incomplete');h.advance(3000);assert.equal(shoesMessages(h).length,0);
});
test('old legacy follow-up state is retained and does not reopen retired active catalog entries',()=>{
 const h=morning();h.run("lostPhoneStory.stageSeven.groups['shownu-invite-followup']={id:'shownu-invite-followup',chatId:'shownu',status:'used',selectedOptionId:'invite-friday'};lostPhoneStory.stageEleven.romance.invitationStatus='agreed';saveLostPhoneStory()");
 const r=ready(h.snapshot());r.open();assert.equal(r.run('shownuShoesAgreement()'),'agreed');assert.equal(r.run("stageElevenActiveOptions('shownu').some(i=>['shownu-invite-meal','shownu-follow-invite'].includes(i.id))"),false);assert.equal(shoesMessages(r).length,0);
});
test('partial opening interrupted before child creation safely resumes one opening message',()=>{
 const h=morning();h.run("const a=lostPhoneStory.stageEleven.activeMessaging;a.specialEvents={shoesMemoryV1:{version:1,status:'starting',openingId:'shownu-shoes-memory-v1:opening-message'}};saveLostPhoneStory();syncShownuShoes()");assert.equal(shoesMessages(h).length,1);h.run('syncShownuShoes()');assert.equal(shoesMessages(h).length,1);
});
// A later-story legacy save: the original invitation is made on Monday for that week's Friday.
// Build its evidence through the original conversation, not a bare `agreed` flag.
function futureAgreement(){const h=morning({read:false});h.run("drinkingNightState().lastStoryTimestamp=new Date(2026,9,26,10).getTime();const c=lostPhoneStory.stageEleven.activeMessaging.conversations.shownu;c.status='active';c.activeTopicId='invitation';c.stage='start'");choose(h,'invite-two');choose(h,'invite-friday');choose(h,'invite-thanks');return h}
for(const ending of ['shoes-existing-natural','shoes-existing-joke'])test(`verified existing meeting / ${ending}: keeps old date, seven messages and reload dedup`,()=>{
 let h=futureAgreement();assert.equal(h.run('shownuShoesValidAgreement().valid'),true);assert.equal(h.run('shownuShoesValidAgreement().date'),'2026-10-30');
 const oldMemories=h.run('JSON.stringify(lostPhoneStory.stageEleven.activeMessaging.memories.shownu)');h.open();h.advance(3000);
 assert.equal(h.run('shownuShoesState().endingMode'),'existing');
 h=ready(h.snapshot());h.open();choose(h,'shoes-natural');
 assert.deepEqual(shoesMessages(h).slice(3,5).map(m=>[m.text,m.translation]),[['아, 그리고 전에 얘기한 약속 있잖아.','啊，還有之前說好的那個約。'],['그때 그 신발 신고 와 ㅋㅋ','到時候穿那雙鞋來ㅋㅋ']]);
 const options=JSON.parse(h.run("JSON.stringify(stageElevenActiveOptions('shownu').map(i=>[i.id.split(':').at(-1),i.text,i.translation,i.reply,i.replyTranslation]))"));
 assert.deepEqual(options,[['shoes-existing-natural','알겠어 ㅋㅋ 그날 신고 갈게.','知道了ㅋㅋ 那天會穿去。','그래 ㅋㅋ 그때 보자.','好啊ㅋㅋ 到時候見。'],['shoes-existing-joke','형이 사 준 거라서? ㅋㅋ','因為是哥買給我的嗎？ㅋㅋ','그것도 있고 ㅋㅋ 잘 어울렸잖아.','也有這個原因ㅋㅋ 畢竟那雙鞋很適合你。']]);
 choose(h,ending);assert.equal(h.run('shownuShoesState().meeting'),'existing-confirmed');assert.equal(h.run('JSON.stringify(lostPhoneStory.stageEleven.activeMessaging.memories.shownu)'),oldMemories);
 const delivered=shoesMessages(h);assert.equal(delivered.length,7);h=ready(h.snapshot());h.advance(10000);assert.deepEqual(shoesMessages(h),delivered);
});
for(const [label,change] of [
 ['expired Friday',"drinkingNightState().lastStoryTimestamp=new Date(2026,9,31,10).getTime()"],
 ['same day without exact meeting time',"drinkingNightState().lastStoryTimestamp=new Date(2026,9,30,10).getTime()"],
 ['missing delivered reply',"const m=lostPhoneStory.stageEleven.activeMessaging.memories.shownu['shownu-date-set'];getGameEvent(m.messageId+':reply:message').status='cancelled'"],
 ['deferred meeting',"lostPhoneStory.stageEleven.romance.invitationStatus='deferred'"],
 ['paused invitation',"lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pausedTopics.invitation.status='paused'"]
])test(`${label}: does not assume an existing valid meeting`,()=>{const h=futureAgreement();h.run(change);h.open();h.advance(3000);assert.equal(h.run('shownuShoesValidAgreement().valid'),false);assert.equal(shoesMessages(h).length,0)});
test('legacy Stage Seven Friday also requires real player/reply events and story date',()=>{
 const h=morning({read:false});h.run("drinkingNightState().lastStoryTimestamp=new Date(2026,9,26,10).getTime();const g=lostPhoneStory.stageSeven.groups['shownu-invite-followup']={id:'shownu-invite-followup',chatId:'shownu',status:'selected',selectedOptionId:'invite-friday',playerMessageId:'shownu-invite-followup:player:invite-friday'};stageSevenQueueMessage(g.playerMessageId,'shownu','형원','그럼 금요일 저녁은 어때?','那星期五晚上呢？',0,{notify:false,storyTimestamp:new Date(2026,9,26,10).getTime()});stageSevenQueueMessage('shownu-invite-followup:invite-friday:reply','shownu','셔누','금요일 저녁 괜찮아. 끝나고 연락할게.','星期五晚上可以。結束後我再聯絡你。',0,{notify:false,storyTimestamp:new Date(2026,9,26,10,1).getTime()})");
 assert.equal(h.run('shownuShoesValidAgreement().valid'),true);h.open();h.advance(3000);assert.equal(h.run('shownuShoesState().endingMode'),'existing');
});
for(const route of ['instagram_first','kakaotalk_first'])test(`normal ${route}: phone and morning finish, automatic story starts without forcing clock or cancelling events`,()=>{
 const h=ready();h.run(`showScreen('${route==='instagram_first'?'app-instagram':'app-kakao'}')`);h.advance(route==='instagram_first'?12000:120000);
 if(route==='instagram_first'){h.run("acceptCall();applyInstagramStoryChoice('home')");h.advance(2500)}else{h.run("answerLostPhoneCall();applyLostCallChoice('as-hyung');applyLostCallChoice('say-home')");h.advance(2000)}
 h.open();for(const id of ['join','pay','tease','contact'])h.select(id);assert.equal(h.run('activateDrinkingMorning(drinkingNightState().morningDate)'),true);h.select('fine');h.advance(240000);
 assert.equal(h.run('shownuShoesState().status'),'active');assert.equal(h.run('shownuShoesState().endingMode'),'new');assert.equal(shoesMessages(h).length,1);
 assert.equal(h.run('new Date(narrativeStoryTimestamp()).getDate()'),24);
});
