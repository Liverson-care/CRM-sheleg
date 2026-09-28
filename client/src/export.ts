import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product, OrderDetail, Client } from './types';
import { formatEuro, formatDateShort, unitPrice, packSize } from './util';

/** Montant en euros, format français : virgule décimale, espace milliers, « € ». */
function euroPdf(n: number): string {
  const v = (Math.round(((n || 0) + Number.EPSILON) * 100) / 100).toFixed(2);
  const [int, dec] = v.split('.');
  const intSpaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${intSpaced},${dec} €`;
}

/** Pourcentage avec virgule décimale, sans zéros inutiles (ex. 33,33 %). */
function pctPdf(n: number): string {
  return `${String(n).replace('.', ',')} %`;
}

/**
 * Remplace les caractères absents de l'encodage des polices jsPDF (WinAnsi)
 * pour éviter qu'ils disparaissent dans le PDF (ex. « bœuf » → « buf »).
 */
function pdfSafe(s: string): string {
  return (s || '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
}

// Logo chargé une fois puis mis en cache (data URL + dimensions).
// Redimensionné (~600 px de large) pour alléger le PDF : jsPDF embarque
// l'image en pixels bruts, un logo pleine résolution pèserait plusieurs Mo.
type LogoData = { dataUrl: string; w: number; h: number };
let logoCache: LogoData | null = null;
async function loadLogoDataUrl(): Promise<LogoData> {
  if (logoCache) return logoCache;
  const res = await fetch('/sheleg-logo.png');
  const blob = await res.blob();
  const srcUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  logoCache = await new Promise<LogoData>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 600;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      try {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: c.toDataURL('image/png'), w, h });
      } catch {
        resolve({ dataUrl: srcUrl, w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onerror = () => resolve({ dataUrl: srcUrl, w: 1472, h: 467 });
    img.src = srcUrl;
  });
  return logoCache;
}

interface ExportOptions {
  withPrices: boolean;
}

const DATE = () => new Date().toLocaleDateString('fr-FR');

function catalogueFileName(withPrices: boolean, ext: string) {
  return `catalogue-sheleg-${withPrices ? 'avec-prix' : 'sans-prix'}.${ext}`;
}

/** Export du catalogue au format Excel (.xlsx). */
export function exportExcel(products: Product[], { withPrices }: ExportOptions) {
  const rows = products.map((p) => {
    const row: Record<string, string | number> = {
      Catégorie: p.category,
      Code: p.default_code,
      Produit: p.name,
      'Code-barres': p.barcode,
      'Pièces/colis': packSize(p),
    };
    if (withPrices) row['Prix unité (€)'] = Number(unitPrice(p).toFixed(2));
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
  XLSX.writeFile(wb, catalogueFileName(withPrices, 'xlsx'));
}

/** Construit le PDF du catalogue et renvoie le document jsPDF. */
export function buildCataloguePDF(products: Product[], { withPrices }: ExportOptions): jsPDF {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(7, 58, 107);
  doc.text('Catalogue Sheleg', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Édité le ${DATE()} · ${products.length} produits`, 14, 25);

  const head = withPrices
    ? [['Catégorie', 'Code', 'Produit', 'Pcs/colis', 'Prix / pièce']]
    : [['Catégorie', 'Code', 'Produit', 'Pcs/colis']];

  const body = products.map((p) => {
    const base = [p.category, p.default_code, p.name, String(packSize(p))];
    return withPrices ? [...base, formatEuro(unitPrice(p))] : base;
  });

  autoTable(doc, {
    head,
    body,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [11, 92, 171], textColor: 255 },
    alternateRowStyles: { fillColor: [242, 248, 253] },
    columnStyles: { 3: { halign: 'center' }, ...(withPrices ? { 4: { halign: 'right' } } : {}) },
  });

  return doc;
}

/** Télécharge le catalogue en PDF. */
export function exportPDF(products: Product[], opts: ExportOptions) {
  buildCataloguePDF(products, opts).save(catalogueFileName(opts.withPrices, 'pdf'));
}

/** Envoie le catalogue au client en PDF depuis la tablette (partage / e-mail). */
export async function shareCataloguePDF(
  products: Product[],
  opts: ExportOptions,
  emails: string[]
) {
  const doc = buildCataloguePDF(products, opts);
  const blob = doc.output('blob') as Blob;
  const file = new File([blob], catalogueFileName(opts.withPrices, 'pdf'), {
    type: 'application/pdf',
  });
  const subject = 'Catalogue Sheleg';
  const text = 'Bonjour,\n\nVeuillez trouver ci-joint notre catalogue.\n\nCordialement,\nSheleg';

  const nav = navigator as Navigator & {
    canShare?: (data?: unknown) => boolean;
    share?: (data?: unknown) => Promise<void>;
  };
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: subject, text });
      return;
    } catch {
      /* partage annulé */
    }
  }
  doc.save(file.name);
  window.location.href = `mailto:${emails.join(',')}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(text + '\n\n(Joindre le PDF téléchargé.)')}`;
}

