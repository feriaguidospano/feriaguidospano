/**
 * Pegá este código en Extensiones > Apps Script de tu Google Sheet.
 * Implementar > Nueva implementación > Tipo: Aplicación web
 * - Ejecutar como: Yo
 * - Quién tiene acceso: Cualquier persona
 * Copiá la URL y ponela en SHEETS_API_URL de script.js
 */

const HOJA_PEDIDOS = "Pedidos";

const COLUMNAS = [
  "referencia",
  "fecha_pedido",
  "fecha_lista",
  "nombre",
  "apellido",
  "telefono",
  "email",
  "categoria",
  "producto",
  "cantidad",
  "unidad",
  "precio_unitario",
  "subtotal",
  "total_pedido"
];

function parseOrderPayload(e) {
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  throw new Error("No llegaron datos del pedido.");
}

function doPost(e) {
  try {
    const data = parseOrderPayload(e);
    const result = guardarPedido(data);
    return respuestaJson(result);
  } catch (error) {
    return respuestaJson({ ok: false, error: String(error.message || error) });
  }
}

function doGet() {
  return respuestaJson({ ok: true, mensaje: "API de pedidos NGS activa" });
}

function respuestaJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function obtenerHojaPedidos() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA_PEDIDOS);

  if (!hoja) {
    hoja = libro.insertSheet(HOJA_PEDIDOS);
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold");
  } else if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
  }

  return hoja;
}

function guardarPedido(data) {
  const productos = Array.isArray(data.productos) ? data.productos : [];
  if (!productos.length) {
    throw new Error("El pedido no trae productos.");
  }

  const hoja = obtenerHojaPedidos();
  const referencia = data.referencia || Utilities.getUuid();
  const fechaPedido = data.fecha_pedido ? new Date(data.fecha_pedido) : new Date();

  productos.forEach(function (producto) {
    hoja.appendRow([
      referencia,
      fechaPedido,
      data.fecha_lista || "",
      data.nombre || "",
      data.apellido || "",
      data.telefono || "",
      data.email || "",
      producto.categoria || "",
      producto.nombre || "",
      Number(producto.cantidad) || 0,
      producto.unidad || "",
      Number(producto.precio) || 0,
      Number(producto.subtotal) || 0,
      Number(data.total) || 0
    ]);
  });

  return {
    ok: true,
    id: referencia,
    referencia: referencia,
    filas: productos.length
  };
}
