(function(){
const S=window.SITE,D=S.doctors,$=s=>document.querySelector(s);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* three equal heroes */
$('#trio').innerHTML=D.map(d=>`
<a class="hero-card" href="#doctors" data-doc="${d.id}" aria-label="${esc(d.name)}">
  <img src="${d.photo}" alt="${esc(d.name)}, ${esc(d.quals)}" loading="eager">
  <div class="hc-info"><span class="hc-tag">${esc(d.tag)}</span>
  <h3>${esc(d.name)}</h3><p>${esc(d.quals)}</p>
  <span class="hc-go">Meet ${esc(d.name.split(' ').slice(0,2).join(' '))} →</span></div>
</a>`).join('');

/* tabs + panel */
let cur=D[0].id;
function tabs(){
  $('#tabs').innerHTML=D.map(d=>`<button class="tab" role="tab" aria-selected="${d.id===cur}" data-id="${d.id}"><img src="${d.photo}" alt=""><span>${esc(d.name)}</span></button>`).join('');
}
function stag(){document.querySelectorAll('#panel .p-body>*').forEach((el,i)=>el.style.setProperty('--k',i));document.querySelectorAll('#panel .chips span').forEach((el,i)=>el.style.setProperty('--i',i))}
function panel(){
  const d=D.find(x=>x.id===cur);
  $('#panel').innerHTML=`
  <div class="p-img"><img src="${d.photo}" alt="${esc(d.name)}"></div>
  <div class="p-body">
    <span class="badge">● Online consultations open</span>
    <h3>${esc(d.name)}</h3>
    <div class="quals">${esc(d.quals)}</div>
    <div class="role">${esc(d.role)}</div>
    <p class="hook">${esc(d.hook)}</p>
    ${d.bio.map(p=>`<p>${esc(p)}</p>`).join('')}
    <div class="chips">${d.areas.map(a=>`<span>${esc(a)}</span>`).join('')}</div>
    <p class="vision">${esc(d.vision)}</p>
    <a class="btn" href="#book" data-book data-doc="${d.id}">Book with ${esc(d.name.split(' ').slice(0,2).join(' '))}</a>
    <div class="meta"><span>${esc(d.years)} of experience</span><span>TCMC Reg. No. ${esc(d.reg)}</span></div>
  </div>`;stag();
}
function pick(id,scroll){cur=id;tabs();panel();if(scroll)document.getElementById('doctors').scrollIntoView({behavior:'smooth'});}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b){stopAuto();pick(b.dataset.id)}});
/* doctors change by themselves; stops once the visitor touches the section */
let auto=true;const stopAuto=()=>{auto=false};
const dsec=document.getElementById('doctors');let inView=false;
new IntersectionObserver(en=>{inView=en[0].isIntersecting},{threshold:.25}).observe(dsec);
['pointerdown','touchstart','keydown','wheel'].forEach(ev=>dsec.addEventListener(ev,stopAuto,{passive:true}));
setInterval(()=>{if(!auto||!inView||document.hidden||document.body.classList.contains('intro'))return;const i=D.findIndex(d=>d.id===cur);pick(D[(i+1)%D.length].id)},6500);
$('#trio').addEventListener('click',e=>{const c=e.target.closest('.hero-card');if(c){e.preventDefault();pick(c.dataset.doc,true)}});
tabs();panel();

/* booking: booking.js opens the calendar for any [data-book] button */
document.addEventListener('click',e=>{const b=e.target.closest('[data-book]');if(!b)return;e.preventDefault();
  /* until the calendar helper is connected, booking requests go to the clinic WhatsApp */
  if(!(S.helper&&S.helper.url)){e.stopPropagation();const d=D.find(x=>x.id===b.dataset.doc);
    window.open('https://wa.me/'+S.whatsapp+'?text='+encodeURIComponent('Hello Heal 360, I would like to book an online consultation'+(d?' with '+d.name:'')+'.'),'_blank')}},true);

/* header + reveal */
const top=$('#top');addEventListener('scroll',()=>top.classList.toggle('scrolled',scrollY>8),{passive:true});
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>$('#nav').classList.remove('open')));
const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.12});
const startReveal=()=>document.querySelectorAll('.reveal,.hero-card').forEach(el=>io.observe(el));
const sp=document.getElementById('splash');
if(sp&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  document.body.classList.add('intro');
  let done=false;
  const end=()=>{if(done)return;done=true;sp.classList.add('out');document.body.classList.remove('intro');startReveal();setTimeout(()=>sp.remove(),1000)};
  sp.addEventListener('click',end);setTimeout(end,3100);
}else{if(sp)sp.remove();startReveal();}

/* ===== motion extras ===== */
const prog=document.getElementById('prog');
const onScroll=()=>{const h=document.documentElement.scrollHeight-innerHeight;prog.style.transform='scaleX('+(h>0?scrollY/h:0)+')'};
addEventListener('scroll',onScroll,{passive:true});onScroll();
/* stagger siblings */
document.querySelectorAll('.cards,.step-row,.faq .narrow').forEach(g=>[...g.children].forEach((el,i)=>{el.style.transitionDelay=(i*110)+'ms'}));
document.querySelectorAll('.cards .card').forEach((c,i)=>c.classList.add(i%2?'from-r':'from-l'));
/* count up */
const cio=new IntersectionObserver(es=>es.forEach(x=>{if(!x.isIntersecting)return;cio.unobserve(x.target);const el=x.target,to=+el.dataset.to,t0=performance.now();
  (function f(t){const p=Math.min(1,(t-t0)/1600),e=1-Math.pow(1-p,3);el.textContent=Math.round(to*e);if(p<1)requestAnimationFrame(f)})(t0)}),{threshold:.6});
document.querySelectorAll('.cnt').forEach(el=>{el.textContent='0';cio.observe(el)});
/* tilt + spotlight on hero cards */
if(matchMedia('(hover:hover)').matches){
  document.querySelectorAll('.hero-card').forEach(c=>{
    c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      c.style.setProperty('--mx',x*100+'%');c.style.setProperty('--my',y*100+'%');
      c.style.transform='perspective(900px) rotateY('+((x-.5)*10)+'deg) rotateX('+((.5-y)*8)+'deg) translateY(-8px)'});
    c.addEventListener('mouseleave',()=>{c.style.transform=''});
  });
}
/* hero blobs follow scroll slightly */
const bl=document.querySelectorAll('.blob');
addEventListener('scroll',()=>{const y=scrollY*.15;bl.forEach((b,i)=>b.style.marginTop=(i%2?-y:y)+'px')},{passive:true});
})();
