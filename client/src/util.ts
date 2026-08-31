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

export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    devis: 'Devis',
    envoyee: 'Envoyée',
    confirmee: 'Confirmée',
    annulee: 'Annulée',
  };
  return map[status] || status;
}
