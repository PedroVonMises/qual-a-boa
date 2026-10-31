// Captures every screen of the web build into docs/screens/ (the images used by docs/SCREENS.md). Usage, from app/:
//   EXPO_PUBLIC_DATA_SOURCE=seed EXPO_PUBLIC_APP_ENV=development npx expo export --platform web
//   serve dist/ with an SPA fallback on BASE (default http://127.0.0.1:8088), then:
//   PLAYWRIGHT_DIR=<dir whose node_modules has playwright> node scripts/capture-screens.mjs [name,name...]
// The clock is pinned so the Casa Maré demo event ("Maré Vazante") is live. A `--dev` export fails on web
// ("Requiring unknown module"), so use the regular export. The component gallery (/dev/ui) only exists on
// `npx expo start --web`; capture it there by hand (00-componentes.jpg, 00-capas.jpg).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'noop.js'));
const { chromium } = require('playwright');

const BASE = process.env.BASE ?? 'http://127.0.0.1:8088';
const OUT = resolve(import.meta.dirname, '../../docs/screens') + '/';
const NOW = new Date('2026-10-24T23:30:00Z');
const W = 390;
const H = 844;

const seed = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/data/seed.json'), 'utf8'));
const demo = seed.events.filter((e) => (e.ticketUrl ?? '').includes('/casa-mare-demo-'));
const live = demo.find((e) => Date.parse(e.startsAt) <= +NOW && Date.parse(e.endsAt ?? e.startsAt) > +NOW) ?? demo[1];
const future = seed.events
  .filter((e) => !demo.includes(e) && e.status === 'published' && Date.parse(e.startsAt) > +NOW)
  .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
const ev = future.find((e) => e.artistIds.length >= 2) ?? future[0];
const venue = seed.venues.find((v) => v.id === ev.venueId);
const artist = seed.artists.find((a) => a.id === ev.artistIds[0]);
const only = process.argv[2]?.split(',');
const SESSION = JSON.stringify({ state: { ageConfirmed: true, onboardingDone: true }, version: 0 });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
await ctx.clock.install({ time: NOW });
const p = await ctx.newPage();

// React Native Web scrolls inside inner views, so a fullPage screenshot misses content:
// grow the viewport by the largest inner scroll overflow instead.
async function shot(name, { tall = true, wait = 1500 } = {}) {
  await p.waitForTimeout(wait);
  let h = H;
  if (tall) {
    const extra = await p.evaluate(() => {
      let m = 0;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        const scrolls = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
        if (scrolls && el.clientHeight > 300 && el.offsetParent !== null && el.getBoundingClientRect().width > 300) {
          m = Math.max(m, el.scrollHeight - el.clientHeight);
        }
      }
      return m;
    });
    h = Math.min(H + extra, 3200);
  }
  if (h !== H) {
    await p.setViewportSize({ width: W, height: h });
    await p.waitForTimeout(700);
  }
  await p.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 78 });
  if (h !== H) await p.setViewportSize({ width: W, height: H });
  console.log('shot', name, h);
}
const go = async (path, wait = 2500) => {
  await p.goto(BASE + path);
  await p.waitForTimeout(wait);
};
const click = async (sel) => {
  await p.locator(sel).first().click();
  await p.waitForTimeout(900);
};
const run = async (name, fn) => {
  if (only && !only.includes(name)) return;
  try {
    await fn();
  } catch (e) {
    console.log('FAIL', name, e.message.slice(0, 200));
  }
};

// 1. Entrada
await run('01-splash', async () => {
  await p.goto(BASE + '/');
  await p.waitForTimeout(450);
  await p.screenshot({ path: `${OUT}01-splash.jpg`, type: 'jpeg', quality: 78 });
});
await run('02-idade', async () => { await go('/'); await shot('02-idade', { tall: false }); });
await go('/onboarding/idade');
await click('text=Tenho 18 anos ou mais');
await run('03-local', () => shot('03-local'));
await run('04-bairro', async () => { await click('text=Escolher o bairro'); await shot('04-bairro', { tall: false }); });
await p.evaluate((s) => localStorage.setItem('qab.session.v1', s), SESSION);

