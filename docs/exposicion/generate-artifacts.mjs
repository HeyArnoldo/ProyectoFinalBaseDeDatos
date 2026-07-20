import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..', '..');
const exposition = path.join(root, 'docs', 'exposicion');
const assets = path.join(exposition, 'assets');
const dist = path.join(exposition, 'dist');
const membersDir = path.join(exposition, 'integrantes');
const demoDir = path.join(exposition, 'demo');
const require = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { chromium } = require('@playwright/test');

const colors = {
  carbon: '#1E1D1A',
  cream: '#F7EFDF',
  ember: '#C94A2F',
  saffron: '#D89B2B',
  herb: '#4F6B45',
  mist: '#E6DCC9',
};

const safeEvidence = [
  ['public-confirmation-chromium-desktop.png', 'public-order-confirmation-sanitized.png'],
  ['operator-projection-chromium-desktop.png', 'operator-projection-status-sanitized.png'],
];

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const inline = (value) => escapeHtml(value)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      index += 1;
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      html.push('<hr>');
      index += 1;
      continue;
    }
    if (/^\|/.test(line) && /^\|?\s*:?-{3,}/.test(lines[index + 1] ?? '')) {
      const cells = (row) => row.split('|').slice(1, -1).map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|/.test(lines[index])) rows.push(cells(lines[index++]));
      html.push(`<table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const list = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (list) {
      const ordered = /\d+\./.test(list[2]);
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*]|\d+\.)\s+(.+)$/);
        if (!item || /\d+\./.test(item[1]) !== ordered) break;
        items.push(`<li>${inline(item[2])}</li>`);
        index += 1;
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|\||[-*]\s+|\d+\.\s+|>\s?|---+$)/.test(lines[index])) paragraph.push(lines[index++]);
    html.push(`<p>${inline(paragraph.join(' ').replace(/ {2,}$/, '<br>'))}</p>`);
  }
  return html.join('\n');
}

function svgArchitecture() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" role="img" aria-label="Arquitectura de cuatro contenedores">
  <style>text{font-family:Arial,sans-serif;fill:${colors.carbon}}.title{font-size:27px;font-weight:700}.label{font-size:18px}.small{font-size:15px}.box{fill:${colors.cream};stroke:${colors.carbon};stroke-width:3}.mongo{fill:#ead1c7;stroke:${colors.ember};stroke-width:3}.cass{fill:#d9e2d4;stroke:${colors.herb};stroke-width:3}.flow{fill:none;stroke:${colors.ember};stroke-width:5;marker-end:url(#arrow)}.async{fill:none;stroke:${colors.herb};stroke-width:5;stroke-dasharray:12 10;marker-end:url(#arrowGreen)}</style>
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${colors.ember}"/></marker><marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${colors.herb}"/></marker></defs>
  <rect x="220" y="55" width="900" height="375" rx="14" fill="none" stroke="${colors.saffron}" stroke-width="3"/><text x="245" y="90" class="small">LIMITE DE APLICACION</text>
  <rect x="35" y="190" width="145" height="100" rx="12" class="box"/><text x="66" y="230" class="title">Navegador</text><text x="88" y="260" class="small">publico</text>
  <rect x="270" y="190" width="160" height="100" rx="12" class="box"/><text x="322" y="230" class="title">Web</text><text x="302" y="260" class="small">interfaz</text>
  <rect x="500" y="190" width="180" height="100" rx="12" class="box"/><text x="553" y="230" class="title">API</text><text x="535" y="260" class="small">worker embebido</text>
  <rect x="760" y="145" width="170" height="100" rx="12" class="mongo"/><text x="790" y="190" class="title">MongoDB</text><text x="792" y="218" class="small">operacion + outbox</text>
  <rect x="970" y="305" width="130" height="100" rx="12" class="cass"/><text x="983" y="348" class="title">Cassandra</text><text x="989" y="375" class="small">RF=1</text>
  <path d="M180 240H270M430 240H500M680 240H760" class="flow"/><text x="692" y="220" class="small">operacion</text>
  <path d="M845 245V355H970" class="async"/><text x="800" y="325" class="small">outbox / proyeccion</text>
</svg>`;
}

