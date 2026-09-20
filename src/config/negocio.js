// Reglas de negocio en un único lugar (antes estaban repetidas en varios archivos).

// Recargo que se suma al precio de una pizza mitad y mitad.
const RECARGO_MITAD_Y_MITAD = 1000;

const MEDIOS_PAGO = ['efectivo', 'transferencia', 'mixto'];
const TIPOS_ENTREGA = ['retiro', 'envio'];
const ESTADOS_PEDIDO = ['pendiente', 'en preparación', 'entregado', 'cancelado'];
const TIPOS_MASA = ['piedra', 'molde'];
const ROLES = ['admin', 'cajero'];

module.exports = { RECARGO_MITAD_Y_MITAD, MEDIOS_PAGO, TIPOS_ENTREGA, ESTADOS_PEDIDO, TIPOS_MASA, ROLES };
