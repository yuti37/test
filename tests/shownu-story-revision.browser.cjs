// Isolated Chromium UI acceptance; never opens a personal profile or production origin.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(root+path.sep)||!(file.endsWith('index.html')||file.startsWith(path.join(root,'assets')+path.sep))){res.writeHead(404).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.png')?'image/png':'image/jpeg');res.end(data)})});
async function main(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});try{
 for(const width of [320,390,430]){
  const context=await browser.newContext({viewport:{width,height:width===320?568:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#launch-new').click();
  await page.evaluate(()=>{showPasscodeScreen();for(const digit of IPHONE_PASSCODE)enterPasscodeDigit(digit)});await page.locator('#home-screen.active').waitFor();
  // Real story transitions, with unrelated calls cancelled only in this disposable fixture.
  await page.evaluate(()=>{showScreen('app-kakao');openChat('shownu');for(const id of ['join','pay','tease','contact'])drinkingNightSelect(`after-work-drinks-shownu-v1:interactive:${drinkingNightState().stage}`,id);activateDrinkingMorning(drinkingNightState().morningDate);drinkingNightSelect('after-work-drinks-shownu-v1:interactive:morning','fine');showScreen('home-screen');for(const e of gameEventMemory.events)if(!['completed','cancelled','inapplicable'].includes(e.status))cancelGameEvent(e.id);for(const call of [lostPhoneStory.call,lostPhoneStory.openingCall])if(call){call.status='completed';call.pendingOutsideCallback=false}saveLostPhoneStory()});
  assert.equal(await page.evaluate(()=>shownuShoesEligibility().reason),'morning-not-read');
  await page.evaluate(()=>{showScreen('app-kakao');openChat('shownu');document.querySelector('#chat-messages').scrollTop=0});
  assert.equal(await page.evaluate(()=>!!getGameEvent(drinkingNightState().choices.morning.replyId).effects.preciseReadAt),false,'old messages at top do not imply the morning reply was read');
  await page.evaluate(()=>{const list=document.querySelector('#chat-messages');list.scrollTop=list.scrollHeight});
  await page.waitForFunction(()=>shownuShoesState()?.status==='active');
  assert.equal(await page.locator('[data-message-id="shownu-shoes-memory-v1:opening-message"]').count(),1);
  assert.equal(await page.locator('#chat-input').evaluate(el=>el.tagName),'BUTTON');assert.equal(await page.locator('#chat-form .send-btn').isVisible(),true);
  async function choose(id){const category=await page.evaluate(id=>stageElevenActiveOptions('shownu').find(item=>item.id.endsWith(':'+id))?.category,id);assert.ok(category,id);await page.locator('#chat-input').click();await page.locator(`[data-active-category="${category}"]`).click();const button=page.locator(`[data-active-option$=":${id}"]`);const b=await button.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1);await button.click();await page.locator('[data-active-confirm]').click()}
  await choose('shoes-thanks');await page.waitForFunction(()=>lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.stage==='invite-reply');
  assert.equal(await page.evaluate(()=>stageElevenActiveOptions('shownu').length),2);
  await choose('shoes-test');await page.waitForFunction(()=>shownuShoesState()?.status==='completed');
  const rows=page.locator('[data-message-id*="conversation:shownu:shoes-memory:"], [data-message-id="shownu-shoes-memory-v1:opening-message"]');assert.equal(await rows.count(),7);
  for(const line of await rows.all()){const b=await line.locator('.bubble').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1);assert.equal(await line.locator('.translation').count(),1)}
  await page.locator('#chat-input').click();const casualCategory=page.locator('[data-active-category="invite"]');assert.match(await casualCategory.innerText(),/요즘 재밌는 거/);await casualCategory.click();await page.locator('[data-active-option$=":casual-v2-ask"]').click();await page.locator('[data-active-confirm]').click();
  await page.waitForFunction(()=>lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.stage==='casual-v2-answer'&&!lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pendingReply);
  await choose('casual-v2-music');await page.waitForFunction(()=>lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.stage==='casual-v2-close'&&!lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pendingReply);
  await choose('casual-v2-tell');await page.waitForFunction(()=>lostPhoneStory.stageEleven.activeMessaging.conversations.shownu.pausedTopics.invitation?.status==='completed');
  await page.reload();await page.locator('#launch-continue').click();await page.evaluate(()=>{showPasscodeScreen();for(const digit of IPHONE_PASSCODE)enterPasscodeDigit(digit)});await page.locator('#home-screen.active').waitFor();await page.evaluate(()=>{showScreen('app-kakao');openChat('shownu')});assert.equal(await rows.count(),7);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,result:'pass',checks:['exact visible read','automatic Shownu opening','two real choice confirmations','seven translated messages','casual V2 category and full UI conversation','wrapped bubbles / option bounds','reload dedup','yellow arrow preserved']}));await context.close();
 }
}finally{await browser.close()}}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