function svgModels() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 470" role="img" aria-label="Modelo operacional y proyecciones">
  <style>text{font-family:Arial,sans-serif;fill:${colors.carbon}}.title{font-size:26px;font-weight:700}.code{font-family:monospace;font-size:18px}.small{font-size:15px}.doc{fill:${colors.cream};stroke:${colors.carbon};stroke-width:3}.hot{fill:#ead1c7;stroke:${colors.ember};stroke-width:3}.green{fill:#d9e2d4;stroke:${colors.herb};stroke-width:3}.line{stroke:${colors.ember};stroke-width:5;fill:none;marker-end:url(#a)}.dash{stroke:${colors.herb};stroke-width:5;stroke-dasharray:12 9;fill:none;marker-end:url(#g)}</style>
  <defs><marker id="a" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0 0L0 6L9 3z" fill="${colors.ember}"/></marker><marker id="g" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0 0L0 6L9 3z" fill="${colors.herb}"/></marker></defs>
  <text x="65" y="50" class="small">FUENTE OPERACIONAL</text><rect x="55" y="75" width="220" height="180" rx="12" class="doc"/><text x="85" y="115" class="title">catalog_items</text><text x="85" y="155" class="code">sku · precio · activo</text><text x="85" y="192" class="small">precio vigente</text>
  <rect x="395" y="75" width="230" height="180" rx="12" class="hot"/><text x="440" y="115" class="title">orders</text><text x="425" y="155" class="code">items · total · estado</text><text x="425" y="192" class="small">instantanea historica</text>
  <rect x="745" y="75" width="210" height="180" rx="12" class="hot"/><text x="805" y="115" class="title">outbox</text><text x="775" y="155" class="code">event_id · estado</text><text x="775" y="192" class="small">evento recuperable</text>
  <path d="M275 165H395M625 165H745" class="line"/><text x="297" y="145" class="small">precio copiado</text><text x="652" y="145" class="small">transaccion</text>
  <text x="65" y="340" class="small">VISTAS DERIVADAS: CASSANDRA</text><rect x="55" y="365" width="430" height="75" rx="12" class="green"/><text x="82" y="410" class="code">order_timeline_by_order  |  order_id</text><rect x="640" y="365" width="490" height="75" rx="12" class="green"/><text x="668" y="410" class="code">restaurant_activity_by_day  |  restaurant_id, day</text>
  <path d="M850 255V330H270V365M850 255V330H885V365" class="dash"/><text x="885" y="315" class="small">upserts idempotentes</text>
</svg>`;
}

const visualForSlide = (number) => {
  const architecture = svgArchitecture();
  const models = svgModels();
  const ticket = `<div class="ticket"><span>ORDEN</span><b>Una compra</b><i>MongoDB / fuente operacional</i><div class="ticket-line"></div><b>Dos modelos</b><i>Cassandra / vista derivada</i></div>`;
  const placeholder = (label, filename) => `<div class="evidence-placeholder"><span>EVIDENCIA REAL DURANTE LA DEMO</span><strong>${label}</strong><code>${filename}</code><small>Marco de contingencia: no se inventa una terminal ni datos.</small></div>`;
  const lookup = {
    1: `<div class="hero-visual">${ticket}<div class="flow-note"><b>operacion</b><span></span><b>proyeccion eventual</b></div></div>`,
    2: `<div class="split-visual"><div><b>MongoDB</b><span>estado operativo</span><span>transaccion</span><span>recuperacion</span></div><div class="outbox">outbox</div><div><b>Cassandra</b><span>lecturas previstas</span><span>consistencia eventual</span></div></div>`,
    3: `<img class="diagram" src="data:image/svg+xml,${encodeURIComponent(architecture)}" alt="Arquitectura de cuatro contenedores">`,
    4: `<img class="diagram" src="data:image/svg+xml,${encodeURIComponent(models)}" alt="Modelo MongoDB y Cassandra">`,
    5: `<div class="transaction"><b>TRANSACCION MONGODB</b><div><code>orders</code><span>+</span><code>outbox</code></div><small>Idempotency-Key -> indice unico -> mismo order_id</small></div>`,
    6: placeholder('MongoDB: pedido, outbox, indices y explain', 'mongodb-readonly.js'),
    7: `<div class="cql-cards"><div><small>PREGUNTA 01</small><b>Historial de un pedido</b><code>PRIMARY KEY ((order_id), occurred_at, event_id)</code></div><div><small>PREGUNTA 02</small><b>Actividad diaria</b><code>PRIMARY KEY ((restaurant_id, day), occurred_at, event_id)</code></div></div>`,
    8: `<div class="outbox-flow"><b>PENDING</b><i>lease</i><b>PROCESSING</b><i>upserts</i><b>PROCESSED</b><span>error -> reintento</span></div>`,
    9: placeholder('Cassandra: timeline y actividad diaria', 'cassandra-readonly.cql'),
    10: `<div class="closing-visual">${ticket}<div><b>Alcance academico</b><span>Nodo unico | RF=1</span></div></div>`,
  };
  return lookup[number];
};

function baseDocument(body, extraCss = '') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;color:${colors.carbon};font-family:Arial,Helvetica,sans-serif;background:${colors.cream}} code,pre{font-family:"Courier New",monospace} ${extraCss}
  </style></head><body>${body}</body></html>`;
}