// 2. Descobrir and 3. Evento
await run('05-explorar', async () => { await go('/'); await shot('05-explorar'); });
await run('06-quando', async () => { await go('/'); await click('[aria-label^="Quando:"]'); await shot('06-quando', { tall: false }); });
await run('07-area', async () => { await go('/'); await click('[aria-label^="Local:"]'); await shot('07-area', { tall: false }); });
await run('08-filtros', async () => { await go('/filtros'); await shot('08-filtros'); });
await run('09-busca', async () => { await go('/busca'); await p.keyboard.type('mar'); await shot('09-busca'); });
await run('10-evento', async () => { await go('/evento/' + ev.id); await shot('10-evento'); });
await run('11-share', async () => { await go('/evento/' + ev.id); await click('[aria-label="Compartilhar evento"]'); await shot('11-share', { tall: false }); });
await run('12-ingressos', async () => { await go('/ingressos/' + ev.id); await shot('12-ingressos'); });
await run('13-casa', async () => { await go('/casa/' + venue.slug); await shot('13-casa'); });
await run('14-artista', async () => { await go('/artista/' + artist.slug); await shot('14-artista'); });
await run('15-mapa', async () => { await go('/mapa', 4500); await shot('15-mapa', { tall: false }); });
await run('16-salvos-vazio', async () => { await go('/salvos'); await shot('16-salvos-vazio', { tall: false }); });
await run('17-perfil', async () => { await go('/perfil'); await shot('17-perfil'); });

// 4-7 need the demo data from Perfil
await go('/perfil');
await click('text=Carregar dados de exemplo');
await run('18-salvos', async () => { await go('/salvos'); await shot('18-salvos'); });
await run('19-acompanhar', async () => { await go('/acompanhar'); await shot('19-acompanhar'); });
await run('20-avisos', async () => { await go('/acompanhar/avisos'); await shot('20-avisos'); });
await run('21-aovivo', async () => { await go('/ao-vivo/' + live.id); await shot('21-aovivo'); });
await run('22-avaliar', async () => { await go('/avaliar/' + live.id); await shot('22-avaliar'); });
await run('23-avaliar-texto', async () => { await go(`/avaliar/${live.id}/texto`); await shot('23-avaliar-texto'); });
await run('24-avaliacoes', async () => { await go('/avaliacoes/' + live.id); await shot('24-avaliacoes'); });
await run('25-entrar', async () => { await go('/entrar'); await shot('25-entrar'); });
await run('26-conta', async () => { await go('/conta'); await shot('26-conta'); });
await run('27-meus-eventos', async () => { await go('/meus-eventos'); await shot('27-meus-eventos'); });
await run('28-privacidade', async () => { await go('/privacidade'); await shot('28-privacidade'); });
await run('29-ajuda', async () => { await go('/ajuda'); await shot('29-ajuda'); });
await run('30-mensagens', async () => { await go('/ajuda/mensagens'); await shot('30-mensagens'); });
await run('31-conversa', async () => {
  const s = JSON.parse(await p.evaluate(() => localStorage.getItem('qab.support')));
  const t = s.state.tickets;
  await go('/ajuda/suporte/' + (Array.isArray(t) ? t[0].id : Object.keys(t)[0]));
  await shot('31-conversa');
});
await run('32-novo-chamado', async () => { await go('/ajuda/novo'); await shot('32-novo-chamado'); });
await run('33-404', async () => { await go('/nao-existe'); await shot('33-404', { tall: false }); });

// Desktop (rail layout)
for (const [name, path] of [['34-desktop-explorar', '/'], ['35-desktop-mapa', '/mapa']]) {
  await run(name, async () => {
    await p.setViewportSize({ width: 1440, height: 900 });
    await go(path, 4000);
    await p.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 78 });
    await p.setViewportSize({ width: W, height: H });
  });
}

await browser.close();
