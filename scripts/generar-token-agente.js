// Genera el token del agente de impresión de UNA sucursal.
//
// Uso:   node scripts/generar-token-agente.js <sucursal_id> [dias]
// Ej.:   node scripts/generar-token-agente.js 2 365
//
// - Hay que indicar el secreto del ambiente donde se va a usar el token (el JWT_SECRET de ESE servidor).
//   No lee el .env a propósito: así no se firma sin querer con el secreto de otro ambiente.
//       PowerShell:   $env:JWT_SECRET = '...'
// - El token solo sirve para pedir los pedidos por imprimir de su sucursal y confirmarlos (ver middlewares/auth.js).
// - Vence a los <dias> (por defecto 365). Anotá la fecha y volvé a correr el script antes de que venza.
// - El token es una credencial: se pega solo en la configuración del agente (AGENTE_TOKEN), nunca en un chat.
const jwt = require('jsonwebtoken');

const sucursalId = Number(process.argv[2]);
const dias = process.argv[3] === undefined ? 365 : Number(process.argv[3]);

if (!Number.isInteger(sucursalId) || sucursalId <= 0) {
  console.error('Falta la sucursal. Uso: node scripts/generar-token-agente.js <sucursal_id> [dias]');
  process.exit(1);
}
if (!Number.isInteger(dias) || dias <= 0 || dias > 730) {
  console.error('Los días tienen que ser un número entero entre 1 y 730.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET: definilo con el secreto del ambiente donde se va a usar este token.');
  process.exit(1);
}

const token = jwt.sign(
  { nombre: `Agente de impresión (sucursal ${sucursalId})`, rol: 'cajero', esAgente: true, sucursal_id: sucursalId },
  process.env.JWT_SECRET,
  { expiresIn: `${dias}d`, algorithm: 'HS256' }
);

const vence = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
console.error(`Token del agente de la sucursal ${sucursalId}. Vence el ${vence.toLocaleDateString('es-AR')}.`);
console.error('Copialo en AGENTE_TOKEN del agente. No lo pegues en ningún chat.\n');
console.log(token);