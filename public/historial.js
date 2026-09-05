const API_URL = window.location.origin;
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

const usuario = JSON.parse(localStorage.getItem("usuario"));
document.getElementById("info-usuario").textContent =
  `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin([
  "link-productos",
  "link-compras",
  "link-caja",
  "link-usuarios",
]);

document.getElementById("btn-logout").addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  window.location.href = "login.html";
});

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearPrecio(numero) {
  return Number(numero).toLocaleString("es-AR");
}

// Calcula la fecha de "hoy" en el día comercial (ajustado 6 horas, igual que el backend)
function obtenerFechaComercial(offsetDias = 0) {
  const ahora = new Date();
  ahora.setHours(ahora.getHours() - 6);
  ahora.setDate(ahora.getDate() + offsetDias);
  return ahora.toISOString().split("T")[0];
}

async function cargarHistorial(fecha) {
  const respuesta = await fetch(`${API_URL}/pedidos/por-fecha?fecha=${fecha}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pedidos = await respuesta.json();

  const contenedor = document.getElementById("contenedor-historial");
  contenedor.innerHTML = "";

  if (pedidos.length === 0) {
    contenedor.innerHTML = "<p>No hay pedidos para esta fecha.</p>";
    return;
  }

  pedidos.forEach((pedido) => {
    const div = document.createElement("div");
    div.className = "pedido";

    const entrega =
      pedido.tipo_entrega === "envio"
        ? `Envío - ${pedido.direccion_entrega || "sin dirección"}`
        : "Retiro en local";

    const detalleProductos = pedido.productos
      .map((item) => {
        const nombre = item.nombre_producto_2
          ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
          : item.nombre_producto;
        return `${item.cantidad} x ${nombre}`;
      })
      .join(", ");

    let infoFactura = "";
    if (pedido.requiere_factura) {
      const botonVerNCHtml = pedido.tiene_nota_credito
        ? `<button type="button" class="btn-ver-nc" data-id="${pedido.id}">Ver nota de crédito</button>`
        : "";

      infoFactura = pedido.ya_facturado
        ? `Factura N° ${pedido.numero_comprobante} - CAE: ${pedido.cae} (vto: ${pedido.vencimiento_cae ? pedido.vencimiento_cae.split("T")[0] : ""})
       <button type="button" class="btn-ver-pdf" data-id="${pedido.id}">Ver PDF</button>
       <button type="button" class="btn-anular-factura" data-id="${pedido.id}" data-total="${pedido.total}">Anular factura</button>
       ${botonVerNCHtml}`
        : "Requiere factura - sin emitir";
    }

    div.innerHTML = `
      <strong>#${pedido.id} - ${pedido.cliente}</strong> - ${formatearFecha(pedido.creado_en)}<br>
      Canal: ${pedido.canal} | Pago: ${pedido.medio_pago} | ${entrega}<br>
      Productos: ${detalleProductos}<br>
      Total: $${formatearPrecio(pedido.total)} | Estado: ${pedido.estado}<br>
      ${infoFactura ? `${infoFactura}<br>` : ""}
    `;
    contenedor.appendChild(div);

    const botonPdf = div.querySelector(".btn-ver-pdf");
    if (botonPdf) {
      botonPdf.addEventListener("click", () => verPdf(botonPdf.dataset.id));
    }

    const botonAnular = div.querySelector(".btn-anular-factura");
    if (botonAnular) {
      botonAnular.addEventListener("click", () =>
        anularFactura(
          botonAnular.dataset.id,
          Number(botonAnular.dataset.total),
          fecha,
        ),
      );
    }
    const botonVerNC = div.querySelector(".btn-ver-nc");
    if (botonVerNC) {
      botonVerNC.addEventListener("click", () =>
        verNotaCredito(botonVerNC.dataset.id),
      );
    }
  });
}

async function verPdf(pedidoId) {
  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok) {
    alert("No se pudo obtener el PDF de la factura");
    return;
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
async function verNotaCredito(pedidoId) {
  const respuesta = await fetch(
    `${API_URL}/pedidos/${pedidoId}/pdf-nota-credito`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!respuesta.ok) {
    const error = await respuesta.json();
    alert(error.error || "No se pudo obtener la nota de crédito");
    return;
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

async function anularFactura(pedidoId, totalFactura, fechaActual) {
  const montoTexto = prompt(
    `¿Qué monto querés acreditar? (Total facturado: $${formatearPrecio(totalFactura)})`,
    totalFactura,
  );

  if (montoTexto === null) return; // canceló el prompt

  const monto = Number(montoTexto);

  if (!monto || monto <= 0 || monto > totalFactura) {
    alert(
      "Monto inválido. Tiene que ser mayor a $0 y no superar el total de la factura.",
    );
    return;
  }

  const motivo = prompt("Motivo de la anulación (opcional):", "") || null;

  const confirmar = confirm(
    `⚠ ATENCIÓN — Acción irreversible ⚠\n\n` +
      `Vas a emitir una Nota de Crédito por $${formatearPrecio(monto)}, ` +
      `asociada al pedido #${pedidoId}.\n\n` +
      `Esto queda registrado formalmente ante ARCA y NO se puede deshacer ni editar después.\n\n` +
      `¿Estás seguro de que querés continuar?`,
  );
  if (!confirmar) return;

  const respuesta = await fetch(
    `${API_URL}/pedidos/${pedidoId}/anular-factura`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ monto, motivo }),
    },
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    alert(datos.error || "Error al emitir la nota de crédito");
    return;
  }

  alert(`Nota de crédito emitida. CAE: ${datos.cae}`);
  cargarHistorial(fechaActual);
}

document.getElementById("filtro-fecha").addEventListener("change", (event) => {
  cargarHistorial(event.target.value);
});

document.getElementById("btn-hoy").addEventListener("click", () => {
  const fecha = obtenerFechaComercial(0);
  document.getElementById("filtro-fecha").value = fecha;
  cargarHistorial(fecha);
});

document.getElementById("btn-ayer").addEventListener("click", () => {
  const fecha = obtenerFechaComercial(-1);
  document.getElementById("filtro-fecha").value = fecha;
  cargarHistorial(fecha);
});

// ---- Al cargar la página: mostrar hoy por defecto ----
const fechaInicial = obtenerFechaComercial(0);
document.getElementById("filtro-fecha").value = fechaInicial;
cargarHistorial(fechaInicial);
