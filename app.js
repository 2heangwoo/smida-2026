(() => {
  'use strict';
  const TOTAL = 208;
  const PAGE_ASPECT = 606.613 / 802.204;
  const pad = n => String(n).padStart(3,'0');
  const src = n => `pages/page-${pad(n)}.jpg`;
  const $ = id => document.getElementById(id);
  const shell=$('viewerShell'), book=$('book'), leftPage=$('leftPage'), rightPage=$('rightPage'), turnSheet=$('turnSheet');
  const leftImg=leftPage.querySelector('img'), rightImg=rightPage.querySelector('img');
  const frontImg=turnSheet.querySelector('.sheet-front img'), backImg=turnSheet.querySelector('.sheet-back img');
  const loading=$('loading'), indicator=$('pageIndicator'), jump=$('jumpInput');
  let current=1, zoom=1, turning=false, resizeTimer=null;
  let pageW=500,pageH=660;
  const mobile=()=>matchMedia('(max-width:800px)').matches;

  function visiblePages(){
    if(mobile()) return [null,current];
    if(current<=1) return [null,1];
    const l=current%2===0?current:current-1;
    return [l,l+1<=TOTAL?l+1:null];
  }

  function setGeometry(){
    const marginW=mobile()?12:8, marginH=8;
    const availW=Math.max(240,shell.clientWidth-marginW);
    const availH=Math.max(240,shell.clientHeight-marginH);
    const count=mobile()?1:2;
    const maxW=availW/count;
    let w=Math.min(maxW,availH*PAGE_ASPECT)*zoom;
    w=Math.max(120,Math.floor(w));
    const h=Math.floor(w/PAGE_ASPECT);
    pageW=w; pageH=h;
    [leftPage,rightPage,turnSheet].forEach(el=>{el.style.width=w+'px';el.style.height=h+'px'});
    book.style.width=(mobile()?w:w*2)+'px';book.style.height=h+'px';
  }

  function loadInto(img,n){
    return new Promise(resolve=>{
      if(!n){img.removeAttribute('src');resolve();return}
      const done=()=>resolve();
      img.onload=done;img.onerror=done;img.src=src(n);
      if(img.complete) resolve();
    });
  }

  async function render(){
    setGeometry();
    const [l,r]=visiblePages();
    if(mobile()){
      leftPage.style.display='none';rightPage.style.display='block';
      rightPage.style.visibility='visible';
      await loadInto(rightImg,r);
      indicator.textContent=`${r} / ${TOTAL}`;jump.value=r;
    }else{
      leftPage.style.display='block';rightPage.style.display='block';
      if(l){leftPage.style.visibility='visible';await loadInto(leftImg,l)}else{leftPage.style.visibility='hidden';leftImg.removeAttribute('src')}
      if(r){rightPage.style.visibility='visible';await loadInto(rightImg,r)}else{rightPage.style.visibility='hidden';rightImg.removeAttribute('src')}
      indicator.textContent=l?`${l}-${r||l} / ${TOTAL}`:`1 / ${TOTAL}`;jump.value=r||l||1;
    }
    loading.style.display='none';
    preload();
  }

  function preload(){
    const around=mobile()?[current-2,current-1,current+1,current+2]:[current-3,current-2,current+2,current+3,current+4];
    around.filter(n=>n>=1&&n<=TOTAL).forEach(n=>{const im=new Image();im.src=src(n)});
  }

  async function next(){
    if(turning||current>=TOTAL)return;
    turning=true;
    const [l,r]=visiblePages();
    if(mobile()){
      await Promise.all([loadInto(frontImg,current),loadInto(backImg,Math.min(TOTAL,current+1))]);
      turnSheet.style.left='0';turnSheet.style.right='auto';turnSheet.className='turn-sheet turn-next';
      setTimeout(async()=>{current=Math.min(TOTAL,current+1);turnSheet.className='turn-sheet';await render();turning=false},660);
      return;
    }
    if(!r){turning=false;return}
    const nextLeft=Math.min(TOTAL,r+1);
    await Promise.all([loadInto(frontImg,r),loadInto(backImg,nextLeft)]);
    turnSheet.style.left='auto';turnSheet.style.right='0';turnSheet.className='turn-sheet turn-next';
    setTimeout(async()=>{current=(current<=1)?2:Math.min(TOTAL,current+2);turnSheet.className='turn-sheet';await render();turning=false},660);
  }

  async function prev(){
    if(turning||current<=1)return;
    turning=true;
    const [l,r]=visiblePages();
    if(mobile()){
      await Promise.all([loadInto(frontImg,current),loadInto(backImg,Math.max(1,current-1))]);
      turnSheet.style.left='0';turnSheet.style.right='auto';turnSheet.className='turn-sheet turn-prev';
      setTimeout(async()=>{current=Math.max(1,current-1);turnSheet.className='turn-sheet';await render();turning=false},660);
      return;
    }
    const prevRight=(l||2)-1;
    await Promise.all([loadInto(frontImg,l||2),loadInto(backImg,Math.max(1,prevRight))]);
    turnSheet.style.left='0';turnSheet.style.right='auto';turnSheet.className='turn-sheet turn-prev';
    setTimeout(async()=>{current=Math.max(1,current-2);turnSheet.className='turn-sheet';await render();turning=false},660);
  }

  function goTo(n){
    n=Math.max(1,Math.min(TOTAL,Number(n)||1));
    if(!mobile() && n>1) current=n%2===0?n:n-1; else current=n;
    render();
  }

  $('prevBtn').onclick=prev;$('nextBtn').onclick=next;$('leftHotspot').onclick=prev;$('rightHotspot').onclick=next;
  $('zoomInBtn').onclick=()=>{zoom=Math.min(2.25,zoom+.12);render()};
  $('zoomOutBtn').onclick=()=>{zoom=Math.max(.55,zoom-.12);render()};
  $('fitBtn').onclick=()=>{zoom=1;render()};
  $('fullBtn').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
  jump.addEventListener('change',()=>goTo(jump.value));
  jump.addEventListener('keydown',e=>{if(e.key==='Enter'){goTo(jump.value);jump.blur()}});
  addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown')next();if(e.key==='ArrowLeft'||e.key==='PageUp')prev();});
  shell.addEventListener('wheel',e=>{if(e.ctrlKey||Math.abs(e.deltaY)>0){e.preventDefault();zoom=Math.max(.55,Math.min(2.25,zoom+(e.deltaY<0?.08:-.08)));render()}},{passive:false});
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120)});

  // 첫 장만 읽은 뒤 즉시 표시: 외부 CDN/PDF.js가 필요하지 않음.
  const first=new Image();
  first.onload=render;first.onerror=()=>{loading.innerHTML='페이지 이미지를 찾지 못했습니다.<br><small>pages 폴더를 index.html과 함께 두세요.</small>'};first.src=src(1);
})();
