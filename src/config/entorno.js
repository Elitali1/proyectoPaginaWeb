// Revisa las variables de entorno al arrancar el servidor.
//
// Dos niveles:
//  - CRÍTICAS: sin ellas el sistema no puede funcionar bien (base, sesiones, facturación).
//    Si falta una o tiene un formato inválido, el servidor NO arranca y el log dice cuál.
//    Es mejor un error claro al desplegar que un fallo raro con clientes esperando.
//  - OPCIONALES: sin ellas funciona lo principal pero falla una parte (fotos, mails, etc.).
//    El servidor arranca y deja un aviso en el log.
//
// Nunca se muestran los VALORES de las variables, solo los nombres.

const CRITICAS = [
  { nombre: 'DATABASE_URL', motivo: 'la base de datos' },
  { nombre: 'JWT_SECRET', motivo: 'firmar y validar sesiones' },
  { nombre: 'ARCA_CUIT', motivo: 'facturar en ARCA', formato: /^\d{11}$/, formatoTexto: 'tiene que ser un CUIT de 11 dígitos, sin guiones' },
  { nombre: 'ARCA_CBTE_TIPO', motivo: 'el tipo de comprobante (Factura C = 11)', formato: /^\d+$/, formatoTexto: 'tiene que ser un número entero (por ejemplo 11)' }
];

const OPCIONALES = [
  { nombre: 'ARCA_PTO_VTA', motivo: 'comprobantes viejos y sucursales sin punto de venta cargado' },
  { nombre: 'ARCA_PRODUCTION', motivo: 'si no está, ARCA queda en homologación (no emite comprobantes reales)' },
  { nombre: 'FRONTEND_URL', motivo: 'CORS: si falta, el navegador solo acepta localhost' },
  { nombre: 'CLOUDINARY_CLOUD_NAME', motivo: 'subir fotos de productos' },
  { nombre: 'CLOUDINARY_API_KEY', motivo: 'subir fotos de productos' },
  { nombre: 'CLOUDINARY_API_SECRET', motivo: 'subir fotos de productos' },
  { nombre: 'BREVO_API_KEY', motivo: 'enviar mails (recuperar contraseña, contacto)' },
  { nombre: 'SENDER_EMAIL', motivo: 'enviar mails' },
  { nombre: 'SENDER_NAME', motivo: 'enviar mails' }
];

function estaVacia(valor) {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

// Devuelve { errores, avisos } (listas de textos). No imprime ni termina el proceso: así se puede probar.
function revisarEntorno(env) {
  const errores = [];
  const avisos = [];

  for (const variable of CRITICAS) {
    const valor = env[variable.nombre];
    if (estaVacia(valor)) {
      errores.push(`Falta la variable ${variable.nombre} (se usa para ${variable.motivo}).`);
    } else if (variable.formato && !variable.formato.test(String(valor).trim())) {
      errores.push(`La variable ${variable.nombre} tiene un formato inválido: ${variable.formatoTexto}.`);
    }
  }

  for (const variable of OPCIONALES) {
    if (estaVacia(env[variable.nombre])) {
      avisos.push(`Falta la variable ${variable.nombre}: ${variable.motivo}.`);
    }
  }

  // Los certificados de ARCA vienen por variable o por archivo; acá solo se avisa si no hay variable.
  if (estaVacia(env.ARCA_CERT) || estaVacia(env.ARCA_KEY)) {
    avisos.push('Falta ARCA_CERT o ARCA_KEY: se van a buscar los certificados en la carpeta certificados-arca.');
  }

  return { errores, avisos };
}

// Se llama una vez, al arrancar. Si hay errores críticos, muestra todos juntos y termina el proceso.
function validarEntorno(env = process.env) {
  const { errores, avisos } = revisarEntorno(env);

  avisos.forEach(aviso => console.warn(`[entorno] AVISO: ${aviso}`));

  if (errores.length > 0) {
    errores.forEach(error => console.error(`[entorno] ERROR: ${error}`));
    console.error('[entorno] El servidor no arranca hasta corregir las variables de arriba.');
    process.exit(1);
  }
}

module.exports = { revisarEntorno, validarEntorno };