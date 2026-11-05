// Minimal DOM fixture for exercising the real vanilla app entry point in Node.
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, value => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[value]));
class Node {
  constructor(tag, document, text = '') { this.tagName=tag.toUpperCase(); this.ownerDocument=document; this.nodeType=tag==='#text'?3:1; this._text=text; this.childNodes=[]; this.attrs={}; this.dataset={}; this.listeners={}; this.style={}; this.hidden=false; this.disabled=false; this._value=undefined; this.selectionStart=0; this.selectionEnd=0; }
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get parentElement(){return this.parentNode;}
  get isConnected(){return this===this.ownerDocument || Boolean(this.parentNode && this.parentNode.isConnected);}
  get id(){return this.attrs.id||'';} set id(v){this.attrs.id=v;}
  get className(){return this.attrs.class||'';} set className(v){this.attrs.class=v;}
  get classList(){const node=this; return { forEach(fn){node.className.split(/\s+/).filter(Boolean).forEach(fn);},add(...names){node.className=[node.className,...names].join(' ');},remove(name){node.className=node.className.split(' ').filter(x=>x!==name).join(' ');},contains(name){return node.className.split(' ').includes(name);},toggle(name,on){if(on)this.add(name);else this.remove(name);}};}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
  setAttribute(k,v){this.attrs[k]=String(v); if(k==='hidden')this.hidden=true; if(k==='disabled')this.disabled=true; if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v);}
  getAttribute(k){return this.attrs[k]??null;} hasAttribute(k){return Object.hasOwn(this.attrs,k);} removeAttribute(k){delete this.attrs[k];}
  get textContent(){return this._text+this.childNodes.map(n=>n.textContent).join('');} set textContent(v){this.childNodes=[];this._text=String(v);}
  get value(){if(this._value!==undefined)return this._value;if(this.tagName==='TEXTAREA')return this.textContent;if(this.tagName==='SELECT'){const opts=this.querySelectorAll('option');return (opts.find(o=>o.hasAttribute('selected'))||opts[0]||{}).value||'';}return this.attrs.value||'';} set value(v){this._value=String(v);}
  get innerHTML(){return this.childNodes.map(n=>n.textContent).join('');}
  set innerHTML(html){this.replaceChildren(); const stack=[this];const voids=['INPUT','IMG','BR','HR','META','LINK'];
    for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){if(token.startsWith('<!--'))continue;
      if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
      if(token.startsWith('<')){const match=token.match(/^<([\w-]+)/);if(!match)continue;const n=new Node(match[1],this.ownerDocument);const attrs=token.slice(match[0].length,-1);for(const a of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))n.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));stack.at(-1).appendChild(n);if(!voids.includes(n.tagName)&&!token.endsWith('/>'))stack.push(n);
      }else stack.at(-1).appendChild(new Node('#text',this.ownerDocument,decode(token)));
    }
  }
  appendChild(n){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
  append(...nodes){nodes.forEach(n=>this.appendChild(n));} prepend(...nodes){nodes.reverse().forEach(n=>{if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.unshift(n);});}
  insertBefore(n,before){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(before),0,n);}
  removeChild(n){this.childNodes.splice(this.childNodes.indexOf(n),1);n.parentNode=null;}
  replaceChildren(...nodes){this.childNodes.forEach(n=>n.parentNode=null);this.childNodes=[];this._text='';this.append(...nodes);}
  replaceWith(n){const p=this.parentNode;p.insertBefore(n,this);p.removeChild(this);} remove(){if(this.parentNode)this.parentNode.removeChild(this);}
  addEventListener(k,fn){(this.listeners[k] ||= []).push(fn);} removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==fn);}
  dispatchEvent(event){event.target ||= this;event.currentTarget=this;for(const fn of this.listeners[event.type]||[])fn(event);if(event.bubbles && this.parentNode)this.parentNode.dispatchEvent(event);return true;}
  click(){if(!this.disabled)this.dispatchEvent({type:'click',target:this,bubbles:true,preventDefault(){}});} focus(){this.ownerDocument.activeElement=this;}
  setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
  matches(selector){selector=selector.trim();if(selector==='*')return true;if(selector.includes(':not(')){const [base,not]=selector.split(':not(');return this.matches(base)&&!this.matches(not.slice(0,-1));}const tag=selector.match(/^[\w-]+/);if(tag&&this.tagName!==tag[0].toUpperCase())return false;const id=selector.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;for(const c of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(c[1]))return false;for(const a of selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/g)){if(!this.hasAttribute(a[1]))return false;if(a[2]!==undefined&&this.getAttribute(a[1])!==a[2])return false;}return Boolean(tag||id||selector.includes('.')||selector.includes('['));}
  querySelectorAll(selector){if(selector.includes(','))return [...new Set(selector.split(',').flatMap(s=>this.querySelectorAll(s)))];if(selector.startsWith(':scope > '))return this.children.filter(n=>n.matches(selector.slice(9)));const found=[];function walk(n){n.children.forEach(c=>{if(c.matches(selector))found.push(c);walk(c);});}walk(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;} closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
  contains(node){return node===this||this.childNodes.some(n=>n.contains(node));}
}
function documentFixture(){const doc=new Node('document',null);doc.ownerDocument=doc;doc.body=new Node('body',doc);doc.head=new Node('head',doc);doc.append(doc.head,doc.body);doc.createElement=tag=>new Node(tag,doc);doc.createTextNode=text=>new Node('#text',doc,text);doc.getElementById=id=>doc.querySelector('#'+id);return doc;}
module.exports={documentFixture};
