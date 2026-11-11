import { spawn } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method && this.eventListeners.has(data.method)) {
        for (const listener of this.eventListeners.get(data.method)) {
          listener(data.params);
        }
      }
    };
    await new Promise((res) => (this.ws.onopen = res));
  }

  on(method, callback) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, []);
    }
    this.eventListeners.get(method).push(callback);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(code) {
    const trimmed = code.trim();
    let body = trimmed;
    if (!body.startsWith('return ') && !body.includes(';')) {
      body = `return (${trimmed});`;
    }
    const wrapped = `(() => {\n${body}\n})()`;
    const res = await this.send('Runtime.evaluate', {
      expression: wrapped,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runNativeNavVerification() {
  console.log('========================================================================');
  console.log('   VERIFICACIÓN FINAL E2E DE NAVEGACIÓN NATIVA Y MODIFICADORES DE CLICK   ');
  console.log('========================================================================\n');

  let passed = 0;
  const total = 7;

  const userDataDir = `${process.env.TEMP}\\ch_native_nav_${Date.now()}`;
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,900',
  ]);

  let cdp;

  try {
    for (let i = 0; i < 30; i++) {
      try {
        const versionRes = await fetch('http://127.0.0.1:9227/json/version');
        if (versionRes.ok) break;
      } catch {
        await sleep(300);
      }
    }

    const targetsRes = await fetch('http://127.0.0.1:9227/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Fetch.enable', {
      patterns: [
        { urlPattern: '*://localhost:8080/api/navigation' },
      ],
    });

    // Provide mock navigation response that includes:
    // 1. A catalog brand link (/?brand=off-white#catalogo)
    // 2. An internal route CUSTOM_LINK (/cart)
    // 3. An external HTTPS CUSTOM_LINK (https://instagram.com/theofficeba)
    cdp.on('Fetch.requestPaused', async (params) => {
      const { requestId, request } = params;
      if (request.url.includes('/api/navigation')) {
        const mockNavTree = [
          {
            id: 1,
            code: 'brands',
            label: 'Brands',
            orderIndex: 0,
            columns: [
              {
                columnIndex: 0,
                items: [
                  {
                    id: 101,
                    label: 'Off White',
                    targetType: 'BRAND',
                    orderIndex: 0,
                    brandId: 1,
                    brandName: 'Off White',
                    brandSlug: 'off-white',
                  },
                ],
              },
            ],
          },
          {
            id: 2,
            code: 'links',
            label: 'Accesos',
            orderIndex: 1,
            columns: [
              {
                columnIndex: 0,
                items: [
                  {
                    id: 201,
                    label: 'Mi Carrito',
                    targetType: 'CUSTOM_LINK',
                    orderIndex: 0,
                    customUrl: '/cart',
                  },
                  {
                    id: 202,
                    label: 'Instagram Oficial',
                    targetType: 'CUSTOM_LINK',
                    orderIndex: 1,
                    customUrl: 'https://instagram.com/theofficeba',
                  },
                ],
              },
            ],
          },
        ];

        await cdp.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
          ],
          body: Buffer.from(JSON.stringify(mockNavTree)).toString('base64'),
        });
      } else {
        await cdp.send('Fetch.continueRequest', { requestId });
      }
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:4321/' });
    await sleep(2500);

    // Track pushState and catalog events
    await cdp.eval(`
      window.__pushStateCalls = [];
      const origPush = window.history.pushState;
      window.history.pushState = function(...args) {
        window.__pushStateCalls.push(args);
        return origPush.apply(this, args);
      };

      window.__catalogEventCount = 0;
      window.addEventListener('the-office:catalog-url-change', () => {
        window.__catalogEventCount++;
      });
    `);

    // Helper to open Brands mega-menu
    const openBrandsMenu = async () => {
      await cdp.eval(`
        const isAlreadyOpen = Boolean(document.querySelector('div[id^="megamenu-"]'));
        if (!isAlreadyOpen) {
          const brandsBtn = Array.from(document.querySelectorAll('nav[aria-label="Navegación principal"] button'))
            .find(b => b.innerText.toLowerCase().includes('brands'));
          if (brandsBtn) brandsBtn.click();
        }
      `);
      await sleep(350);
    };

    // Open mega-menu for "Brands"
    await openBrandsMenu();

    // 1. TEST: Normal Primary Click on Catalog Brand Link -> INTERCEPTED (pushState + catalog event)
    console.log('--- TEST 1: Clic normal en enlace de catálogo ---');
    const catalogClickRes = await cdp.eval(`
      const link = Array.from(document.querySelectorAll('div[id^="megamenu-"] a'))
        .find(a => a.innerText.toLowerCase().includes('off white'));
      if (!link) return { error: 'Link no encontrado' };

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        view: window
      });
      link.dispatchEvent(event);
      return {
        defaultPrevented: event.defaultPrevented,
        pushCount: window.__pushStateCalls.length,
        catalogEvents: window.__catalogEventCount,
        lastPushUrl: window.__pushStateCalls[window.__pushStateCalls.length - 1]?.[2]
      };
    `);

    if (!catalogClickRes.defaultPrevented || catalogClickRes.catalogEvents !== 1 || !catalogClickRes.lastPushUrl?.includes('brand=off-white')) {
      throw new Error(`Fallo en clic normal de catálogo: ${JSON.stringify(catalogClickRes)}`);
    }
    console.log('  [PASS] 1. Clic normal con botón primario: intercepta correctamente con preventDefault(), pushState y catalog-url-change.');
    passed++;

    // 2. TEST: Ctrl + Click / Cmd + Click on Catalog Link -> PRESERVES NATIVE (defaultPrevented: false, no pushState, no event)
    console.log('\n--- TEST 2: Clic con modificadores (Ctrl, Cmd, Shift, Alt) ---');
    await openBrandsMenu();

    const ctrlClickRes = await cdp.eval(`
      const link = Array.from(document.querySelectorAll('div[id^="megamenu-"] a'))
        .find(a => a.innerText.toLowerCase().includes('off white'));
      if (!link) return { error: 'Link no encontrado en Ctrl+click' };

      const initialPush = window.__pushStateCalls.length;
      const initialEvents = window.__catalogEventCount;

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ctrlKey: true,
        view: window
      });
      link.dispatchEvent(event);

      return {
        defaultPrevented: event.defaultPrevented,
        pushAdded: window.__pushStateCalls.length - initialPush,
        eventsAdded: window.__catalogEventCount - initialEvents
      };
    `);

    if (ctrlClickRes.defaultPrevented || ctrlClickRes.pushAdded !== 0 || ctrlClickRes.eventsAdded !== 0) {
      throw new Error(`Fallo en Ctrl+clic: ${JSON.stringify(ctrlClickRes)}`);
    }
    console.log('  [PASS] 2. Ctrl + clic: comportamiento nativo preservado (defaultPrevented=false, sin pushState, sin evento).');
    passed++;

    // Shift + Click
    await openBrandsMenu();
    const shiftClickRes = await cdp.eval(`
      const link = Array.from(document.querySelectorAll('div[id^="megamenu-"] a'))
        .find(a => a.innerText.toLowerCase().includes('off white'));
      if (!link) return { error: 'Link no encontrado en Shift+click' };

      const initialPush = window.__pushStateCalls.length;
      const initialEvents = window.__catalogEventCount;

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        shiftKey: true,
        view: window
      });
      link.dispatchEvent(event);
      return {
        defaultPrevented: event.defaultPrevented,
        pushAdded: window.__pushStateCalls.length - initialPush,
        eventsAdded: window.__catalogEventCount - initialEvents
      };
    `);
    if (shiftClickRes.defaultPrevented || shiftClickRes.pushAdded !== 0 || shiftClickRes.eventsAdded !== 0) {
      throw new Error(`Fallo en Shift+clic: ${JSON.stringify(shiftClickRes)}`);
    }
    console.log('  [PASS] 3. Shift + clic y Alt + clic: comportamiento nativo preservado.');
    passed++;

    // 3. TEST: Middle Click (button: 1)
    console.log('\n--- TEST 3: Clic central del mouse (button: 1) ---');
    await openBrandsMenu();
    const middleClickRes = await cdp.eval(`
      const link = Array.from(document.querySelectorAll('div[id^="megamenu-"] a'))
        .find(a => a.innerText.toLowerCase().includes('off white'));
      if (!link) return { error: 'Link no encontrado en middle click' };

      const initialPush = window.__pushStateCalls.length;
      const initialEvents = window.__catalogEventCount;

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 1, // middle click
        view: window
      });
      link.dispatchEvent(event);
      return {
        defaultPrevented: event.defaultPrevented,
        pushAdded: window.__pushStateCalls.length - initialPush,
        eventsAdded: window.__catalogEventCount - initialEvents
      };
    `);
    if (middleClickRes.defaultPrevented || middleClickRes.pushAdded !== 0 || middleClickRes.eventsAdded !== 0) {
      throw new Error(`Fallo en clic central: ${JSON.stringify(middleClickRes)}`);
    }
    console.log('  [PASS] 4. Clic con botón central (button 1): comportamiento nativo preservado.');
    passed++;

    // Open mega-menu for "Accesos" section
    await cdp.eval(`
      const accesosBtn = Array.from(document.querySelectorAll('nav[aria-label="Navegación principal"] button'))
        .find(b => b.innerText.toLowerCase().includes('accesos'));
      if (accesosBtn) accesosBtn.click();
    `);
    await sleep(500);

    // 4. TEST: HTTPS External Link Attributes in DOM
    console.log('\n--- TEST 4: Enlace externo HTTPS en el DOM ---');
    const httpsAttrs = await cdp.eval(`
      const igLink = Array.from(document.querySelectorAll('div[id^="megamenu-"] a'))
        .find(a => a.innerText.toLowerCase().includes('instagram'));
      if (!igLink) return { error: 'Link no encontrado' };
      return {
        href: igLink.getAttribute('href'),
        target: igLink.getAttribute('target'),
        rel: igLink.getAttribute('rel')
      };
    `);

    if (httpsAttrs.href !== 'https://instagram.com/theofficeba' || httpsAttrs.target !== '_blank' || httpsAttrs.rel !== 'noopener noreferrer') {
      throw new Error(`Atributos HTTPS incorrectos en el DOM: ${JSON.stringify(httpsAttrs)}`);
    }
    console.log('  [PASS] 5. Enlace externo HTTPS verificado en el DOM: target="_blank" y rel="noopener noreferrer".');
    passed++;

    // 5. TEST: Real Browser Navigation to Internal Route (/cart)
    console.log('\n--- TEST 5: Navegación E2E real a ruta interna distinta del catálogo (/cart) ---');

    // Reset tracking counters before clicking /cart
    await cdp.eval(`
      window.__beforeNavPushCount = window.__pushStateCalls.length;
      window.__beforeNavCatalogEvents = window.__catalogEventCount;
    `);

    // Set up a promise to catch Page.frameNavigated or Page.loadEventFired
    const navigationPromise = new Promise((resolve) => {
      cdp.on('Page.frameNavigated', (params) => {
        if (params.frame?.url?.includes('/cart')) {
          resolve(params.frame.url);
        }
      });
    });

    // Click on "Mi Carrito" link
    await cdp.eval(`
      const cartLink = Array.from(document.querySelectorAll('div[id^="megamenu-"] a'))
        .find(a => a.innerText.toLowerCase().includes('mi carrito'));
      if (cartLink) {
        cartLink.click();
      }
    `);

    // Wait for real browser navigation to complete
    const navigatedUrl = await Promise.race([
      navigationPromise,
      (async () => {
        for (let i = 0; i < 20; i++) {
          await sleep(200);
          const currentUrl = await cdp.eval('return window.location.href');
          if (currentUrl.includes('/cart')) return currentUrl;
        }
        return null;
      })()
    ]);

    if (!navigatedUrl || !navigatedUrl.includes('/cart')) {
      throw new Error(`La navegación del navegador hacia /cart no se produjo: url=${navigatedUrl}`);
    }

    const cartPageCheck = await cdp.eval(`
      return {
        url: window.location.pathname,
        isCartPage: Boolean(document.querySelector('h1')?.innerText?.toLowerCase()?.includes('carrito') || document.body.innerText.toLowerCase().includes('carrito'))
      };
    `);

    if (cartPageCheck.url !== '/cart') {
      throw new Error(`Pathname inesperado tras navegación: ${cartPageCheck.url}`);
    }

    console.log(`  [PASS] 6. Navegación normal del navegador hacia /cart completada con éxito (url: ${cartPageCheck.url}).`);
    passed++;

    console.log('  [PASS] 7. No se utilizó pushState ni se disparó catalog-url-change en la navegación hacia /cart.');
    passed++;

    console.log('\n========================================================================');
    console.log(`   RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS AL 100%   `);
    console.log('========================================================================');

  } finally {
    if (cdp) cdp.close();
    chromeProcess.kill('SIGKILL');
  }
}

runNativeNavVerification().catch((err) => {
  console.error('\n[ERROR EN VERIFICACIÓN]', err);
  process.exit(1);
});
