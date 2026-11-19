// auditar-checklist.js
// Revisa, SOLO LECTURA, los puntos automatizables del checklist "Considerandos para la
// construcción de la página WEB" sobre la carpeta public/. No modifica nada.
// Se corre desde la raíz del proyecto:   node auditar-checklist.js
// Para guardar el informe en un archivo:  node auditar-checklist.js > informe-checklist.txt

const fs = require('fs');
const path = require('path');

const RAIZ = 'public';
if (!fs.existsSync(RAIZ)) { console.error('No encuentro la carpeta public/. Correlo desde la raíz del proyecto.'); process.exit(1); }

// Páginas del sitio público (las que se exponen); el resto es el panel de gestión.
const PUBLICAS = ['index', 'menu', 'procesos', 'quienes-somos', 'visitanos', 'pedir'];

const leer = (ruta) => fs.readFileSync(ruta, 'utf8');
const cuenta = (texto, re) => (texto.match(re) || []).length;
const sinComentarios = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

function listar(dir) {
  const salida = [];
  for (const nombre of fs.readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    if (fs.statSync(ruta).isDirectory()) salida.push(...listar(ruta));
    else salida.push(ruta);
  }
  return salida;
}

const archivos = listar(RAIZ);
const html = archivos.filter(a => a.endsWith('.html'));
const css = archivos.filter(a => a.endsWith('.css'));
const js = archivos.filter(a => a.endsWith('.js'));
const imagenes = archivos.filter(a => /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(a));

const resultados = []; // { punto, estado, detalle }
function marcar(punto, ok, detalle = '', aviso = false) {
  resultados.push({ punto, estado: ok ? 'OK' : (aviso ? 'REVISAR' : 'FALLA'), detalle });
}
const lista = (arr, max = 8) => arr.slice(0, max).join(', ') + (arr.length > max ? ` … (+${arr.length - max})` : '');

// ---------- Sección 1: estructura ----------
marcar('1.1 index.html en la raíz de public/', fs.existsSync(path.join(RAIZ, 'index.html')));

