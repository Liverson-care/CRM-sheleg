export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Date seule (JJ/MM/AAAA), sans l'heure. Gère "AAAA-MM-JJ" et "AAAA-MM-JJ HH:MM:SS". */
export function formatDateShort(value: string): string {
  if (!value) return '';
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

import type { Product } from './types';

/** Nombre de pièces par colis (défaut 1). */
export function packSize(p: Product): number {
  return p.packSize && p.packSize > 0 ? p.packSize : 1;
}

/** Prix à l'unité (par pièce) = prix du colis / nombre de pièces. */
export function unitPrice(p: Product): number {
  return p.unitPrice ?? p.list_price / packSize(p);
}

/**
 * Tri par code article : codes renseignés d'abord (ordre alphanumérique
 * naturel), puis les produits sans code, départagés par le nom.
 */
export function byCode(a: Product, b: Product): number {
  const ca = (a.default_code || '').trim();
  const cb = (b.default_code || '').trim();
  if (ca && cb) {
    const c = ca.localeCompare(cb, 'fr', { numeric: true, sensitivity: 'base' });
    if (c !== 0) return c;
  } else if (ca !== cb) {
    return ca ? -1 : 1; // un code vide passe après un code renseigné
  }
  return (a.name || '').localeCompare(b.name || '', 'fr');
}

/**
 * Niveau de stock pour la pastille : vert (≥100), orange (<100), rouge (0).
 */
export function stockLevel(qty: number): { cls: string; label: string } {
  if (qty <= 0) return { cls: 'rupture', label: 'Rupture' };
  if (qty < 100) return { cls: 'faible', label: `Stock faible · ${qty}` };
  return { cls: 'ok', label: `En stock · ${qty}` };
}

export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    devis: 'Devis',
    envoyee: 'Envoyée',
    confirmee: 'Confirmée',
    livree: 'Livrée',
    annulee: 'Annulée',
  };
  return map[status] || status;
}
