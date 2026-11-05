const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { documentFixture } = require('./helpers/voice-dom.cjs');
const tick = () => new Promise(setImmediate);
function load(chain) {
  const document=documentFixture();
  // Static fixture markup only; no transcript or credential enters this parser.
  document.body.innerHTML='<form id="route-form"><select id="chain-select"></select><select id="app-select"></select><div class="field"><input id="account-input"></div></form><p id="status"></p><main id="app"></main>';
  const events={};let mic=0;let requests=0;let tracks=0;let vaultKey='';let record;
  class Recorder { constructor(){record=this;this.state='inactive';this.mimeType='audio/webm';} start(){this.state='recording';} pause(){this.state='paused';} resume(){this.state='recording';} stop(){this.state='inactive';this.ondataavailable({data:new Blob(['fixture'])});this.onstop();} }
  const w={console,document,URLSearchParams,URL,Blob,TextEncoder,TextDecoder,AbortController,
    FormData:class{constructor(){this.map=new Map();}append(k,v){this.map.set(k,v);}get(k){return this.map.get(k);}},
    Event:class{constructor(type,opt={}){this.type=type;Object.assign(this,opt);}preventDefault(){}},
    location:{hash:'#chain='+chain+'&app=editor',origin:'https://example.test',hostname:'example.test',pathname:'/'},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){},key:()=>null,length:0},
    navigator:{mediaDevices:{getUserMedia:async()=>{mic++;return {getTracks:()=>[{stop(){tracks++;}}]};}}},MediaRecorder:Recorder,
    addEventListener:(name,fn)=>(events[name] ||= []).push(fn),removeEventListener:(name,fn)=>{events[name]=(events[name]||[]).filter(x=>x!==fn);},
    setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},requestAnimationFrame:fn=>fn(),confirm:()=>true,
    DposVoiceStore:{read:async()=>null,write:async()=>{}},
    DposVault:{status:()=>({state:'unlocked'}),getServiceKey:async()=>vaultKey,setServiceKey:async(_,key)=>{vaultKey=key;},deleteServiceKey:async()=>{vaultKey='';}},
    DposAuth:{getUsers:()=>[],getCurrentUser:()=>null,getCurrentLogin:()=>'',getUserLogin:()=>'',getUserType:()=> 'standard'},
    DposBroadcast:{},DposProfiles:{formatError:e=>e.message},DposHistory:{},
    fetch:async()=>{requests++;return {ok:true,json:async()=>({text:'<img src=x onerror=alert(1)> DPoS Space'})};}
  };
  w.window=w;vm.createContext(w);
  for(const name of ['chains','native-bridge','voice-input','voice-ui','app'])vm.runInContext(fs.readFileSync('v3/js/'+name+'.js','utf8'),w,{filename:name+'.js'});
  return {w,document,events,counts:()=>({mic,requests,tracks}),record:()=>record};
}
(async()=>{
  for(const chain of ['golos','steem','hive']){
    const {w,document:d,counts}=load(chain);await tick();await tick();
    const main=d.getElementById('app');
    const tabs=main.querySelector('[role="tablist"]');assert(tabs,chain+': real route mounts voice tabs; '+main.textContent);
    const first=d.getElementById('voice-editor-tab'),second=d.getElementById('voice-input-tab');
    const voice=d.getElementById('voice-input-panel');assert(voice.hidden);assert.equal(first.getAttribute('aria-selected'),'true');
    const modal=d.getElementById('editor-operation-details');assert.equal(modal.getAttribute('role'),'dialog');
    const body=d.getElementById('editor-body');const originalForm=d.getElementById('editor-form');
    body.value='existing draft';body.setSelectionRange(8,8);body.dispatchEvent({type:'select'});
    d.getElementById('editor-title').value='Keep title';d.getElementById('editor-tags').value='keep tags';
    let submits=0;originalForm.addEventListener('submit',()=>submits++);
    assert.equal(counts().mic,0,'no permission on mount');
    first.focus();tabs.dispatchEvent({type:'keydown',key:'End',preventDefault(){}});assert.equal(d.activeElement,second);assert(!voice.hidden);
    tabs.dispatchEvent({type:'keydown',key:'Home',preventDefault(){}});assert.equal(d.activeElement,first);second.click();
    const byText=text=>voice.querySelectorAll('button').find(n=>n.textContent===text);
    const key=voice.querySelector('input[type="password"]');key.value='gsk_fixture_fake_key_123456';
    byText('Сохранить настройки').click();await tick();assert.equal(key.value,'');
    assert.equal(d.getElementById('editor-form'),originalForm,'inline settings preserve original form and draft');
    byText('Начать запись').click();await tick();assert.equal(counts().mic,1);byText('Остановить запись').click();await tick();
    assert.equal(counts().requests,0,'stop does not charge');
    const visiblePrimary=voice.children.find(n=>n.tagName==='DIV').children.filter(n=>!n.hidden).map(n=>n.textContent);
    assert.deepEqual(visiblePrimary,['Удалить','Распознать']);
    byText('Распознать').click();byText('Распознать').click();await tick();await tick();assert.equal(counts().requests,1);
    const preview=voice.querySelector('textarea');assert(preview.value.includes('<img'));assert.equal(voice.querySelectorAll('img').length,0,'transcript never enters HTML parser');
    preview.value='edited voice';preview.dispatchEvent({type:'input'});
    const transfer=byText('Перенести в редактор');transfer.click();transfer.click();
    assert.equal(body.value,'existing\n\nedited voice\n\n draft');assert.equal(d.getElementById('editor-title').value,'Keep title');assert.equal(d.getElementById('editor-tags').value,'keep tags');
    assert.equal(submits,0);assert.equal(d.activeElement,body);assert(!modal.hidden,'explicit transfer opens existing publication modal');
    assert.equal(counts().tracks,1);
    modal.querySelector('[data-app-modal-close]').click();
    assert.equal(d.activeElement,first,'closing the editor after voice transfer returns focus to the visible editor tab');
    assert.equal(first.disabled,false);
  }
  const globalSettings=load('hive'); await tick();
  globalSettings.w.location.hash='#app=voice-settings';await globalSettings.w.DposV3.renderRoute();await tick();
  assert(globalSettings.document.getElementById('app').textContent.includes('Настройки: Голосовой ввод и ИИ'));
  assert.equal(globalSettings.counts().mic,0);
  console.log('voice UI real app route checks passed: Golos, Steem, Hive');
})().catch(e=>{console.error(e);process.exitCode=1;});
