import assert from 'node:assert/strict';
const { chromium } = await import(process.env.BOOK_READER_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(process.env.BOOK_READER_DEMO_URL);await page.waitForFunction(()=>window.bookReader);
 await page.evaluate(async()=>{
  window.bookReader.destroy();const {BookReader}=await import('/dist/index.js');let first=0;
  const source={pageCount:10,size:{width:600,height:800},async renderPage(index,node,{width,signal}){
   const delay=first++<2?10:700;
   await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))},{once:true});});
   signal.throwIfAborted();node.textContent=`Page ${index}: ${Math.round(width)}`;
  }};
  window.bookReader=new BookReader(document.querySelector('#reader'),source,{onStateChange:state=>{window.readerState=state}});
 });
 await page.waitForFunction(()=>document.querySelectorAll('.br-stage > .br-page[aria-busy=false]').length===2);
 const old=await page.locator('.br-stage').innerText();
 await page.evaluate(()=>window.bookReader.setZoom(1.25));await page.waitForTimeout(250);
 assert.equal(await page.locator('.br-stage').innerText(),old,'Zoom replaced readable content with a loading state');
 await page.evaluate(()=>window.bookReader.setZoom(1.5));await page.waitForTimeout(200);
 await page.evaluate(()=>window.bookReader.setZoom(1.25));await page.waitForTimeout(250);
 assert.equal(await page.locator('.br-stage > .br-page[aria-busy=true]').count(),0,'Stale zoom mounted incomplete pages');
 await page.waitForFunction(previous=>document.querySelector('.br-stage').innerText!==previous,old);
 assert.equal(await page.evaluate(()=>window.readerState.zoom),1.25);
 await page.evaluate(()=>{window.bookReader.setZoom(2);window.bookReader.destroy()});await page.waitForTimeout(900);
 assert.equal(await page.locator('.br-reader').count(),0);
 console.log('Zoom retained readable pages during slow rendering; repeated zoom and disposal passed.');
}finally{await browser.close()}