function extractSlides(markdown) {
  return [...markdown.matchAll(/^## Diapositiva (\d+):\s*(.+?)\n([\s\S]*?)(?=^---$|^# Apoyo)/gm)].map((match) => {
    const number = Number(match[1]);
    const body = match[3];
    const responsible = body.match(/\*\*Responsable:\*\*\s*(.+?)(?:\s*\|\s*\*\*Tiempo:\*\*\s*(.+))?$/m);
    const visible = body.match(/### Texto visible\n([\s\S]*?)(?=\n### Visual)/);
    if (!responsible || !visible) throw new Error(`No se pudo extraer la diapositiva ${number}.`);
    return { number, title: match[2], responsible: responsible[1].trim(), time: responsible[2]?.trim() ?? '', visible: visible[1].trim() };
  });
}

function presentationHtml(slides) {
  if (slides.length !== 10) throw new Error(`La presentación requiere 10 diapositivas y se extrajeron ${slides.length}.`);
  const sections = slides.map((slide) => `<section class="slide"><header><span>LA BRASA / BASE DE DATOS 2</span><span>${escapeHtml(slide.responsible)}${slide.time ? ` / ${escapeHtml(slide.time)}` : ''}</span></header><main><div class="slide-copy"><h1>${escapeHtml(slide.title)}</h1><div class="visible">${markdownToHtml(slide.visible)}</div></div><div class="slide-visual">${visualForSlide(slide.number)}</div></main><footer><span>La Brasa | Base de Datos 2 | Grupo 1</span><span>restaurante.cloud.groowtech.com</span><b>${String(slide.number).padStart(2, '0')}</b></footer></section>`).join('');
  return baseDocument(sections, `
  @page{size:13.333333in 7.5in;margin:0}.slide{width:13.333333in;height:7.5in;overflow:hidden;break-after:page;padding:.42in .6in;background:${colors.cream};display:flex;flex-direction:column}.slide:last-child{break-after:auto}.slide header,.slide footer{display:flex;justify-content:space-between;align-items:center;text-transform:uppercase;letter-spacing:.08em;font-size:10px;color:#5c554a}.slide header span:first-child{color:${colors.ember};font-weight:700}.slide main{display:grid;grid-template-columns:47% 53%;gap:28px;flex:1;min-height:0;align-items:center}.slide-copy h1{font-size:34px;line-height:1.05;letter-spacing:-.04em;margin:0 0 22px}.visible{font-size:18px;line-height:1.38}.visible p{margin:0 0 14px}.visible ul,.visible ol{margin:0;padding-left:22px}.visible li{margin:8px 0}.visible code,.visible pre{font-size:15px;background:#e8ddca;border-radius:3px;padding:2px 5px;color:${colors.carbon}}.visible pre{display:block;white-space:pre-wrap;padding:14px;line-height:1.35}.visible table{width:100%;border-collapse:collapse;font-size:14px}.visible th,.visible td{padding:8px;border-bottom:1px solid #b9ad99;text-align:left}.visible th{color:${colors.ember};text-transform:uppercase;font-size:10px;letter-spacing:.08em}.slide-visual{min-height:300px;display:flex;align-items:center;justify-content:center;border-left:1px solid #c7b9a3;padding-left:26px}.diagram{width:100%;max-height:310px}.ticket{width:235px;padding:22px;border:2px solid ${colors.carbon};background:#fffaf0;box-shadow:10px 10px 0 ${colors.saffron};display:flex;flex-direction:column;gap:9px}.ticket span{font-size:11px;letter-spacing:.16em;color:${colors.ember};font-weight:700}.ticket b{font-size:22px}.ticket i{font-size:12px;font-style:normal}.ticket-line{border-top:2px dashed ${colors.carbon};margin:3px 0}.hero-visual,.closing-visual{display:flex;flex-direction:column;align-items:center;gap:34px}.flow-note{display:flex;gap:9px;align-items:center;font-size:12px}.flow-note span{width:160px;border-top:4px solid ${colors.ember};position:relative}.flow-note span:after{content:"";position:absolute;right:0;top:8px;width:65px;border-top:4px dashed ${colors.herb}}.split-visual{display:grid;grid-template-columns:1fr 80px 1fr;align-items:center;gap:12px;width:100%}.split-visual>div:not(.outbox){background:#fffaf0;border-top:5px solid ${colors.ember};padding:20px;display:flex;flex-direction:column;gap:10px;min-height:215px}.split-visual b{font-size:23px}.split-visual span{font-size:14px}.outbox{background:${colors.saffron};padding:10px;font:700 13px "Courier New",monospace;text-align:center}.transaction{border:3px solid ${colors.ember};padding:30px;text-align:center;display:flex;flex-direction:column;gap:32px;background:#fffaf0}.transaction>b{font-size:14px;letter-spacing:.1em;color:${colors.ember}}.transaction div{display:flex;justify-content:center;gap:18px;align-items:center;font-size:30px}.transaction code{font-size:26px}.transaction small{font-size:14px}.evidence-placeholder{height:255px;width:100%;border:2px dashed ${colors.herb};padding:30px;background:#edf1e9;display:flex;flex-direction:column;justify-content:center;gap:15px}.evidence-placeholder span{font-size:11px;letter-spacing:.11em;color:${colors.herb};font-weight:bold}.evidence-placeholder strong{font-size:23px;line-height:1.1}.evidence-placeholder code{background:none;padding:0;font-size:15px}.evidence-placeholder small{font-size:13px}.cql-cards{display:grid;gap:16px;width:100%}.cql-cards>div{border-left:7px solid ${colors.herb};background:#edf1e9;padding:19px;display:flex;flex-direction:column;gap:10px}.cql-cards small{font-size:10px;letter-spacing:.12em;color:${colors.herb};font-weight:bold}.cql-cards b{font-size:20px}.cql-cards code{font-size:12px;line-height:1.35}.outbox-flow{width:100%;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px}.outbox-flow b{padding:15px 10px;background:${colors.carbon};color:${colors.cream};font-size:15px}.outbox-flow i{font-style:normal;font-size:12px;color:${colors.ember};font-weight:bold}.outbox-flow span{width:100%;text-align:center;color:${colors.ember};font-size:14px;margin-top:15px}.closing-visual>div:last-child{border-top:2px solid ${colors.ember};padding-top:12px;text-align:center;display:flex;flex-direction:column;gap:4px}.closing-visual>div:last-child b{font-size:14px;color:${colors.ember}}.closing-visual>div:last-child span{font-family:"Courier New",monospace;font-size:14px}.slide footer{border-top:1px solid #c7b9a3;padding-top:12px}.slide footer b{font-size:15px;color:${colors.ember}}
  `);
}

function guideHtml(title, markdown) {
  return baseDocument(`<article><div class="masthead">LA BRASA <span>BASE DE DATOS 2</span></div>${markdownToHtml(markdown)}</article>`, `
  @page{size:A4;margin:16mm 17mm 18mm}body{font-size:10.2pt;line-height:1.45;background:white}article{max-width:176mm;margin:0 auto}.masthead{font-size:10pt;letter-spacing:.12em;color:${colors.ember};font-weight:bold;border-bottom:2px solid ${colors.ember};padding-bottom:6px;margin-bottom:15px}.masthead span{float:right;color:${colors.herb}}h1{font-size:23pt;line-height:1.08;margin:0 0 16px;letter-spacing:-.03em}h2{font-size:15pt;margin:22px 0 8px;color:${colors.carbon};border-bottom:1px solid #c7b9a3;padding-bottom:4px}h3{font-size:11.5pt;margin:17px 0 6px;color:${colors.ember}}p{margin:0 0 9px}ul,ol{margin:0 0 10px;padding-left:22px}li{margin:3px 0}blockquote{margin:10px 0;padding:10px 13px;border-left:4px solid ${colors.saffron};background:#fbf6eb}code{font-size:9.1pt;background:#f0eadf;padding:1px 3px;border-radius:2px}pre{white-space:pre-wrap;background:${colors.carbon};color:${colors.cream};padding:11px;border-radius:4px;line-height:1.35;font-size:8.5pt;break-inside:avoid}pre code{background:none;color:inherit;padding:0}table{border-collapse:collapse;width:100%;margin:10px 0;font-size:8.8pt;break-inside:avoid}th,td{border:1px solid #c7b9a3;padding:6px;text-align:left;vertical-align:top}th{background:#eee4d1;color:${colors.carbon}}hr{border:0;border-top:1px solid #c7b9a3;margin:16px 0}strong{color:${colors.carbon}}
  `);
}

async function renderPdf(browser, html, output, options) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: output, printBackground: true, preferCSSPageSize: true, ...options });
  await page.close();
}

