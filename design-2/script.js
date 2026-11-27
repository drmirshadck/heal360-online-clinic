(function(){
const S=window.SITE,D=S.doctors,$=s=>document.querySelector(s),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dr=d=>d.name.split(' ').slice(0,2).join(' ');
/* three equal heroes */
$('#trio').innerHTML=D.map(d=>`<a class="fig" href="#doctors" data-id="${d.id}"><img src="img/${d.id}.png" alt="${esc(d.name)}"><div class="chip"><b>${esc(d.name)}</b><span>${esc(d.tag)}</span></div></a>`).join('');
/* doctor cards, all the same size */
$('#dgrid').innerHTML=D.map(d=>`<article class="dcard reveal">
  <div class="dpic"><img src="img/${d.id}.png" alt="${esc(d.name)}" loading="lazy"><span class="seal">TCMC<br>${esc(d.reg)}</span></div>
  <div class="dbody"><h3>${esc(d.name)}</h3><p class="q">${esc(d.quals)}</p><p class="r">${esc(d.role)} · ${esc(d.years)}</p>
  <p class="h">${esc(d.hook)}</p>
  <ul>${d.areas.slice(0,4).map(a=>`<li>${esc(a)}</li>`).join('')}</ul>
  <a class="go sm" href="#book" data-book data-doc="${d.id}">Book with ${esc(dr(d))} <i>&#8599;</i></a></div></article>`).join('');
/* until the calendar is connected, booking goes to WhatsApp */
document.addEventListener('click',e=>{const b=e.target.closest('[data-book]');if(!b)return;e.preventDefault();
  if(!(S.helper&&S.helper.url)){e.stopPropagation();const d=D.find(x=>x.id===b.dataset.doc);
    window.open('https://wa.me/'+S.whatsapp+'?text='+encodeURIComponent('Hello Heal 360, I would like to book an online consultation'+(d?' with '+d.name:'')+'.'),'_blank')}},true);
/* nav shadow + reveal */
const hd=$('#top');addEventListener('scroll',()=>hd.classList.toggle('on',scrollY>40),{passive:true});
const io=new IntersectionObserver(en=>en.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach((e,i)=>{e.style.transitionDelay=(i%3)*90+'ms';io.observe(e)});
/* consultation room preview cycles through the doctors */
let k=0;setInterval(()=>{k=(k+1)%D.length;const d=D[k];$('#rdimg').src='img/'+d.id+'.png';$('#rdname').innerHTML=esc(d.name)+'<small>Online now</small>'},3500);
/* hero doctors follow the mouse a little */
const trio=$('#trio');matchMedia('(hover:hover)').matches&&trio.addEventListener('mousemove',e=>{const r=trio.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5;trio.querySelectorAll('.fig img').forEach((im,i)=>im.style.transform=`translateX(${x*(10+i*4)}px)`)});
})();
(function(){const w=document.querySelector('.wa'),f=()=>w.classList.toggle('hide',scrollY<innerHeight*.8);f();addEventListener('scroll',f,{passive:true})})();
/* horizontal pages */
(function(){
const hs=document.getElementById('hs'),P=[...document.querySelectorAll('#hs>main>section')],dots=document.getElementById('dots');
dots.innerHTML=P.map((_,i)=>'<i data-i="'+i+'"></i>').join('');
const W=()=>hs.clientWidth,cur=()=>Math.round(hs.scrollLeft/W());
const go=i=>{i=Math.max(0,Math.min(P.length-1,i));hs.scrollTo({left:i*W(),behavior:'smooth'})};
const mark=()=>{const c=cur();dots.querySelectorAll('i').forEach((d,i)=>d.classList.toggle('on',i===c));
  document.querySelectorAll('#nav a').forEach(a=>{const t=a.getAttribute('href');a.classList.toggle('act',t&&t[0]==='#'&&P[c]&&P[c].id===t.slice(1))});
  P[c]&&P[c].classList.add('seen')};
hs.addEventListener('scroll',mark,{passive:true});mark();
document.getElementById('prv').onclick=()=>go(cur()-1);document.getElementById('nxt').onclick=()=>go(cur()+1);
dots.onclick=e=>{if(e.target.dataset.i)go(+e.target.dataset.i)};
/* menu and in-page links jump to the page */
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a||a.hasAttribute('data-book'))return;
  const id=a.getAttribute('href').slice(1);let i=P.findIndex(p=>p.id===id);if(id==='top')i=0;if(i<0)return;e.preventDefault();go(i);document.getElementById('nav').classList.remove('open')});
/* mouse wheel: scroll inside a page first, then move to the next page */
let lock=0;
hs.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
  const p=P[cur()],up=e.deltaY<0,sc=getComputedStyle(p).overflowY!=='hidden',can=sc&&(up?p.scrollTop>0:p.scrollTop+p.clientHeight<p.scrollHeight-2);
  if(can)return;e.preventDefault();const n=Date.now();if(n-lock<750)return;lock=n;go(cur()+(up?-1:1))},{passive:false});
addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(e.key==='ArrowRight')go(cur()+1);if(e.key==='ArrowLeft')go(cur()-1)});
addEventListener('resize',()=>hs.scrollTo({left:cur()*W(),behavior:'auto'}));
})();
