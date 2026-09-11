requiereAdmin();

const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarInsumos() {
  const respuesta = await fetch(`${API_URL}/insumos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const insumos = await respuesta.json();

  mostrarAlertasStock(insumos);

  const contenedor = document.getElementById('contenedor-insumos');
  contenedor.innerHTML = '';

  if (insumos.length === 0) {
    contenedor.innerHTML = '<p>No hay insumos cargados todavía.</p>';
    return;
  }

  insumos.forEach(insumo => {
    const stockBajo = Number(insumo.stock_minimo) > 0 && Number(insumo.stock_actual) < Number(insumo.stock_minimo);

    const div = document.createElement('div');
    div.className = 'pedido';
    if (stockBajo) {
      div.style.border = '2px solid #B03A2E';
    }
    div.innerHTML = `
      <strong>${insumo.nombre}</strong> (${insumo.unidad_medida})
      ${insumo.activo ? '' : ' (inactivo)'}
      ${stockBajo ? ' <span class="balance-negativo">⚠ STOCK BAJO</span>' : ''}<br>
      Stock actual: ${insumo.stock_actual} ${insumo.unidad_medida}<br>
      Stock mínimo: ${insumo.stock_minimo} ${insumo.unidad_medida}<br>
      Último costo: $${formatearPrecio(insumo.costo_unitario)} por ${insumo.unidad_medida}
      <button type="button" class="btn-editar-insumo" data-id="${insumo.id}" data-nombre="${insumo.nombre}" data-unidad="${insumo.unidad_medida}" data-minimo="${insumo.stock_minimo}">Editar</button>
      <button type="button" class="btn-ajustar-stock" data-id="${insumo.id}" data-nombre="${insumo.nombre}" data-unidad="${insumo.unidad_medida}">Ajustar stock</button>
      <button type="button" class="btn-toggle-activo" data-id="${insumo.id}" data-activo="${insumo.activo}">
        ${insumo.activo ? 'Desactivar' : 'Reactivar'}
      </button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-toggle-activo').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const activoActual = boton.dataset.activo === 'true';

      await fetch(`${API_URL}/insumos/${id}/activo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activo: !activoActual })
      });

      cargarInsumos();
    });
  });

  document.querySelectorAll('.btn-ajustar-stock').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const nombre = boton.dataset.nombre;
      const unidad = boton.dataset.unidad;

      const cantidadTexto = prompt(
        `Ajustar stock de "${nombre}" (${unidad}).\nUsá un número positivo para sumar, negativo para restar (ej: -5 o 10):`
      );

      if (cantidadTexto === null) return;

      const cantidad = Number(cantidadTexto);

      if (!cantidad || cantidad === 0) {
        alert('Ingresá un número distinto de cero');
        return;
      }

      const motivo = prompt('Motivo del ajuste (opcional):', '') || null;

      const respuesta = await fetch(`${API_URL}/insumos/${id}/ajustar-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cantidad, motivo })
      });

      if (!respuesta.ok) {
        const error = await respuesta.json();
        alert(error.error || 'Error al ajustar el stock');
        return;
      }

      cargarInsumos();
    });
  });

  document.querySelectorAll('.btn-editar-insumo').forEach(boton => {
    boton.addEventListener('click', () => {
      editandoId = boton.dataset.id;
      document.getElementById('insumo-nombre').value = boton.dataset.nombre;
      document.getElementById('insumo-unidad').value = boton.dataset.unidad;
      document.getElementById('insumo-stock-minimo').value = boton.dataset.minimo;
      document.getElementById('titulo-formulario-insumo').textContent = 'Editar insumo';
      document.getElementById('btn-guardar-insumo').textContent = 'Guardar cambios';
      document.getElementById('btn-cancelar-edicion-insumo').classList.remove('oculto');
      document.getElementById('formulario-insumo').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function mostrarAlertasStock(insumos) {
  const conStockBajo = insumos.filter(i =>
    i.activo && Number(i.stock_minimo) > 0 && Number(i.stock_actual) < Number(i.stock_minimo)
  );

  const seccion = document.getElementById('seccion-alertas-stock');
  const contenedor = document.getElementById('contenedor-alertas-stock');

  if (conStockBajo.length === 0) {
    seccion.classList.add('oculto');
    return;
  }

  seccion.classList.remove('oculto');
  contenedor.innerHTML = '';

  conStockBajo.forEach(insumo => {
    const p = document.createElement('p');
    p.className = 'balance-negativo';
    p.innerHTML = `<strong>${insumo.nombre}</strong>: quedan ${insumo.stock_actual} ${insumo.unidad_medida} (mínimo: ${insumo.stock_minimo} ${insumo.unidad_medida})`;
    contenedor.appendChild(p);
  });
}

document.getElementById('btn-cancelar-edicion-insumo').addEventListener('click', () => {
  editandoId = null;
  document.getElementById('formulario-insumo').reset();
  document.getElementById('titulo-formulario-insumo').textContent = 'Agregar insumo';
  document.getElementById('btn-guardar-insumo').textContent = 'Guardar insumo';
  document.getElementById('btn-cancelar-edicion-insumo').classList.add('oculto');
});

document.getElementById('formulario-insumo').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datosInsumo = {
    nombre: document.getElementById('insumo-nombre').value,
    unidad_medida: document.getElementById('insumo-unidad').value,
    stock_minimo: Number(document.getElementById('insumo-stock-minimo').value) || 0
  };

  if (editandoId) {
    await fetch(`${API_URL}/insumos/${editandoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datosInsumo)
    });

    await fetch(`${API_URL}/insumos/${editandoId}/stock-minimo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ stock_minimo: datosInsumo.stock_minimo })
    });

    editandoId = null;
    document.getElementById('titulo-formulario-insumo').textContent = 'Agregar insumo';
    document.getElementById('btn-guardar-insumo').textContent = 'Guardar insumo';
    document.getElementById('btn-cancelar-edicion-insumo').classList.add('oculto');
  } else {
    await fetch(`${API_URL}/insumos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datosInsumo)
    });
  }

  document.getElementById('formulario-insumo').reset();
  cargarInsumos();
});

cargarInsumos();