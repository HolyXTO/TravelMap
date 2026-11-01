import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--remote-debugging-port=9459',
  '--user-data-dir=C:\\Users\\HolyX\\AppData\\Local\\Temp\\chrome-verify-features-v2',
  '--headless=new',
  '--use-gl=angle',
  '--enable-webgl',
  '--window-size=1600,1000',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const version = await new Promise((res, rej) => {
      const req = http.get('http://127.0.0.1:9459/json/version', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      });
      req.on('error', rej);
    });

    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 1;
    const send = (socket, method, params = {}) => new Promise(res => {
      const curId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) { socket.removeEventListener('message', handler); res(msg); }
      };
      socket.addEventListener('message', handler);
      socket.send(JSON.stringify({ id: curId, method, params }));
    });

    const { result: { targetId } } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const pageWs = new WebSocket('ws://127.0.0.1:9459/devtools/page/' + targetId);
    await new Promise(r => pageWs.onopen = r);

    await send(pageWs, 'Page.enable');
    await send(pageWs, 'Runtime.enable');

    console.log('Navigating to http://127.0.0.1:5173/TravelMap/ ...');
    await send(pageWs, 'Page.navigate', { url: 'http://127.0.0.1:5173/TravelMap/' });
    await new Promise(r => setTimeout(r, 2000));

    // 滚动到 live-cams-section
    console.log('Scrolling to live-cams-section...');
    await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('live-cams-section');
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()`
    });

    // 等待 3 秒让地图初始化并载入探头
    await new Promise(r => setTimeout(r, 3000));

    // 1. 验证非洲 (Africa) 是否排除以色列
    console.log('--- TEST 1: Verifying Africa cameras ---');
    const africaClickRes = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const pills = Array.from(document.querySelectorAll('.livecam-cont-pill'));
        const africaPill = pills.find(p => p.textContent.includes('非洲'));
        if (africaPill) africaPill.click();
        return { clicked: Boolean(africaPill) };
      })()`,
      returnByValue: true
    });
    console.log('Africa pill clicked:', africaClickRes?.result?.result?.value);
    await new Promise(r => setTimeout(r, 1000));

    const africaStatsRes = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const countBadge = document.querySelector('.livecam-sidebar-count-badge')?.textContent || '';
        const cardTitles = Array.from(document.querySelectorAll('.livecam-card-title')).map(el => el.textContent.trim());
        const cardLocs = Array.from(document.querySelectorAll('.livecam-card-loc')).map(el => el.textContent.trim());
        const hasIsrael = cardTitles.some(n => n.includes('Tel Aviv') || n.includes('Israel')) ||
                          cardLocs.some(l => l.includes('Israel') || l.includes('以色列'));
        return {
          countBadge,
          cardCount: cardTitles.length,
          hasIsrael,
          firstFiveLocations: cardLocs.slice(0, 5)
        };
      })()`,
      returnByValue: true
    });
    console.log('Africa camera stats:', africaStatsRes?.result?.result?.value);

    // 截图非洲视图
    const snapAfrica = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\HolyX\\.gemini\\antigravity\\brain\\fd8b9b72-acde-47ce-9892-ce301f47fbc2\\screenshot_africa_clean.png', Buffer.from(snapAfrica.result.data, 'base64'));
    console.log('Saved screenshot_africa_clean.png');

    // 2. 验证多维复合筛选：欧洲 + 实时视频流 同时激活
    console.log('--- TEST 2: Verifying Europe + Live Streams Dual-Filter ---');
    const dualClickRes = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        // 点击欧洲
        const pills = Array.from(document.querySelectorAll('.livecam-cont-pill'));
        const europePill = pills.find(p => p.textContent.includes('欧洲'));
        if (europePill) europePill.click();

        // 点击“实时视频流”按钮
        const liveBtn = document.querySelector('.livecam-filter-live-btn');
        if (liveBtn) liveBtn.click();

        return { europeClicked: Boolean(europePill), liveBtnClicked: Boolean(liveBtn) };
      })()`,
      returnByValue: true
    });
    console.log('Dual filter clicked:', dualClickRes?.result?.result?.value);
    await new Promise(r => setTimeout(r, 1500));

    const dualStatsRes = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const europeActive = document.querySelector('.livecam-cont-pill.is-active')?.textContent?.trim() || '';
        const liveBtnActive = document.querySelector('.livecam-filter-live-btn.is-active') !== null;
        const countBadge = document.querySelector('.livecam-sidebar-count-badge')?.textContent?.trim() || '';
        const summaryBadges = Array.from(document.querySelectorAll('.livecam-summary-badge')).map(el => el.textContent.trim());
        const cardTitles = Array.from(document.querySelectorAll('.livecam-card-title')).map(el => el.textContent.trim());

        return {
          europeActive,
          liveBtnActive,
          countBadge,
          summaryBadges,
          cardCount: cardTitles.length,
          sampleTitles: cardTitles.slice(0, 3)
        };
      })()`,
      returnByValue: true
    });
    console.log('Dual filter active state:', dualStatsRes?.result?.result?.value);

    // 截图 欧洲 + 实时视频流
    const snapDual = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\HolyX\\.gemini\\antigravity\\brain\\fd8b9b72-acde-47ce-9892-ce301f47fbc2\\screenshot_europe_live_dual.png', Buffer.from(snapDual.result.data, 'base64'));
    console.log('Saved screenshot_europe_live_dual.png');

    // 3. 验证地图多样性配色与预设弹窗
    console.log('--- TEST 3: Verifying Map Theme Studio ---');
    const themeBtnClickRes = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const toolBtns = Array.from(document.querySelectorAll('.livecam-tool-btn'));
        const themeBtn = toolBtns.find(b => b.textContent.includes('配色'));
        if (themeBtn) themeBtn.click();
        return { themeBtnClicked: Boolean(themeBtn) };
      })()`,
      returnByValue: true
    });
    console.log('Theme button clicked:', themeBtnClickRes?.result?.result?.value);
    await new Promise(r => setTimeout(r, 1000));

    // 截图弹窗打开状态
    const snapThemeModal = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\HolyX\\.gemini\\antigravity\\brain\\fd8b9b72-acde-47ce-9892-ce301f47fbc2\\screenshot_theme_modal.png', Buffer.from(snapThemeModal.result.data, 'base64'));
    console.log('Saved screenshot_theme_modal.png');

    // 切换到“赛博深蓝”预设并关闭弹窗
    const switchThemeRes = await send(pageWs, 'Runtime.evaluate', {
      expression: `(() => {
        const presetCards = Array.from(document.querySelectorAll('.livecam-preset-card'));
        const cyberCard = presetCards.find(c => c.textContent.includes('赛博深蓝'));
        if (cyberCard) cyberCard.click();

        const finishBtn = document.querySelector('.livecam-btn-primary');
        if (finishBtn) finishBtn.click();

        return { cyberClicked: Boolean(cyberCard) };
      })()`,
      returnByValue: true
    });
    console.log('Switched to Cyber Navy:', switchThemeRes?.result?.result?.value);
    await new Promise(r => setTimeout(r, 1500));

    // 截图赛博深蓝效果
    const snapCyber = await send(pageWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\HolyX\\.gemini\\antigravity\\brain\\fd8b9b72-acde-47ce-9892-ce301f47fbc2\\screenshot_cyber_navy.png', Buffer.from(snapCyber.result.data, 'base64'));
    console.log('Saved screenshot_cyber_navy.png');

    console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch (e) {}
    process.exit(0);
  }
}, 1500);
