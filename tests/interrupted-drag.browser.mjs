import assert from 'node:assert/strict';
const { chromium } = await import(process.env.BOOK_READER_PLAYWRIGHT_MODULE);
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(process.env.BOOK_READER_DEMO_URL);await page.waitForFunction(()=>window.readerState?.spread===2);
 const startDrag=async()=>{const r=await page.locator('.br-stage').boundingBox();await page.mouse.move(r.x+r.width-4,r.y+4);await page.mouse.down();await page.mouse.move(r.x+r.width*.8,r.y+50,{steps:4});await page.waitForFunction(()=>window.readerState.turning)};
 await startDrag();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.waitForFunction(()=>!window.readerState.turning);assert.equal(await page.evaluate(()=>window.readerState.page),0);
 await page.mouse.up();await page.getByRole('button',{name:'Next page',exact:true}).click();
 await page.waitForFunction(()=>window.readerState.page===2&&!window.readerState.turning);
 await page.evaluate(()=>window.bookReader.goTo(0));
 await startDrag();await page.evaluate(()=>document.querySelector('.br-toolbar button:nth-of-type(2)').click());
 await page.waitForFunction(()=>window.readerState.page===2&&!window.readerState.turning);
 await page.mouse.up();await page.getByRole('button',{name:'Previous page',exact:true}).click();
 await page.waitForFunction(()=>window.readerState.page===0&&!window.readerState.turning);
 await page.evaluate(()=>window.bookReader.destroy());assert.equal(await page.locator('.br-reader').count(),0);
 console.log('Interrupted drag, blur recovery, button recovery, subsequent Previous and disposal passed.');
}finally{await browser.close()}
