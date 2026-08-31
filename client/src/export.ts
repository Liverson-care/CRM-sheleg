import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product, OrderDetail } from './types';
import { formatEuro, orderStatusLabel } from './util';

interface ExportOptions {
  withPrices: boolean;
}

const DATE = () => new Date().toLocaleDateString('fr-FR');

/** Export du catalogue au format Excel (.xlsx). */
export function exportExcel(products: Product[], { withPrices }: ExportOptions) {
  const rows = products.map((p) => {
    const row: Record<string, string | number> = {
      Catégorie: p.category,
      Code: p.default_code,
      Produit: p.name,
      'Code-barres': p.barcode,
      Unité: p.uom,
    };
    if (withPrices) row['Prix (€)'] = p.list_price;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
  XLSX.writeFile(wb, `catalogue-sheleg-${withPrices ? 'avec-prix' : 'sans-prix'}.xlsx`);
}

/** Export du catalogue au format PDF. */
export function exportPDF(products: Product[], { withPrices }: ExportOptions) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(7, 58, 107);
  doc.text('Catalogue Sheleg', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Édité le ${DATE()} · ${products.length} produits`, 14, 25);

  const head = withPrices
    ? [['Catégorie', 'Code', 'Produit', 'Unité', 'Prix']]
    : [['Catégorie', 'Code', 'Produit', 'Unité']];

  const body = products.map((p) => {
    const base = [p.category, p.default_code, p.name, p.uom];
    return withPrices ? [...base, formatEuro(p.list_price)] : base;
  });

  autoTable(doc, {
    head,
    body,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [11, 92, 171], textColor: 255 },
    alternateRowStyles: { fillColor: [242, 248, 253] },
    columnStyles: withPrices ? { 4: { halign: 'right' } } : {},
  });

  doc.save(`catalogue-sheleg-${withPrices ? 'avec-prix' : 'sans-prix'}.pdf`);
}

/** Construit le PDF d'une commande et renvoie le document jsPDF. */
export function buildOrderPDF(order: OrderDetail): jsPDF {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(7, 58, 107);
  doc.text('Sheleg', 14, 18);
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(`Commande ${order.reference}`, 14, 27);

  doc.setFontSize(10);
  doc.setTextColor(120);
  const meta = [
    `Client : ${order.client}`,
    `Statut : ${orderStatusLabel(order.status)}`,
    order.deliveryDate ? `Livraison souhaitée : ${order.deliveryDate}` : '',
  ].filter(Boolean);
  meta.forEach((line, i) => doc.text(line, 14, 35 + i * 5));

  autoTable(doc, {
    startY: 35 + meta.length * 5 + 3,
    head: [['Produit', 'Qté', 'PU HT', 'Remise', 'Total HT']],
    body: order.lines.map((l) => [
      l.name,
      String(l.qty),
      formatEuro(l.price),
      l.discount ? `${l.discount}%` : '—',
      formatEuro(l.totalHT),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [11, 92, 171], textColor: 255 },
    alternateRowStyles: { fillColor: [242, 248, 253] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right' } },
  });

  // @ts-expect-error lastAutoTable est ajouté par jspdf-autotable
  let y = (doc.lastAutoTable?.finalY ?? 80) + 8;
  const totals: [string, string][] = [
    ['Total HT', formatEuro(order.totalHT)],
    ['TVA', formatEuro(order.totalTVA)],
    ['Total TTC', formatEuro(order.totalTTC)],
  ];
  doc.setFontSize(11);
  totals.forEach(([label, val], i) => {
    const bold = i === totals.length - 1;
    doc.setTextColor(bold ? 7 : 90, bold ? 58 : 90, bold ? 107 : 90);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 140, y);
    doc.text(val, 196, y, { align: 'right' });
    y += 6;
  });

  if (order.comment) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.setFontSize(9);
    doc.text(`Commentaire : ${order.comment}`, 14, y + 4);
  }

  return doc;
}

/** Télécharge le PDF de la commande. */
export function downloadOrderPDF(order: OrderDetail) {
  buildOrderPDF(order).save(`commande-${order.reference}.pdf`);
}

/**
 * Envoie la commande au client en PDF depuis la tablette.
 * Utilise le partage natif (Mail avec pièce jointe) si disponible, sinon
 * télécharge le PDF et ouvre l'application e-mail pré-remplie.
 */
export async function shareOrderPDF(order: OrderDetail, emails: string[]) {
  const doc = buildOrderPDF(order);
  const blob = doc.output('blob') as Blob;
  const file = new File([blob], `commande-${order.reference}.pdf`, { type: 'application/pdf' });
  const subject = `Commande Sheleg ${order.reference}`;
  const text = `Bonjour,\n\nVeuillez trouver ci-joint votre commande ${order.reference} (${formatEuro(order.totalTTC)} TTC).\n\nCordialement,\nSheleg`;

  const nav = navigator as Navigator & {
    canShare?: (data?: unknown) => boolean;
    share?: (data?: unknown) => Promise<void>;
  };
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: subject, text });
      return;
    } catch {
      /* partage annulé : on retombe sur le téléchargement + e-mail */
    }
  }

  // Repli : téléchargement du PDF + ouverture de l'e-mail (pièce jointe manuelle).
  doc.save(file.name);
  const href = `mailto:${emails.join(',')}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(text + '\n\n(Joindre le PDF téléchargé.)')}`;
  window.location.href = href;
}