async function copySafeEvidence() {
  const sourceDir = path.join(root, 'evidence', 'unit-10-final-2026-07-19', 'ui');
  for (const [source, target] of safeEvidence) await cp(path.join(sourceDir, source), path.join(assets, target));
}

async function captureCatalog(browser) {
  const catalogPath = path.join(assets, '01-catalogo-produccion.png');
  const statusPath = path.join(assets, 'catalog-capture-status.txt');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto('https://restaurante.cloud.groowtech.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.screenshot({ path: catalogPath, fullPage: true });
    await writeFile(statusPath, 'Captured read-only from https://restaurante.cloud.groowtech.com/\n', 'utf8');
    return 'captured';
  } catch (error) {
    await rm(catalogPath, { force: true });
    await writeFile(statusPath, `Unavailable: ${error.name}: ${error.message}\n`, 'utf8');
    return 'unavailable';
  } finally {
    await page.close();
  }
}

async function copySource(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

async function createZip(catalogStatus) {
  const staging = path.join(dist, '.zip-staging');
  const zipRoot = path.join(staging, 'opendesign-evidencias');
  const zipFile = path.join(dist, 'evidencias-opendesign.zip');
  await rm(staging, { recursive: true, force: true });
  await mkdir(zipRoot, { recursive: true });

  await Promise.all([
    copySource(path.join(exposition, 'opendesign-prompt.md'), path.join(zipRoot, 'opendesign-prompt.md')),
    copySource(path.join(root, 'docs', 'presentacion-opendesign.md'), path.join(zipRoot, 'presentacion-opendesign.md')),
    copySource(path.join(exposition, 'guia-general.md'), path.join(zipRoot, 'guia-general.md')),
    copySource(path.join(demoDir, 'runbook.md'), path.join(zipRoot, 'demo', 'runbook.md')),
    copySource(path.join(demoDir, 'checklist.md'), path.join(zipRoot, 'demo', 'checklist.md')),
    copySource(path.join(demoDir, 'mongodb-readonly.js'), path.join(zipRoot, 'demo', 'mongodb-readonly.js')),
    copySource(path.join(demoDir, 'cassandra-readonly.cql'), path.join(zipRoot, 'demo', 'cassandra-readonly.cql')),
    copySource(path.join(assets, 'public-order-confirmation-sanitized.png'), path.join(zipRoot, 'evidencias-visuales', 'public-order-confirmation-sanitized.png')),
    copySource(path.join(assets, 'operator-projection-status-sanitized.png'), path.join(zipRoot, 'evidencias-visuales', 'operator-projection-status-sanitized.png')),
    copySource(path.join(assets, 'diagram-arquitectura.svg'), path.join(zipRoot, 'evidencias-visuales', 'diagram-arquitectura.svg')),
    copySource(path.join(assets, 'modelo-datos-proyecciones.svg'), path.join(zipRoot, 'evidencias-visuales', 'modelo-datos-proyecciones.svg')),
  ]);
  for (const file of ['adriano-joao-souza.md', 'alex-apolinarez.md', 'amir-cardenas.md', 'fabricio-gomez.md', 'jose-mauricio-terrazos.md', 'rodrigo-raul-povis.md']) {
    await copySource(path.join(membersDir, file), path.join(zipRoot, 'integrantes', file));
  }
  if (catalogStatus === 'captured') await copySource(path.join(assets, '01-catalogo-produccion.png'), path.join(zipRoot, 'evidencias-visuales', '01-catalogo-produccion.png'));
  const manifest = `OpenDesign evidence manifest\n\nIncluded source material\n- opendesign-prompt.md\n- presentacion-opendesign.md\n- guia-general.md\n- demo/runbook.md\n- demo/checklist.md\n- demo/mongodb-readonly.js\n- demo/cassandra-readonly.cql\n- integrantes/*.md\n\nSanitized visual evidence\n- public-order-confirmation-sanitized.png\n- operator-projection-status-sanitized.png\n- diagram-arquitectura.svg\n- modelo-datos-proyecciones.svg\n- catalog capture: ${catalogStatus}\n\nExcluded deliberately\n- operator-orders screenshots\n- credentials, cookies, environment files, database exports, and personal data\n`;
  await writeFile(path.join(zipRoot, 'MANIFEST.txt'), manifest, 'utf8');
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', "$source = Join-Path $env:ZIP_STAGING 'opendesign-evidencias'; Compress-Archive -LiteralPath $source -DestinationPath $env:ZIP_DESTINATION -Force"], {
    env: { ...process.env, ZIP_STAGING: staging, ZIP_DESTINATION: zipFile },
  });
  await rm(staging, { recursive: true, force: true });
}

