const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const qs = new URLSearchParams(location.search);
const PDF_URL = qs.get('pdf') || 'book.pdf';
const SAMPLE = qs.get('sample') === '1';

const shell = document.getElementById('viewerShell');
const book = document.getElementById('book');
const leftPage = document.getElementById('leftPage');
const rightPage = document.getElementById('rightPage');
const turnPage = document.getElementById('turnPage');
const loading = document.getElementById('loading');
const pageIndicator = document.getElementById('pageIndicator');
const downloadBtn = document.getElementById('downloadBtn');
downloadBtn.href = PDF_URL;

let pdf = null;
let current = 1; // desktop: left page number; page 1 is cover on right
let zoom = 1;
let baseW = 606.613, baseH = 802.204;
let turning = false;
let resizeTimer;

const mobile = () => window.matchMedia('(max-width:800px)').matches;

async function loadPdf(){
  try{
    loading.textContent = 'PDF 불러오는 중…';
    const task = pdfjsLib.getDocument({url: PDF_URL, rangeChunkSize: 1024 * 1024, disableAutoFetch: false, disableStream: false});
    task.onProgress = ({loaded,total}) => {
      if(total){ loading.textContent = `PDF 불러오는 중… ${Math.round(loaded/total*100)}%`; }
    };
    pdf = await task.promise;
    const p1 = await pdf.getPage(1);
    const vp = p1.getViewport({scale:1});
    baseW = vp.width; baseH = vp.height;
    loading.style.display='none';
    await renderSpread();
  }catch(err){
    console.error(err);
    loading.innerHTML = 'PDF를 불러오지 못했습니다.<br><small>웹서버에서 열었는지, PDF 파일명이 맞는지 확인하세요.</small>';
  }
}

function spreadPages(){
  if(mobile()) return [null, current];
  if(current <= 1) return [null, 1];
  const left = current % 2 === 0 ? current : current - 1;
  return [left, left + 1 <= pdf.numPages ? left + 1 : null];
}

function fitScale(){
  const gap = mobile() ? 0 : 2;
  const availW = shell.clientWidth - 10;
  const availH = shell.clientHeight - 10;
  const pages = mobile() ? 1 : 2;
  return Math.min(availH/baseH, (availW-gap)/(baseW*pages));
}

function setBookGeometry(){
  const s = fitScale() * zoom;
  const w = Math.max(120, Math.floor(baseW*s));
  const h = Math.max(160, Math.floor(baseH*s));
  [leftPage,rightPage,turnPage].forEach(el=>{el.style.width=w+'px';el.style.height=h+'px'});
  book.style.width = (mobile()? w : w*2)+'px';
  book.style.height = h+'px';
}

async function renderPage(num, holder){
  const canvas = holder.querySelector('canvas');
  if(!num){
    const ctx=canvas.getContext('2d'); canvas.width=2;canvas.height=2;ctx.clearRect(0,0,2,2);holder.style.visibility='hidden';return;
  }
  holder.style.visibility='visible';
  const page = await pdf.getPage(num);
  const cssScale = (holder.clientWidth || baseW) / baseW;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  const vp = page.getViewport({scale: cssScale*dpr});
  canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
  const ctx = canvas.getContext('2d',{alpha:false});
  await page.render({canvasContext:ctx,viewport:vp}).promise;
}

async function renderSpread(){
  if(!pdf) return;
  setBookGeometry();
  const [l,r] = spreadPages();
  if(mobile()){
    leftPage.style.display='none'; rightPage.style.display='flex';
    await renderPage(r,rightPage);
    pageIndicator.textContent = `${r || current} / ${pdf.numPages}`;
  }else{
    leftPage.style.display='flex';rightPage.style.display='flex';
    await Promise.all([renderPage(l,leftPage),renderPage(r,rightPage)]);
    pageIndicator.textContent = l ? `${l}-${r || l} / ${pdf.numPages}` : `1 / ${pdf.numPages}`;
  }
  preloadAround();
}

async function preloadAround(){
  const nums = mobile() ? [current-1,current+1] : [current-2,current+2,current+3];
  nums.filter(n=>n>=1&&n<=pdf.numPages).forEach(n=>pdf.getPage(n).catch(()=>{}));
}

async function copyCanvas(src,dst){
  dst.width=src.width;dst.height=src.height;
  dst.getContext('2d').drawImage(src,0,0);
}

async function next(){
  if(!pdf || turning) return;
  const step = mobile()?1:2;
  const max = pdf.numPages;
  if((mobile() && current>=max) || (!mobile() && current>=max-((max+1)%2))) return;
  turning=true;
  const source = mobile()?rightPage:rightPage;
  await copyCanvas(source.querySelector('canvas'),turnPage.querySelector('canvas'));
  turnPage.style.left = mobile() ? '0' : 'auto';
  turnPage.style.right = '0';
  turnPage.className='turn-page turn-next';
  setTimeout(async()=>{
    current = mobile()? Math.min(max,current+1) : (current<=1?2:Math.min(max,current+2));
    turnPage.className='turn-page';
    await renderSpread(); turning=false;
  },460);
}

async function prev(){
  if(!pdf || turning) return;
  if(current<=1) return;
  turning=true;
  const source = mobile()?rightPage:leftPage;
  await copyCanvas(source.querySelector('canvas'),turnPage.querySelector('canvas'));
  turnPage.style.left='0';turnPage.style.right='auto';
  turnPage.className='turn-page turn-prev';
  setTimeout(async()=>{
    current = mobile()?Math.max(1,current-1):Math.max(1,current-2);
    turnPage.className='turn-page';
    await renderSpread();turning=false;
  },460);
}

document.getElementById('prevBtn').onclick=prev;
document.getElementById('nextBtn').onclick=next;
document.getElementById('leftHotspot').onclick=prev;
document.getElementById('rightHotspot').onclick=next;
document.getElementById('zoomInBtn').onclick=()=>{zoom=Math.min(2.2,zoom+0.12);renderSpread()};
document.getElementById('zoomOutBtn').onclick=()=>{zoom=Math.max(.55,zoom-.12);renderSpread()};
document.getElementById('fitBtn').onclick=()=>{zoom=1;renderSpread()};
document.getElementById('fullBtn').onclick=()=>{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()};
window.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown')next();if(e.key==='ArrowLeft'||e.key==='PageUp')prev();});
shell.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom=Math.max(.55,Math.min(2.2,zoom+(e.deltaY<0?.08:-.08)));renderSpread()}},{passive:false});
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderSpread,150)});

loadPdf();