// 1.3 / 1.18 / 5.17: rutas locales que no existen
const rotos = [];
for (const archivo of html) {
  const texto = sinComentarios(leer(archivo));
  const re = /\b(?:href|src)\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(texto))) {
    const destino = m[1].trim();
    if (!destino || /^(https?:|mailto:|tel:|data:|#|javascript:|\/\/|wa\.me)/i.test(destino)) continue;
    const limpio = destino.split('#')[0].split('?')[0];
    if (!limpio) continue;
    // Rutas de la API del servidor (no son archivos): se ignoran.
    if (/^\/(productos|sucursales|pedidos|auth|api)\b/.test(limpio)) continue;
    const base = limpio.startsWith('/') ? path.join(RAIZ, limpio) : path.join(path.dirname(archivo), limpio);
    if (!fs.existsSync(base)) rotos.push(`${path.basename(archivo)} → ${destino}`);
  }
}
marcar('1.3 / 1.18 Enlaces y recursos locales sin romper', rotos.length === 0, lista(rotos));

// 1.5 metadatos por página pública
const metas = [
  ['charset', /<meta[^>]+charset=/i], ['viewport', /<meta[^>]+name="viewport"/i],
  ['description', /<meta[^>]+name="description"/i], ['author', /<meta[^>]+name="author"/i],
  ['keywords', /<meta[^>]+name="keywords"/i], ['robots', /<meta[^>]+name="robots"/i],
  ['theme-color', /<meta[^>]+name="theme-color"/i], ['og:title', /property="og:title"/i],
  ['og:description', /property="og:description"/i], ['og:image', /property="og:image"/i],
  ['og:url', /property="og:url"/i], ['twitter:card', /name="twitter:card"/i],
  ['twitter:title', /name="twitter:title"/i], ['twitter:description', /name="twitter:description"/i],
  ['twitter:image', /name="twitter:image"/i], ['content-language', /http-equiv="content-language"|name="content-language"/i],
  ['application-name', /name="application-name"/i], ['generator', /name="generator"/i],
  ['googlebot', /name="googlebot"/i]
];
for (const pag of PUBLICAS) {
  const ruta = path.join(RAIZ, pag + '.html');
  if (!fs.existsSync(ruta)) { marcar(`1.5 Metadatos en ${pag}.html`, false, 'no existe el archivo'); continue; }
  const t = leer(ruta);
  const faltan = metas.filter(([, re]) => !re.test(t)).map(([n]) => n);
  marcar(`1.5 Metadatos en ${pag}.html`, faltan.length === 0, faltan.length ? 'faltan: ' + faltan.join(', ') : '', true);
}

// 1.6 / 1.7 / 1.8 / 1.15 / 1.16 / 1.17 en páginas públicas
function chequeoPorPagina(punto, test, aviso = false) {
  const mal = PUBLICAS.filter(p => fs.existsSync(path.join(RAIZ, p + '.html')) && !test(leer(path.join(RAIZ, p + '.html'))));
  marcar(punto, mal.length === 0, mal.length ? 'falla en: ' + mal.join(', ') : '', aviso);
}
chequeoPorPagina('1.6 <title> presente y no vacío (públicas)', t => /<title>[^<]{3,}<\/title>/i.test(t));
chequeoPorPagina('1.7 Favicon (públicas)', t => /<link[^>]+rel="(shortcut )?icon"/i.test(t));
chequeoPorPagina('1.8 <nav> (públicas)', t => /<nav[\s>]/i.test(t));
chequeoPorPagina('1.15 <main> (públicas)', t => /<main[\s>]/i.test(t));
chequeoPorPagina('1.16 <header> (públicas)', t => /<header[\s>]/i.test(t));
chequeoPorPagina('1.17 <footer> (públicas)', t => /<footer[\s>]/i.test(t), true);

// 1.10 enlaces externos con target=_blank y rel noopener
const externosSinBlank = [], blankSinRel = [];
for (const archivo of html) {
  const t = sinComentarios(leer(archivo));
  const re = /<a\b[^>]*>/gi; let m;
  while ((m = re.exec(t))) {
    const etiqueta = m[0];
    const h = /href="(https?:\/\/[^"]+)"/i.exec(etiqueta);
    if (!h) continue;
    if (!/target="_blank"/i.test(etiqueta)) externosSinBlank.push(`${path.basename(archivo)} → ${h[1].slice(0, 40)}`);
    else if (!/rel="[^"]*noopener/i.test(etiqueta)) blankSinRel.push(`${path.basename(archivo)} → ${h[1].slice(0, 40)}`);
  }
}
marcar('1.10 Enlaces externos abren en pestaña nueva', externosSinBlank.length === 0, lista(externosSinBlank));
marcar('1.10 Esos enlaces llevan rel="noopener"', blankSinRel.length === 0, lista(blankSinRel), true);

// 1.11 al menos 10 páginas
marcar('1.11 Al menos 10 secciones o páginas', html.length >= 10, `${html.length} páginas HTML (${PUBLICAS.length} públicas + panel)`);

// 1.13 / 1.21 nombres de archivo sin espacios, sin caracteres raros, en minúsculas
const nombresMalos = archivos.filter(a => { const n = path.basename(a); return /[^a-z0-9._-]/.test(n); }).map(a => path.relative(RAIZ, a));
marcar('1.13 / 1.21 Nombres de archivo en minúsculas, sin espacios ni caracteres especiales', nombresMalos.length === 0, lista(nombresMalos), true);