async function verifyPdf(file, expectedPages) {
  const bytes = await readFile(file);
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${file} has no PDF header.`);
  if (bytes.length < 1_000) throw new Error(`${file} is unexpectedly small.`);
  if (expectedPages !== undefined) {
    const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
    if (pages !== expectedPages) throw new Error(`${file} has ${pages} page objects; expected ${expectedPages}.`);
  }
}

async function verifyZip(file) {
  const bytes = await readFile(file);
  if (!bytes.subarray(0, 2).equals(Buffer.from('PK'))) throw new Error(`${file} has no ZIP header.`);
  if ((await stat(file)).size < 1_000) throw new Error(`${file} is unexpectedly small.`);
  await execFileAsync('tar.exe', ['-tf', file]);
}

async function main() {
  await mkdir(path.join(dist, 'integrantes'), { recursive: true });
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(assets, 'diagram-arquitectura.svg'), svgArchitecture(), 'utf8');
  await writeFile(path.join(assets, 'modelo-datos-proyecciones.svg'), svgModels(), 'utf8');
  await copySafeEvidence();

  const browser = await chromium.launch({ headless: true });
  try {
    const presentation = await readFile(path.join(root, 'docs', 'presentacion-opendesign.md'), 'utf8');
    const slides = extractSlides(presentation);
    await renderPdf(browser, presentationHtml(slides), path.join(dist, 'presentacion-exposicion.pdf'), { width: '13.333333in', height: '7.5in', margin: { top: 0, right: 0, bottom: 0, left: 0 } });

    const guide = await readFile(path.join(exposition, 'guia-general.md'), 'utf8');
    await renderPdf(browser, guideHtml('Guia general', guide), path.join(dist, 'guia-general.pdf'), { format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    for (const file of ['adriano-joao-souza.md', 'alex-apolinarez.md', 'amir-cardenas.md', 'fabricio-gomez.md', 'jose-mauricio-terrazos.md', 'rodrigo-raul-povis.md']) {
      const markdown = await readFile(path.join(membersDir, file), 'utf8');
      await renderPdf(browser, guideHtml('Ficha individual', markdown), path.join(dist, 'integrantes', file.replace(/\.md$/, '.pdf')), { format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    }
    const catalogStatus = await captureCatalog(browser);
    await createZip(catalogStatus);
  } finally {
    await browser.close();
  }
  await verifyPdf(path.join(dist, 'presentacion-exposicion.pdf'), 10);
  await verifyPdf(path.join(dist, 'guia-general.pdf'));
  for (const file of ['adriano-joao-souza.pdf', 'alex-apolinarez.pdf', 'amir-cardenas.pdf', 'fabricio-gomez.pdf', 'jose-mauricio-terrazos.pdf', 'rodrigo-raul-povis.pdf']) await verifyPdf(path.join(dist, 'integrantes', file));
  await verifyZip(path.join(dist, 'evidencias-opendesign.zip'));
  console.log('Artifacts generated and verified.');
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
