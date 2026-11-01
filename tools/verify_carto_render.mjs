import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--remote-debugging-port=9455',
  '--user-data-dir=C:\\Users\\HolyX\\AppData\\Local\\Temp\\chrome-carto-verify',
  '--headless=new',
  '--use-gl=angle',
  '--enable-webgl',
  '--window-size=1600,1000',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const version = await new Promise((res) => {
      http.get('http://127.0.0.1:9455/json/version', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      });
    });
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 1;
    const send = (ws, method, params = {}) => new Promise(res => {
      const curId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) { ws.removeEventListener('message', handler); res(msg); }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    const { result: { targetId } } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const pageWs = new WebSocket('ws://127.0.0.1:9455/devtools/page/' + targetId);
    await new Promise(r => pageWs.onopen = r);

    pageWs.addEventListener('message', e => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
      }
    });

    await send(pageWs, 'Page.enable');
    await send(pageWs, 'Runtime.enable');

    console.log('Navigating to http://127.0.0.1:5173/TravelMap/ ...');
    await send(pageWs, 'Page.navigate', { url: 'http://127.0.0.1:5173/TravelMap/' });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll into live-cams-section
    console.log('Scrolling to live-cams-section...');
    await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('live-cams-section');
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()`
    });

    // Wait 5 seconds for MapLibre and CARTO tiles to load
    await new Promise(r => setTimeout(r, 5000));

    // Check status of __maplibreMap and camera count
    const mapInfo = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const map = window.__maplibreMap;
        if (!map) return { map: false };
        const src = map.getSource('cameras-geojson');
        return {
          map: true,
          loaded: map.loaded(),
          center: map.getCenter(),
          zoom: map.getZoom(),
          hasSource: !!src,
          featureCount: src?._data?.features?.length || 0
        };
      })()`,
      returnByValue: true
    });
    console.log('Map info:', mapInfo?.result?.result?.value);

    // Capture global view screenshot
    const shot1 = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/screenshot_global.png', Buffer.from(shot1.result.data, 'base64'));
    console.log('Saved tools/screenshot_global.png');

    // Pan/Zoom to North America
    await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const map = window.__maplibreMap;
        if (map) {
          map.jumpTo({ center: [-98, 39], zoom: 3.8 });
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 3000));
    const shot2 = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/screenshot_na.png', Buffer.from(shot2.result.data, 'base64'));
    console.log('Saved tools/screenshot_na.png');

    // Pan/Zoom to Europe & France
    await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const map = window.__maplibreMap;
        if (map) {
          map.jumpTo({ center: [6, 48], zoom: 4.5 });
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 3000));
    const shot3 = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/screenshot_europe.png', Buffer.from(shot3.result.data, 'base64'));
    console.log('Saved tools/screenshot_europe.png');

    // Zoom into US East Coast / Midwest (Kansas City or Savannah or Denver)
    await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const map = window.__maplibreMap;
        if (map) {
          map.jumpTo({ center: [-81.0912, 32.0809], zoom: 13.5 });
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 3500));
    const shot4 = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/screenshot_hud.png', Buffer.from(shot4.result.data, 'base64'));
    console.log('Saved tools/screenshot_hud.png');

  } catch (e) {
    console.error('Error:', e);
  } finally {
    chromeProc.kill();
    process.exit(0);
  }
}, 2000);
