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
