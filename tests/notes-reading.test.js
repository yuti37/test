const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function harness() {
  const notes = vm.runInNewContext(html.match(/notes: (\[[\s\S]*?\]),\s*reminders:/)[1]);
  notes.push(vm.runInNewContext('(' + html.match(/CONFIG\.notes\.push\((\{id:'phone-sim-stage11-private-note'.*?\})\)/)[1] + ')'));
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) {
      const classes = new Set();
      nodes.set(selector, {innerHTML:'', textContent:'', value:'', hidden:false, scrollTop:0,
        classList:{add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x)},
        listeners:{}, addEventListener(type, callback) { this.listeners[type] = callback; }});
    }
    return nodes.get(selector);
  };
  const context = vm.createContext({CONFIG:{notes}, $, escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
  const start = html.indexOf('const notesViewState=');
  vm.runInContext(html.slice(start, html.indexOf('function renderReminders(', start)) + '\nglobalThis.api={renderNotes,openNote,closeNoteDetail,filteredNotes,state:notesViewState};', context);
  for (const prefix of ["$('#notes-query').addEventListener", "$('#app-notes').addEventListener"]) {
    vm.runInContext(html.split(/\r?\n/).find(line=>line.startsWith(prefix)), context);
  }
  context.api.renderNotes();
  return {api:context.api, $, notes};
}

for (const [id, title] of [['note-drinks','술 약속'],['note-playlist','플레이리스트'],['phone-sim-stage11-private-note','저장하지 않을 초안']]) {
  test(`Notes opens the full original body and translation by ID: ${title}`, () => {
    const {api,$,notes} = harness();
    const note = notes.find(n=>n.id===id);
    assert.equal(api.openNote(id), true);
    const detail = $('#notes-detail-content').innerHTML;
    assert.ok(detail.includes(note.title));
    assert.ok(detail.includes(note.body));
    assert.ok(detail.includes(note.translation));
    assert.ok(!detail.includes('notes-detail-date'), 'undated notes do not invent timestamps');
    assert.equal($('#notes-detail').hidden, false);
    assert.equal(api.state.selectedId, id);
  });
}

test('Notes search covers Korean titles, bodies and Traditional Chinese translations', () => {
  const {api} = harness();
  for (const [q,id] of [['술 약속','note-drinks'],['국물','note-drinks'],['下酒菜','note-drinks'],['想你了','phone-sim-stage11-private-note'],['As You Wish','note-playlist']]) {
    api.renderNotes(q);
    assert.deepEqual(Array.from(api.filteredNotes(), n=>n.id), [id]);
  }
});

test('Notes return preserves the query, results and list scroll position', () => {
  const {api,$} = harness();
  api.renderNotes('下酒菜');
  $('#notes-body').scrollTop=63;
  const listBefore=$('#notes-body').innerHTML;
  api.openNote('note-drinks');
  $('#notes-detail-content').scrollTop=100;
  api.closeNoteDetail();
  assert.equal($('#notes-body').scrollTop,63);
  assert.equal($('#notes-query').value,'下酒菜');
  assert.equal($('#notes-body').innerHTML,listBefore);
  assert.equal($('#notes-detail').hidden,true);
  assert.equal($('#app-notes').classList.contains('notes-reading'),false);
});

test('Notes input updates results, empty state, counts and clearing restores all five', () => {
  const {api,$} = harness();
  const input=$('#notes-query').listeners.input;
  input({target:{value:'no matching note'}});
  assert.match($('#notes-body').innerHTML,/검색 결과가 없습니다\./);
  assert.equal($('#notes-count').textContent,'0개의 메모');
  input({target:{value:''}});
  assert.equal(api.filteredNotes().length,5);
  assert.equal($('#notes-visible-count').textContent,'5');
  assert.equal(($('#notes-body').innerHTML.match(/data-note-id=/g)||[]).length,5);
});

test('Notes production click handler opens the selected result and returns to list', () => {
  const {api,$} = harness();
  const click=$('#app-notes').listeners.click;
  click({target:{closest:selector=>selector==='[data-note-id]'?{dataset:{noteId:'note-playlist'}}:null}});
  assert.equal(api.state.selectedId,'note-playlist');
  click({target:{closest:selector=>selector==='[data-notes-list]'?{}:null}});
  assert.equal(api.state.selectedId,null);
});

test('Notes navigation and searching are read-only; unknown ID is safe', () => {
  const {api,notes} = harness();
  const before=JSON.stringify(notes);
  api.openNote('note-drinks');
  assert.equal(api.openNote('unknown-note'),false);
  assert.equal(api.state.selectedId,'note-drinks');
  api.closeNoteDetail();api.renderNotes('想你');
  assert.equal(JSON.stringify(notes),before);
  assert.equal(new Set(notes.map(n=>n.id)).size,5);
  const fresh=harness();
  assert.equal(fresh.notes.length,5);
  assert.equal(JSON.stringify(fresh.notes),before);
});

test('Notes private draft and original source text remain unchanged', () => {
  const {notes}=harness();
  assert.equal(notes.find(n=>n.id==='note-drinks').body,'조용하고 국물 안주 있는 곳. 다음에 또 가기.');
  assert.equal(notes.find(n=>n.id==='note-playlist').body,"이제야 알겠어\nI'll Be There\nAs You Wish");
  assert.equal(notes.find(n=>n.id==='phone-sim-stage11-private-note').body,'잘 지냈냐는 말은 쉽게 보내면서, 보고 싶었다는 말은 아직도 못 보내겠다. 뭐가 그렇게 어려운 건지.');
  assert.equal(notes.find(n=>n.id==='phone-sim-stage11-private-note').translation,'「最近過得好嗎」這種話可以輕易傳出去，「想你了」卻到現在還是傳不出去。到底有什麼好為難的。');
});

test('Notes detail reserves system bars and a separate scrollable reading area', () => {
  assert.match(html, /#app-notes \.notes-detail\{[^}]*padding-top:max\(40px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(html, /#app-notes \.notes-detail-scroll\{flex:1;min-height:0;overflow-y:auto/);
  assert.match(html, /#app-notes \.notes-detail-footer\{flex:none/);
  assert.match(html, /id="notes-add"[^>]*disabled/);
  assert.match(html, /id="notes-more"[^>]*disabled/);
  assert.ok(!html.includes("prompt('메모 내용을 입력하세요')"));
  assert.ok(!html.includes('renderNotesWithTranslationBase'));
});

test("New initial memo preserves approved text: 셔누 형 메모", () => {
 const {api,$,notes}=harness();
 const note=notes.find(n=>n.id==="note-shownu-reminders");
 assert.equal(note.title,"셔누 형 메모");
 assert.equal(note.body,"하이디라오 소스\n땅콩소스 3 + 다진 마늘 2 + 마라소고기소스 2 + 다진 고기 1 + 양파 2 + 버섯소스 조금\n\n진한 커피 좋아함\n아침에 한 잔 점심 먹고 한 잔\n\n메밀냉면 안 좋아함\n\n신발 사이즈 확인하기\n\n전에 먹고 싶다고 했던 거 뭐였지\n다시 물어보기");
 assert.equal(api.openNote(note.id),true);
 assert.ok($('#notes-detail-content').innerHTML.includes(note.body));
 assert.ok(!$('#notes-detail-content').innerHTML.includes('notes-detail-date'));
 api.closeNoteDetail();
 assert.equal(api.state.selectedId,null);
});

test("New initial memo preserves approved text: 제목 없음", () => {
 const {api,$,notes}=harness();
 const note=notes.find(n=>n.id==="note-untitled-private");
 assert.equal(note.title,"제목 없음");
 assert.equal(note.body,"형 좋아하는 것 같아 아니 그냥 좋아해 언제부터였는지도 모르겠음 애초에 이랬던 건 아닌데 언제 이렇게 된 건지. 오늘 형한테 전화 옴 뭐 특별한 일 있는 건 아니고 그냥 궁금한 거 있어서 전화했다고 함. 넌 어떻게 그런 말을 아무렇지 않게 하냐. 예전엔 나도 아무 생각 없이 전화하고 그랬는데 요즘은 연락 하나 보내는 것도 망설여짐. 답장 늦으면 뭐 하나 신경 쓰이고 연락 오면 또 좋아 죽겠고 나만 이러는 거겠지.\n\n오늘 밥 먹는데 형이 내가 좋아하는 반찬 내 접시에 놔줌. 그걸 아직도 기억하고 있더라고. 별거 아닌데 계속 생각남. 원래 사람 잘 챙기는 성격인 것도 알고 나한테만 그런 거 아닌 것도 아는데 알면서도 자꾸 기대하게 됨. 너는 아무 생각 없이 한 거겠지만 나는 그런 거 하나하나 다 기억하고 있잖아.\n\n네가 잘해 주면 좋은데 가끔은 속상함. 네가 뭘 잘못한 것도 아니고 기대하라고 한 적도 없는데 나 혼자 좋아하고 기대하고 실망하고. 너는 아무것도 모르겠지 말을 안 했으니까 당연히 모름. 근데 가끔은 네가 하는 말이나 행동이 진짜 아무 의미 없는 건지 궁금해짐. 나한테만 조금 다르게 대하는 것 같을 때도 있고 그럴 땐 혹시 너도 나랑 같은 마음인가 싶다가도 그냥 내가 그렇게 보고 싶은 거겠지 싶고. 차라리 확실히 알면 좋겠는데 막상 내 마음 알게 되는 건 무서움. 불편해하면 어떡함 나 피하면 어떡함 지금처럼 못 지내게 되면 어떡함 얼마나 오래 알고 지냈는데 내 마음 하나 때문에 이 관계 틀어지는 건 싫음. 근데 나도 언제까지 아무렇지 않은 척할 수 있을지 모르겠다.\n\n오늘도 좋아한다고 말할 뻔함. 장난스럽게 던지면 될 줄 알았는데 막상 얼굴 보니까 입이 안 떨어짐. 넌 평소처럼 웃고 있었고 나도 따라 웃음. 그때 그냥 뱉어버렸으면 어땠을까.\n\n나 너 좋아함. 진짜 많이 좋아함. 네가 안 좋아해도 괜찮을 줄 알았는데 사실 잘 모르겠음. 나도 네가 날 좋아해 줬으면 좋겠어. 근데 부담은 주고 싶지 않음. 원래 다정하고 잘해 주는 사람인 거 알면서도 자꾸 욕심남. 너한테 내가 조금이라도 특별했으면 좋겠고 가끔은 너도 내 생각 해줬으면 좋겠고 보고 싶어 했으면 좋겠음. 이렇게까지 마음 커질 줄은 몰랐는데.\n\n오늘 형 봤음. 별 얘기도 안 했는데 그냥 좋았어. 집에 와서도 계속 생각남. 보고 싶다 아까 봤는데도.");
 assert.equal(api.openNote(note.id),true);
 assert.ok($('#notes-detail-content').innerHTML.includes(note.body));
 assert.ok(!$('#notes-detail-content').innerHTML.includes('notes-detail-date'));
 api.closeNoteDetail();
 assert.equal(api.state.selectedId,null);
});

test('Both phone screens share the unchanged local turtle wallpaper with cover sizing', () => {
 assert.match(html,/wallpaper: "assets\/turtle-wallpaper.png"/);
 assert.match(html,/center\/cover no-repeat/);
 assert.equal((html.match(/id="wallpaper"/g)||[]).length,1);
 assert.ok(fs.statSync(path.join(__dirname,'../assets/turtle-wallpaper.png')).size>0);
});

test('Home does not cover the shared wallpaper with legacy artwork', () => {
 assert.match(html,/\.home-screen\{padding:59px 20px 112px;background:transparent\}/);
 assert.ok(!/\.home-screen(?:::before)?\{[^}]*background:[^}]*gradient/.test(html));
 assert.ok(!html.includes('serviceWorker.register'));
});
