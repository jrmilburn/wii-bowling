import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    const c=canvas.getContext('2d');
    c.fillStyle='#ff0000';c.fillRect(0,0,320,240);
    c.fillStyle='#00ff00';c.fillRect(320,0,320,240);
    c.fillStyle='#0000ff';c.fillRect(0,240,320,240);
    c.fillStyle='#ffffff';c.fillRect(320,240,320,240);
    const stream=canvas.captureStream(30);
    setInterval(()=>stream.getVideoTracks()[0].requestFrame(),50);
    return stream;
  };
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...args){
    if(message.type==='frame'){
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const c=canvas.getContext('2d');c.drawImage(message.bitmap,0,0);
      window.rotationPixel=Array.from(c.getImageData(40,40,1,1).data);
    }
    return post.call(this,message,...args);
  };
});
await page.goto('http://127.0.0.1:4173/');
await page.locator('#start').click();
await page.waitForFunction(()=>window.rotationPixel?.[1]>240,{},{timeout:30000});
assert.deepEqual((await page.evaluate(()=>window.rotationPixel)).slice(0,3),[255,255,255]);
await page.locator('#settings-button').click();
assert.equal(await page.locator('#camera-rotation').isChecked(),true);
await page.locator('#camera-rotation').uncheck();
await page.waitForFunction(()=>window.rotationPixel?.[1]<10&&window.rotationPixel?.[0]>240);
const normalPixel=await page.evaluate(()=>window.rotationPixel);
assert.ok(normalPixel[0]>245&&normalPixel[1]<10&&normalPixel[2]<10); // captureStream can round YUV colours.
await page.reload();await page.locator('#settings-button').click();
assert.equal(await page.locator('#camera-rotation').isChecked(),false);
assert.deepEqual(errors,[]);
console.log('180-degree inference pixels, normal orientation, setting persistence and browser startup passed. Synthetic camera only.');
await browser.close();
