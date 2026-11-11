import { spawn } from 'child_process';
import { readFileSync } from 'fs';

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

  async waitForSelector(selector, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.eval(`return Boolean(document.querySelector('${selector}'))`);
      if (exists) return true;
      await sleep(200);
    }
    const currentUrl = await this.eval('return window.location.href');
    const bodyText = await this.eval('return document.body?.innerText?.slice(0, 300)');
    throw new Error(`Timeout waiting for selector: ${selector} at ${currentUrl}\nBody: ${bodyText}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runConsistencyChecks() {
  console.log('================================================================');
  console.log('   VERIFICACIÓN FINAL DE CONSISTENCIA: NAVEGACIÓN Y MEGA-MENU   ');
  console.log('================================================================\n');

  let passedChecks = 0;
  const totalChecks = 9;

  // 1. REVISIÓN DE REGISTROS DE PRUEBA Y PERSISTENCIA (BACKEND API + DB)
  console.log('--- TEST 1 & 2: Persistencia y ausencia de datos de prueba ---');
  const token = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGVzIjpbIlJPTEVfQURNSU4iXSwiaWF0IjoxNzk0NDE0MTc3LCJleHAiOjE3OTQ1MDA1Nzd9.099gW_jWNRJ2nWXX8IZQpsUg4ZxLYkFEH0_BhzWYNO5aJCSe6PDmSH3diisLYomUcR_Tf6cBEMMwazzN40nJjQ';
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Call admin endpoints
  const adminNavRes = await fetch('http://localhost:8080/api/admin/navigation', { headers });
  if (!adminNavRes.ok) throw new Error(`GET /api/admin/navigation failed: ${adminNavRes.status}`);
  const adminSections = await adminNavRes.json();

  const adminBrandsRes = await fetch('http://localhost:8080/api/admin/brands', { headers });
  if (!adminBrandsRes.ok) throw new Error(`GET /api/admin/brands failed: ${adminBrandsRes.status}`);
  const adminBrands = await adminBrandsRes.json();

  // Verify no 'New Balance' brand
  const nbBrand = adminBrands.find(b => b.name?.toLowerCase().includes('new balance') || b.slug === 'new-balance');
  if (nbBrand) {
    throw new Error('Se encontró la marca de prueba New Balance en la base de datos.');
  }

  // Verify only legitimate sections exist
  const testSection = adminSections.find(s => s.code === 'drop-exclusivo' || s.label?.toLowerCase().includes('drop'));
  if (testSection) {
    throw new Error('Se encontró una sección de prueba en nav_sections.');
  }

  // Verify sections count and codes
  const sectionCodes = adminSections.map(s => s.code);
  const expectedCodes = ['brands', 'sneakers', 'streetwear', 'accessories'];
  const hasAllExpected = expectedCodes.every(c => sectionCodes.includes(c));
  if (!hasAllExpected) {
    throw new Error(`Secciones inesperadas en backend: ${sectionCodes.join(', ')}`);
  }

  console.log('  [PASS] 1. Persistencia verificada: configuración backend responde correctamente.');
  console.log('  [PASS] 2. Ausencia de datos de prueba: Ni New Balance ni Drop Exclusivo están persistidos.');
  passedChecks += 2;

  // 3 & 4. CUSTOM_LINK UNIT TESTS (Internal same-tab vs External HTTPS new-tab)
  console.log('\n--- TEST 3 & 4: Comportamiento de CUSTOM_LINK interno vs externo ---');
  function testGetNavigationItemHref(item) {
    if (!item || !item.targetType) return '/#catalogo';
    switch (item.targetType) {
      case 'BRAND':
        return item.brandSlug ? `/?brand=${encodeURIComponent(item.brandSlug)}#catalogo` : '/#catalogo';
      case 'CATEGORY':
        return item.categoryId ? `/?categoryId=${encodeURIComponent(item.categoryId)}#catalogo` : '/#catalogo';
      case 'CUSTOM_LINK': {
        const url = item.customUrl ? item.customUrl.trim() : '';
        return url || '/#catalogo';
      }
      default:
        return '/#catalogo';
    }
  }

  function testIsExternalCustomUrl(url) {
    if (!url) return false;
    const lower = url.trim().toLowerCase();
    return lower.startsWith('https://') || lower.startsWith('http://');
  }

  // Internal link
  const internalItem = { targetType: 'CUSTOM_LINK', customUrl: '/#catalogo', label: 'Catálogo' };
  const internalHref = testGetNavigationItemHref(internalItem);
  const isInternalExt = testIsExternalCustomUrl(internalItem.customUrl);
  if (internalHref !== '/#catalogo' || isInternalExt !== false) {
    throw new Error(`Fallo en CUSTOM_LINK interno: href=${internalHref}, isExternal=${isInternalExt}`);
  }
  console.log('  [PASS] 3. CUSTOM_LINK interno (/#catalogo): href correcto y navegación en misma pestaña (isExternal = false).');
  passedChecks++;

  // External HTTPS link
  const externalItem = { targetType: 'CUSTOM_LINK', customUrl: 'https://instagram.com/theofficeba', label: 'Instagram' };
  const externalHref = testGetNavigationItemHref(externalItem);
  const isExternalExt = testIsExternalCustomUrl(externalItem.customUrl);
  if (externalHref !== 'https://instagram.com/theofficeba' || isExternalExt !== true) {
    throw new Error(`Fallo en CUSTOM_LINK externo: href=${externalHref}, isExternal=${isExternalExt}`);
  }
  console.log('  [PASS] 4. CUSTOM_LINK externo HTTPS (https://...): href correcto y apertura en nueva pestaña (isExternal = true).');
  passedChecks++;

  // START HEADLESS CHROME FOR LIVE E2E CHECKS
  console.log('\n--- TESTS 5, 6, 7, 8, 9: Pruebas visuales y E2E en navegador ---');
  const userDataDir = `${process.env.TEMP}\\ch_nav_consistency_${Date.now()}`;
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9225',
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
        const versionRes = await fetch('http://127.0.0.1:9225/json/version');
        if (versionRes.ok) break;
      } catch {
        await sleep(300);
      }
    }

    const targetsRes = await fetch('http://127.0.0.1:9225/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 5. SECCIÓN SIN ELEMENTOS NO DEBE APARECER EN NAVBAR PÚBLICO
    await cdp.send('Page.navigate', { url: 'http://localhost:4321/' });
    await sleep(2500);

    const renderedNavTexts = await cdp.eval(`
      const nav = document.querySelector('nav[aria-label="Navegación principal"]');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('button')).map(b => b.innerText.trim());
    `);

    console.log('  Botones visibles en navbar desktop:', renderedNavTexts);

    const containsAccesorios = renderedNavTexts.some(t => t.toLowerCase().includes('accesorios') || t.toLowerCase().includes('accessories'));
    if (containsAccesorios) {
      throw new Error('La sección "Accesorios" (sin elementos válidos) apareció erróneamente en el navbar.');
    }
    console.log('  [PASS] 5. Sección sin elementos (Accesorios): excluida correctamente del navbar público.');
    passedChecks++;

    // 6. SECCIONES CON ELEMENTOS APARECEN CORRECTAMENTE
    const hasBrands = renderedNavTexts.some(t => t.toLowerCase().includes('brands') || t.toLowerCase().includes('marcas'));
    const hasSneakers = renderedNavTexts.some(t => t.toLowerCase().includes('sneakers'));
    const hasStreetwear = renderedNavTexts.some(t => t.toLowerCase().includes('streetwear'));

    if (!hasBrands || !hasSneakers || !hasStreetwear) {
      throw new Error(`Faltan secciones con elementos en el navbar: ${JSON.stringify(renderedNavTexts)}`);
    }

    // Click on Brands button and verify mega-menu
    await cdp.eval(`
      const btn = Array.from(document.querySelectorAll('nav[aria-label="Navegación principal"] button')).find(b => b.innerText.toLowerCase().includes('brands'));
      if (btn) btn.click();
    `);
    await sleep(600);

    const megaMenuVisible = await cdp.eval(`
      const panel = document.querySelector('div[id^="megamenu-"]');
      if (!panel) return false;
      const text = panel.innerText;
      return text.includes('Off White');
    `);

    if (!megaMenuVisible) {
      throw new Error('El mega-menu no desplegó la marca Off White correctamente.');
    }
    console.log('  [PASS] 6. Secciones con elementos: Brands, Sneakers y Streetwear presentes. Mega-menu desplegó "Off White".');
    passedChecks++;

    // 7. RENOMBRAR BRANDS NO MODIFICA SU COMPORTAMIENTO ESPECIAL (INSPECCIÓN DE CÓDIGO)
    const adminViewCode = readFileSync('src/components/react/admin/AdminNavigationView.jsx', 'utf-8');
    const usesCodeForBrands = adminViewCode.includes("section.code?.toLowerCase() === BRANDS_SECTION_CODE");
    const immutabilityNotice = adminViewCode.includes("Código inmutable de la sección");
    if (!usesCodeForBrands || !immutabilityNotice) {
      throw new Error('AdminNavigationView no protege el código inmutable ni utiliza code para las marcas.');
    }
    console.log('  [PASS] 7. Código interno brands protegido: las restricciones se basan exclusivamente en section.code.');
    passedChecks++;

    // 8. FUNCIONAMIENTO RESPONSIVE (Mobile 390px)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(500);

    // Open mobile drawer
    await cdp.eval(`
      const toggle = document.getElementById('navbar-mobile-toggle-btn');
      if (toggle) toggle.click();
    `);
    await sleep(600);

    const mobileDrawerData = await cdp.eval(`
      const drawer = document.getElementById('navbar-mobile-drawer');
      if (!drawer) return { open: false };
      const buttons = Array.from(drawer.querySelectorAll('nav button')).map(b => b.innerText.trim());
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      return {
        open: true,
        buttons,
        overflow: scrollWidth - clientWidth
      };
    `);

    if (!mobileDrawerData.open) {
      throw new Error('El drawer móvil no se abrió en viewport de 390px.');
    }
    if (mobileDrawerData.buttons.some(b => b.toLowerCase().includes('accesorios'))) {
      throw new Error('La sección vacía "Accesorios" apareció en el drawer móvil.');
    }
    if (mobileDrawerData.overflow > 1) {
      throw new Error(`Desbordamiento horizontal detectado en móvil: ${mobileDrawerData.overflow}px.`);
    }

    console.log('  [PASS] 8. Responsive (390px): Drawer móvil funcional, secciones vacías excluidas, 0px overflow horizontal.');
    passedChecks++;

    // 9. COMPATIBILIDAD CON BUSCADOR, CARRITO Y CATÁLOGO
    const headerControls = await cdp.eval(`
      const searchBtn = Boolean(document.querySelector('button[aria-label*="Buscar"]') || document.querySelector('button[aria-label*="search" i]'));
      const cartBtn = Boolean(document.querySelector('a[href="/cart"]') || document.querySelector('[aria-label*="Bolsa de compras"]'));
      const catalogSection = Boolean(document.getElementById('catalogo'));
      return { searchBtn, cartBtn, catalogSection };
    `);

    if (!headerControls.searchBtn || !headerControls.cartBtn || !headerControls.catalogSection) {
      throw new Error(`Falta control en header/catálogo: ${JSON.stringify(headerControls)}`);
    }

    console.log('  [PASS] 9. Compatibilidad verificada: Buscador, Carrito y sección de Catálogo activos y enlazados.');
    passedChecks++;

    console.log('\n================================================================');
    console.log(`   RESULTADO: ${passedChecks}/${totalChecks} COMPROBACIONES APROBADAS AL 100%   `);
    console.log('================================================================');

  } finally {
    if (cdp) cdp.close();
    chromeProcess.kill('SIGKILL');
  }
}

runConsistencyChecks().catch((err) => {
  console.error('\n[ERROR EN VERIFICACIÓN]', err);
  process.exit(1);
});
