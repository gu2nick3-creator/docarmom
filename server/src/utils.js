import { nanoid } from 'nanoid';

export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function toCents(price) {
  // Accept number or string like "189.90"
  const n = typeof price === 'number' ? price : Number(String(price).replace(',', '.'));
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

export function orderNumber() {
  // Ex: PED-AB12CD
  return `PED-${nanoid(6).toUpperCase()}`;
}

export function mapOrderStatusToEnum(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ENTREGUE') return 'ENTREGUE';
  if (s === 'CANCELADO' || s === 'CANCELLED') return 'CANCELADO';
  if (s === 'FINALIZADO' || s === 'FINALIZADA') return 'FINALIZADO';
  return 'PENDENTE';
}

export function mapMpStatus(mpStatus) {
  // Mercado Pago: approved, pending, rejected, cancelled, refunded, charged_back
  const s = String(mpStatus || '').toLowerCase();
  if (s === 'approved') return 'APPROVED';
  if (s === 'rejected') return 'REJECTED';
  if (s === 'cancelled') return 'CANCELLED';
  if (s === 'refunded') return 'REFUNDED';
  if (s === 'charged_back') return 'CHARGEDBACK';
  return 'PENDING';
}