/** Construit le devis PDF d'une commande et renvoie le document jsPDF. */
export async function buildOrderPDF(order: OrderDetail, client?: Client | null): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const left = 14;
  const right = pageW - 14;

  // Logo en haut à gauche.
  let headerBottom = 22;
  try {
    const logo = await loadLogoDataUrl();
    const w = 46;
    const h = (logo.h / logo.w) * w;
    doc.addImage(logo.dataUrl, 'PNG', left, 10, w, h);
    headerBottom = 10 + h;
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(7, 58, 107);
    doc.text('SHELEG', left, 20);
    headerBottom = 24;
  }

  // Bloc « DEVIS » en haut à droite.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(7, 58, 107);
  doc.text('DEVIS', right, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`N° ${order.reference}`, right, 22, { align: 'right' });
  doc.text(`Date : ${formatDateShort(order.date)}`, right, 27, { align: 'right' });

  // Informations du client.
  let y = Math.max(headerBottom, 30) + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(7, 58, 107);
  doc.text('Client', left, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30);
  y += 5;
  const clientLines = [
    order.client,
    client?.street,
    [client?.zip, client?.city].filter(Boolean).join(' '),
    client?.phone ? `Tél : ${client.phone}` : '',
    client?.email || '',
  ].filter(Boolean) as string[];
  clientLines.forEach((line) => {
    doc.text(pdfSafe(line), left, y);
    y += 5;
  });

  // Date de livraison souhaitée, sans l'heure.
  if (order.deliveryDate) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90);
    doc.text(`Livraison souhaitée : ${formatDateShort(order.deliveryDate)}`, left, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  // Tableau des lignes.
  autoTable(doc, {
    startY: y + 4,
    head: [[
      'Code article',
      'Désignation',
      'Qté colisée',
      'Gencode',
      'Qté unitaire',
      'Prix unitaire',
      'Remise',
      'Total HT',
    ]],
    body: order.lines.map((l) => {
      const pack = l.packSize && l.packSize > 0 ? l.packSize : 1;
      const pu = l.unitPrice ?? (pack > 0 ? l.price / pack : l.price);
      return [
        l.default_code || '',
        pdfSafe(l.name),
        String(l.qty),
        l.barcode || '',
        String(l.qty * pack),
        euroPdf(pu),
        l.discount ? pctPdf(l.discount) : '—',
        euroPdf(l.totalHT),
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 92, 171], textColor: 255, fontSize: 8, halign: 'center' },
    alternateRowStyles: { fillColor: [242, 248, 253] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 26 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 22, halign: 'right' },
    },
    margin: { left, right: 14 },
  });

  // Totaux en bas.
  // @ts-expect-error lastAutoTable est ajouté par jspdf-autotable
  let ty = (doc.lastAutoTable?.finalY ?? y) + 8;
  const totals: [string, string][] = [
    ['Total HT', euroPdf(order.totalHT)],
    ['TVA', euroPdf(order.totalTVA)],
    ['Total TTC', euroPdf(order.totalTTC)],
  ];
  doc.setFontSize(11);
  totals.forEach(([label, val], i) => {
    const bold = i === totals.length - 1;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(bold ? 7 : 90, bold ? 58 : 90, bold ? 107 : 90);
    doc.text(label, right - 42, ty);
    doc.text(val, right, ty, { align: 'right' });
    ty += 6;
  });

  return doc;
}

/** Télécharge le devis PDF de la commande. */
export async function downloadOrderPDF(order: OrderDetail, client?: Client | null) {
  (await buildOrderPDF(order, client)).save(`devis-${order.reference}.pdf`);
}

/**
 * Envoie la commande au client en PDF depuis la tablette.
 * Utilise le partage natif (Mail avec pièce jointe) si disponible, sinon
 * télécharge le PDF et ouvre l'application e-mail pré-remplie.
 */
export async function shareOrderPDF(
  order: OrderDetail,
  emails: string[],
  client?: Client | null
) {
  const doc = await buildOrderPDF(order, client);
  const blob = doc.output('blob') as Blob;
  const file = new File([blob], `devis-${order.reference}.pdf`, { type: 'application/pdf' });
  const subject = `Devis Sheleg ${order.reference}`;
  const text = `Bonjour,\n\nVeuillez trouver ci-joint votre devis ${order.reference} (${formatEuro(order.totalTTC)} TTC).\n\nCordialement,\nSheleg`;

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
