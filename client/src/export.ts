import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product } from './types';
import { formatEuro } from './util';

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
