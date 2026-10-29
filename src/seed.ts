import { addComment, createRequest, transitionRequest } from './domain';
import type { CreateInput, RequestStatus, SupportRequest } from './types';

export function createSeedRequests(now = new Date().toISOString()): SupportRequest[] {
  const reference = Date.parse(now);
  if (!Number.isFinite(reference)) throw new Error('La fecha de los datos de demostración no es válida.');
  const cases: (CreateInput & { status: RequestStatus; note?: string })[] = [
    { customer: 'Panadería Brisa', title: 'No podemos acceder al panel', description: 'El equipo recibe un mensaje de sesión expirada al entrar al panel de pedidos.', category: 'access', priority: 'urgent', status: 'new' },
    { customer: 'Taller Horizonte', title: 'El informe de ventas no carga', description: 'Al seleccionar el mes actual, el informe queda cargando y no muestra los totales.', category: 'software', priority: 'normal', status: 'in_progress' },
    { customer: 'Librería Luma', title: 'Corregir los datos de la factura', description: 'La factura de este mes muestra un nombre comercial anterior. Solicitamos actualizarlo.', category: 'billing', priority: 'normal', status: 'resolved', note: 'Se corrigió el nombre comercial y se verificó la nueva factura con los datos ficticios del cliente.' },
    { customer: 'Estudio Laurel', title: 'Añadir una categoría al formulario', description: 'Necesitamos clasificar consultas sobre entregas con una categoría adicional en el formulario.', category: 'other', priority: 'low', status: 'new' },
    { customer: 'Café Nube', title: 'Error al guardar nuevos pedidos', description: 'El botón de guardar devuelve un error y el pedido no aparece en la lista del turno.', category: 'software', priority: 'urgent', status: 'in_progress' },
    { customer: 'Mercado Sendero', title: 'Restablecer el acceso del encargado', description: 'El encargado cambió de equipo y necesita volver a entrar a su cuenta de demostración.', category: 'access', priority: 'normal', status: 'resolved', note: 'Se restableció el acceso en el entorno de demostración y se comprobó el inicio de sesión.' },
    { customer: 'Academia Faro', title: 'Cambiar el texto de bienvenida', description: 'Queremos actualizar el mensaje inicial para incluir los horarios de atención del equipo.', category: 'other', priority: 'low', status: 'new' },
    { customer: 'Bodega Cobalto', title: 'Revisar un cobro repetido', description: 'El resumen de pagos parece mostrar dos veces el mismo concepto de servicio del mes.', category: 'billing', priority: 'normal', status: 'in_progress' },
  ];

  return cases.map((data, index) => {
    const created = reference - (12 + index * 7) * 60 * 60 * 1000;
    const at = (hours: number) => new Date(created + hours * 60 * 60 * 1000).toISOString();
    let item = createRequest(data, at(0), `MS-${1048 + index}`);
    if (data.status !== 'new') {
      item = transitionRequest(item, 'in_progress', undefined, at(1));
      item = addComment(item, 'Se revisó la solicitud y se registraron los pasos para reproducir el caso.', at(2));
    }
    if (data.status === 'resolved') item = transitionRequest(item, 'resolved', data.note, at(3));
    return item;
  });
}