// 1.14 / 3.8 responsive
const conMedia = css.filter(c => /@media[^{]*(max|min)-width/i.test(leer(c))).length;
marcar('1.14 / 3.8 Media queries presentes', conMedia > 0, `${conMedia} de ${css.length} hojas de estilo las usan`);
const sinViewport = html.filter(a => !/name="viewport"/i.test(leer(a))).map(a => path.basename(a));
marcar('1.14 Viewport en todas las páginas', sinViewport.length === 0, lista(sinViewport));

// 1.19 imágenes pesadas
const pesadas = imagenes.map(a => ({ a, kb: Math.round(fs.statSync(a).size / 1024) })).filter(x => x.kb > 200);
marcar('1.19 Imágenes locales de menos de 200 KB', pesadas.length === 0, pesadas.map(x => `${path.relative(RAIZ, x.a)} (${x.kb} KB)`).join(', '), true);

// 1.20 / 4.5 console.log olvidados
const logs = js.filter(a => /console\.log\(/.test(leer(a))).map(a => path.basename(a));
marcar('1.20 / 4.5 Sin console.log de depuración', logs.length === 0, lista(logs), true);

// 1.22 README
marcar('1.22 README presente', fs.existsSync('README.md'));

// 1.23 / 4.3 comentarios
const sinComent = [...css, ...js].filter(a => !/\/\*[\s\S]*?\*\/|(^|\s)\/\/\s/.test(leer(a))).map(a => path.basename(a));
marcar('1.23 / 4.3 Comentarios en CSS y JS', sinComent.length === 0, 'sin comentarios: ' + lista(sinComent), true);

// ---------- Sección 2: HTML ----------
chequeoPorPagina('2.3 Exactamente un <h1> (públicas)', t => cuenta(sinComentarios(t), /<h1[\s>]/gi) === 1);
const h1Panel = html.filter(a => !PUBLICAS.includes(path.basename(a, '.html')) && cuenta(sinComentarios(leer(a)), /<h1[\s>]/gi) !== 1).map(a => path.basename(a));
marcar('2.3 Exactamente un <h1> (panel y otras)', h1Panel.length === 0, 'falla en: ' + lista(h1Panel), true);

// 2.2 / 6.2 saltos de jerarquía de encabezados
const saltos = [];
for (const a of html) {
  const t = sinComentarios(leer(a)); const re = /<h([1-6])[\s>]/gi; let m, prev = 0;
  while ((m = re.exec(t))) { const n = Number(m[1]); if (prev && n > prev + 1) { saltos.push(`${path.basename(a)} (h${prev}→h${n})`); break; } prev = n; }
}
marcar('2.2 / 6.2 Encabezados sin saltos de nivel', saltos.length === 0, lista(saltos), true);

// 2.7 / 6.11 inputs con label
const sinLabel = [];
for (const a of html) {
  const t = sinComentarios(leer(a)); const re = /<(input|select|textarea)\b[^>]*>/gi; let m;
  while ((m = re.exec(t))) {
    const e = m[0]; if (/type="(hidden|submit|button|checkbox|radio)"/i.test(e) && !/type="(checkbox|radio)"/i.test(e)) continue;
    const id = /\bid="([^"]+)"/i.exec(e);
    const tieneAria = /aria-label(ledby)?=/i.test(e);
    const tieneFor = id && new RegExp(`<label[^>]+for="${id[1]}"`, 'i').test(t);
    const envuelto = new RegExp(`<label[^>]*>[^<]*(?:<[^/l][^>]*>[^<]*)*${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(t);
    if (!tieneFor && !tieneAria && !envuelto) sinLabel.push(`${path.basename(a)} (${id ? '#' + id[1] : e.slice(0, 30)})`);
  }
}
marcar('2.7 / 6.11 Campos de formulario con label o aria-label', sinLabel.length === 0, lista(sinLabel), true);

// 2.8 / 6.1 alt
const sinAlt = [], altGenerico = [];
for (const a of html) {
  const t = sinComentarios(leer(a)); const re = /<img\b[^>]*>/gi; let m;
  while ((m = re.exec(t))) {
    const alt = /\balt="([^"]*)"/i.exec(m[0]);
    if (!alt) sinAlt.push(path.basename(a));
    else if (/^(imagen|foto|image|photo|img)$/i.test(alt[1].trim())) altGenerico.push(path.basename(a));
  }
}
marcar('2.8 / 6.1 Todas las <img> tienen alt', sinAlt.length === 0, lista([...new Set(sinAlt)]));
marcar('2.8 Alt no genérico ("imagen", "foto")', altGenerico.length === 0, lista([...new Set(altGenerico)]));

// 2.13 doctype / 2.14 / 2.17 lang
const sinDoctype = html.filter(a => !/^\s*<!doctype html>/i.test(leer(a))).map(a => path.basename(a));
marcar('2.14 <!DOCTYPE html> al inicio', sinDoctype.length === 0, lista(sinDoctype));
const sinLang = html.filter(a => !/<html[^>]+lang="/i.test(leer(a))).map(a => path.basename(a));
marcar('2.17 lang en <html>', sinLang.length === 0, lista(sinLang));

// 2.19 etiquetas obsoletas
const obsoletas = html.filter(a => /<(font|center|marquee|b|i|big|strike|tt)[\s>]/i.test(sinComentarios(leer(a)))).map(a => path.basename(a));
marcar('2.19 Sin etiquetas obsoletas (<font>, <center>, <marquee>, <b>, <i>)', obsoletas.length === 0, lista(obsoletas), true);

// 2.11 tablas: caption/thead
const tablasSinTh = html.filter(a => /<table[\s>]/i.test(sinComentarios(leer(a))) && !/<th[\s>]/i.test(sinComentarios(leer(a)))).map(a => path.basename(a));
marcar('2.12 Tablas con encabezados <th>', tablasSinTh.length === 0, lista(tablasSinTh), true);

// ---------- Sección 3: CSS ----------
const inlineStyle = [], bloqueStyle = [];
for (const a of html) {
  const t = sinComentarios(leer(a));
  const n = cuenta(t, /\sstyle="/gi); if (n) inlineStyle.push(`${path.basename(a)} (${n})`);
  if (/<style[\s>]/i.test(t)) bloqueStyle.push(path.basename(a));
}
marcar('3.2 Sin estilos inline (style="...")', inlineStyle.length === 0, lista(inlineStyle), true);
marcar('3.2 Sin bloques <style> en el HTML', bloqueStyle.length === 0, lista(bloqueStyle));
marcar('3.1 / 3.3 Hojas CSS externas', css.length > 0, `${css.length} hojas`);
marcar('3.9 Flexbox o grid', css.some(c => /display\s*:\s*(flex|grid|inline-flex)/i.test(leer(c))));
marcar('3.12 Imágenes con max-width:100%', css.some(c => /max-width\s*:\s*100%/i.test(leer(c))));
marcar('3.5 Fuentes importadas (Google Fonts)', html.some(a => /fonts\.googleapis\.com/i.test(leer(a))));
marcar('3.7 Unidades relativas (rem, em, %, vh, vw)', css.some(c => /\d(rem|em|vh|vw|%)/.test(leer(c))));
const importantes = css.map(c => ({ c: path.basename(c), n: cuenta(leer(c), /!important/g) })).filter(x => x.n > 0);
marcar('3.19 !important solo si está justificado', importantes.length === 0, importantes.map(x => `${x.c} (${x.n})`).join(', '), true);
marcar('6.9 Foco visible (:focus / :focus-visible)', css.some(c => /:focus(-visible)?/i.test(leer(c))));
marcar('6.18 Animaciones respetan prefers-reduced-motion', css.some(c => /prefers-reduced-motion/i.test(leer(c))) || js.some(c => /prefers-reduced-motion/i.test(leer(c))), '', true);
const cssMin = css.filter(c => leer(c).split('\n').length > 5).length;
marcar('3.18 CSS minificado', cssMin === 0, 'las hojas se mantienen legibles a propósito (sin paso de compilación)', true);

// ---------- Sección 4: JavaScript ----------
const inlineJs = [], handlers = [];
for (const a of html) {
  const t = sinComentarios(leer(a));
  if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(t)) inlineJs.push(path.basename(a));
  const n = cuenta(t, /\son(click|change|submit|load|mouseover|input|keyup|keydown)\s*=/gi); if (n) handlers.push(`${path.basename(a)} (${n})`);
}
marcar('4.2 Sin scripts inline en el HTML', inlineJs.length === 0, lista(inlineJs), true);
marcar('4.7 Sin onclick/onchange/... en atributos HTML', handlers.length === 0, lista(handlers), true);
marcar('4.7 Eventos con addEventListener', js.some(a => /addEventListener\(/.test(leer(a))));
const usanVar = js.map(a => ({ a: path.basename(a), n: cuenta(leer(a), /(^|[\s;(])var\s+[a-zA-Z_$]/gm) })).filter(x => x.n > 0);
marcar('4.14 let/const en lugar de var', usanVar.length === 0, usanVar.map(x => `${x.a} (${x.n})`).join(', '), true);
marcar('4.16 Funciones flecha y template literals', js.some(a => /=>/.test(leer(a))) && js.some(a => /`[^`]*\$\{/.test(leer(a))));
const sinDefer = html.filter(a => /<script[^>]+src=/i.test(leer(a)) && /<script(?![^>]*\b(defer|async|type="module")\b)[^>]+src=/i.test(leer(a))).map(a => path.basename(a));
marcar('4.9 Scripts cargados con defer (o al final del body)', sinDefer.length === 0, 'revisar orden/defer en: ' + lista(sinDefer), true);
marcar('4.19 localStorage / sessionStorage', js.some(a => /(local|session)Storage/.test(leer(a))), '', true);

// ---------- Sección 6: accesibilidad ----------
chequeoPorPagina('6.17 Enlace "saltar al contenido" (públicas)', t => /(skip|saltar)/i.test(t), true);
marcar('6.4 Atributos aria en elementos interactivos', html.some(a => /aria-(label|expanded|controls|hidden|live)/i.test(leer(a))));
const aquiGenerico = html.filter(a => />\s*(clic aquí|click aquí|haz clic aquí|aquí|click here)\s*</i.test(leer(a))).map(a => path.basename(a));
marcar('6.12 / 2.9 Enlaces sin "clic aquí"', aquiGenerico.length === 0, lista(aquiGenerico));

// ---------- Sección 7: opcionales ----------
const opc = [
  ['7.1 Favicon', html.some(a => /rel="icon"/i.test(leer(a)))],
  ['7.2 manifest.json (PWA)', fs.existsSync(path.join(RAIZ, 'manifest.json')) || fs.existsSync(path.join(RAIZ, 'manifest.webmanifest'))],
  ['7.4 Schema.org (JSON-LD o microdatos)', html.some(a => /application\/ld\+json|itemscope/i.test(leer(a)))],
  ['7.6 Íconos SVG', archivos.some(a => a.endsWith('.svg')) || html.some(a => /<svg[\s>]/i.test(leer(a)))],
  ['7.7 Mapa incrustado', html.some(a => /(maps\.google|google\.com\/maps|openstreetmap)/i.test(leer(a)))],
  ['7.8 Redes sociales', html.some(a => /(instagram|facebook|wa\.me|whatsapp)/i.test(leer(a)))],
  ['7.9 Formulario funcional con validación', html.some(a => /<form[\s>]/i.test(leer(a)))],
  ['7.14 Descarga de recursos (PDF)', html.some(a => /\.pdf/i.test(leer(a)))],
  ['7.19 Animaciones por scroll', js.some(a => /IntersectionObserver/.test(leer(a)))],
  ['7.20 Volver arriba', html.some(a => /(volver arriba|back-to-top|scrollTo)/i.test(leer(a))) || js.some(a => /scrollTo\(/.test(leer(a)))],
  ['robots.txt', fs.existsSync(path.join(RAIZ, 'robots.txt'))],
  ['sitemap.xml', fs.existsSync(path.join(RAIZ, 'sitemap.xml'))]
];
for (const [punto, ok] of opc) resultados.push({ punto: 'Opcional ' + punto, estado: ok ? 'OK' : 'NO TIENE', detalle: '' });

// ---------- Informe ----------
const ancho = Math.max(...resultados.map(r => r.punto.length)) + 2;
console.log('INFORME DE AUDITORÍA — checklist "Considerandos para la construcción de la página WEB"');
console.log(`Páginas HTML: ${html.length} | hojas CSS: ${css.length} | archivos JS: ${js.length} | imágenes: ${imagenes.length}\n`);
for (const r of resultados) console.log(`${r.estado.padEnd(9)} ${r.punto.padEnd(ancho)} ${r.detalle}`);
const total = (e) => resultados.filter(r => r.estado === e).length;
console.log(`\nResumen: ${total('OK')} OK | ${total('REVISAR')} para revisar | ${total('FALLA')} fallan | ${total('NO TIENE')} opcionales que no tiene`);
console.log('\nNo se pudo automatizar (hay que mirarlo a mano o con herramientas): validador W3C (2.13 / 3.14), contraste 4.5:1 (6.10),\nWCAG AA (6.20), compatibilidad entre navegadores (1.27), teclado/tabulación (6.3 / 6.16), ortografía y contenido (sección 5).');
