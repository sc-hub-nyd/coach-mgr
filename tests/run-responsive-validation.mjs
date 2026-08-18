import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'responsive-artifacts');
const chromePort = 9333;
const baseUrl = 'http://127.0.0.1:9042/';
const viewports = [
    { name: 'mobile-320', width: 320, height: 844 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1024', width: 1024, height: 768 },
    { name: 'desktop-1440', width: 1440, height: 900 }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const requestJson = (pathname, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: chromePort, path: pathname, method }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
        });
    });
    req.on('error', reject);
    req.end();
});

async function waitForDebugger() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
            return await requestJson('/json/version');
        } catch {
            await sleep(250);
        }
    }
    throw new Error('Chromium debugger did not start');
}

function createClient(wsUrl) {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const opened = new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
    });
    ws.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (!message.id) return;
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id);
        if (message.error) item.reject(new Error(message.error.message));
        else item.resolve(message.result || {});
    });
    return {
        opened,
        send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const messageId = ++id;
                pending.set(messageId, { resolve, reject });
                ws.send(JSON.stringify({ id: messageId, method, params }));
            });
        },
        close() { ws.close(); }
    };
}

const expression = (code) => `(${code})()`;
async function evaluate(client, code) {
    const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
        expression: expression(code),
        returnByValue: true,
        awaitPromise: true
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text || 'Runtime evaluation failed');
    return result.value;
}

async function setViewport(client, viewport) {
    await client.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: viewport.width,
        screenHeight: viewport.height
    });
}

async function navigate(client, url = baseUrl) {
    await client.send('Page.navigate', { url });
    await sleep(1300);
}

async function click(client, selector) {
    return evaluate(client, `() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.click();
        return true;
    }`);
}

async function setValue(client, selector, value) {
    return evaluate(client, `() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.value = ${JSON.stringify(value)};
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }`);
}

async function enableCoachMode(client) {
    await click(client, '#btn-toggle-role');
    await sleep(100);
    const hasModal = await evaluate(client, `() => Boolean(document.querySelector('#input-coach-passcode'))`);
    if (!hasModal) return true;
    await setValue(client, '#input-coach-passcode', '7064');
    await click(client, '#modal-coach-passcode button[type="submit"]');
    await sleep(350);
    return evaluate(client, `() => document.body.textContent.includes('コーチモード')`);
}

async function goRoute(client, route) {
    const found = await evaluate(client, `() => {
        const item = document.querySelector('[data-route="${route}"]');
        if (!item) return false;
        item.click();
        return true;
    }`);
    if (!found) throw new Error(`route ${route} unavailable`);
    await sleep(350);
}

async function createMatchAndOpenDetail(client) {
    await goRoute(client, 'matches');
    await click(client, '#btn-add-match');
    await sleep(120);
    await setValue(client, '#match-date', '2026-08-18');
    await setValue(client, '#match-opponent', 'Responsive Test FC');
    await click(client, '#modal-match button[type="submit"]');
    await sleep(400);
    const opened = await evaluate(client, `() => {
        const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === '詳細');
        if (!button) return false;
        button.click();
        return true;
    }`);
    if (!opened) throw new Error('match detail trigger unavailable');
    await sleep(400);
}

async function collect(client, page) {
    return evaluate(client, `() => {
        const width = window.innerWidth;
        const rootWidth = document.documentElement.scrollWidth;
        const allowedHorizontalScroll = new Set(['field-event-list', 'u-scroll-x']);
        const overflow = [...document.querySelectorAll('body *')]
            .map(element => {
                const rect = element.getBoundingClientRect();
                const styles = getComputedStyle(element);
                const isAllowed = [...allowedHorizontalScroll].some(name => element.classList.contains(name));
                return { tag: element.tagName, id: element.id, classes: element.className, right: Math.round(rect.right), left: Math.round(rect.left), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: styles.overflowX, isAllowed };
            })
            .filter(item => !item.isAllowed && item.right > width + 1 && item.clientWidth > 0)
            .slice(0, 12);
        const buttons = [...document.querySelectorAll('button, a.btn, input[type="submit"]')]
            .filter(element => {
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            })
            .map(element => {
                const rect = element.getBoundingClientRect();
                return { text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 32), width: Math.round(rect.width), height: Math.round(rect.height) };
            });
        return {
            page: ${JSON.stringify(page)},
            viewport: { width, height: window.innerHeight },
            rootWidth,
            overflow,
            smallestControl: buttons.length ? Math.min(...buttons.map(item => Math.min(item.width, item.height))) : null,
            buttons: buttons.slice(0, 24),
            dashRows: [...document.querySelectorAll('.dash-row-2')].map(element => ({ columns: getComputedStyle(element).gridTemplateColumns, width: Math.round(element.getBoundingClientRect().width) })),
            visible: {
                dashboard: Boolean(document.querySelector('.dash-widget-grid')),
                settings: Boolean(document.querySelector('.sl-settings')),
                fieldCompanion: Boolean(document.querySelector('.field-companion'))
            }
        };
    }`);
}

async function screenshot(client, viewport, page) {
    const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const name = `${viewport.name}-${page}.png`;
    await writeFile(path.join(outputDir, name), Buffer.from(data, 'base64'));
    return name;
}

async function runViewport(client, viewport) {
    await setViewport(client, viewport);
    await navigate(client);
    const checks = [];

    checks.push({ ...(await collect(client, 'dashboard-parent')), screenshot: await screenshot(client, viewport, 'dashboard-parent') });
    await enableCoachMode(client);
    checks.push({ ...(await collect(client, 'dashboard-coach')), screenshot: await screenshot(client, viewport, 'dashboard-coach') });

    await goRoute(client, 'settings');
    checks.push({ ...(await collect(client, 'settings')), screenshot: await screenshot(client, viewport, 'settings') });

    await createMatchAndOpenDetail(client);
    checks.push({ ...(await collect(client, 'field-companion')), screenshot: await screenshot(client, viewport, 'field-companion') });
    return checks;
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const chrome = spawn('/usr/bin/chromium', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${path.join(outputDir, 'chrome-profile')}`,
    'about:blank'
], { stdio: 'ignore' });

try {
    await waitForDebugger();
    const target = await requestJson(`/json/new?${encodeURIComponent(baseUrl)}`, 'PUT');
    const client = createClient(target.webSocketDebuggerUrl);
    await client.opened;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    const results = [];
    for (const viewport of viewports) results.push(...await runViewport(client, viewport));
    await writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2));
    const violations = results.filter(item => item.rootWidth > item.viewport.width + 1 || item.overflow.length > 0);
    console.log(JSON.stringify({ checked: results.length, violations: violations.length, artifacts: outputDir }, null, 2));
    client.close();
    if (violations.length) process.exitCode = 2;
} finally {
    chrome.kill('SIGTERM');
}
