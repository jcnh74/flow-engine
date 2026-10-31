// Headless Chrome capture helper (separate profile; does not touch your normal browser). Usage: node scripts/headless-capture.mjs <url> <secs,secs> <outPrefix>
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [,, url, plan, outPrefix] = process.argv; // plan: "0,10,30"
const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new','--user-data-dir=' + (process.env.CDP_PROFILE || '/tmp/flow-engine-cdp'),'--remote-debugging-port=9333','--window-size=1920,1080','--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'], { stdio: 'ignore' });
fs.writeFileSync((process.env.PID_FILE || '/tmp/flow-engine-cdp.pid'), String(chrome.pid));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 50; i++) { try { ver = await (await fetch('http://127.0.0.1:9333/json/list')).json(); break; } catch { await sleep(200); } }
const page = ver.find(t => t.type === 'page'); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url }); const t0 = Date.now();
for (const s of plan.split(',').map(Number)) { const w = t0 + s * 1000 + 2500 - Date.now(); if (w > 0) await sleep(w);
  const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${outPrefix}_${String(s).padStart(2,'0')}s.png`, Buffer.from(r.result.data, 'base64')); console.log('grab', s); }
const ev = await send('Runtime.evaluate', { expression: 'document.title' }); console.log('title', ev.result?.result?.value);
chrome.kill(); process.exit(0);
