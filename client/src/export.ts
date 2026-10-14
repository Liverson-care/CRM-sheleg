import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product, OrderDetail, Client } from './types';
import { formatEuro, formatDateShort, unitPrice, packSize, byCode } from './util';

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

/** Réduit une image (data URL) pour alléger le PDF. Renvoie null si illisible. */
async function scaleImage(
  dataUrl: string,
  maxPx: number
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (!dataUrl) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      try {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: c.toDataURL('image/jpeg', 0.8), w, h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
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
      Code: p.default_code,
      Produit: p.name,
      'Code-barres': p.barcode,
      Famille: p.category,
      'Pièces/colis': packSize(p),
    };
    if (withPrices) {
      row['Prix unité (€)'] = Number(unitPrice(p).toFixed(2));
      if (p.vat != null) row['TVA (%)'] = p.vat;
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
  XLSX.writeFile(wb, catalogueFileName(withPrices, 'xlsx'));
}

/** Construit le PDF du catalogue (logo, familles en séparateur, photos, gencode). */
export async function buildCataloguePDF(
  products: Product[],
  { withPrices }: ExportOptions
): Promise<jsPDF> {
  const doc = new jsPDF();
  const left = 14;
  const right = doc.internal.pageSize.getWidth() - 14;

  // En-tête : logo Sheleg à gauche, titre + date à droite.
  let headerBottom = 20;
  try {
    const logo = await loadLogoDataUrl();
    const w = 42;
    const h = (logo.h / logo.w) * w;
    doc.addImage(logo.dataUrl, 'PNG', left, 10, w, h);
    headerBottom = 10 + h;
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(7, 58, 107);
    doc.text('SHELEG', left, 20);
    headerBottom = 22;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(7, 58, 107);
  doc.text('Catalogue', right, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Édité le ${DATE()} · ${products.length} produits`, right, 22, { align: 'right' });

  // Tri par famille (catégorie) puis par code article.
  const sorted = products.slice().sort((a, b) => {
    const c = (a.category || 'Divers').localeCompare(b.category || 'Divers', 'fr');
    return c !== 0 ? c : byCode(a, b);
  });

  // Pré-charge les vignettes réduites par produit.
  const imgMap = new Map<number, { dataUrl: string; w: number; h: number }>();
  await Promise.all(
    sorted.map(async (p) => {
      if (p.image) {
        const im = await scaleImage(p.image, 120);
        if (im) imgMap.set(p.id, im);
      }
    })
  );

  // Corps : une ligne « famille » en séparateur, puis ses produits.
  const colCount = withPrices ? 7 : 5;
  const body: unknown[] = [];
  const rowProducts: (Product | null)[] = [];
  let currentCat: string | null = null;
  for (const p of sorted) {
    const cat = p.category || 'Divers';
    if (cat !== currentCat) {
      currentCat = cat;
      body.push([
        {
          content: pdfSafe(cat),
          colSpan: colCount,
          styles: { fillColor: [7, 58, 107], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        },
      ]);
      rowProducts.push(null);
    }
    const row: string[] = ['', p.default_code || '', pdfSafe(p.name), p.barcode || '', String(packSize(p))];
    if (withPrices) {
      row.push(euroPdf(unitPrice(p)));
      row.push(p.vat != null ? `${String(p.vat).replace('.', ',')} %` : '—');
    }
    body.push(row);
    rowProducts.push(p);
  }

  const head = withPrices
    ? [['Photo', 'Code', 'Produit', 'Code-barres', 'Pcs/colis', 'Prix / pièce', 'TVA']]
    : [['Photo', 'Code', 'Produit', 'Code-barres', 'Pcs/colis']];

  autoTable(doc, {
    head,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: body as any,
    startY: Math.max(headerBottom, 26) + 4,
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', minCellHeight: 16 },
    headStyles: { fillColor: [11, 92, 171], textColor: 255, halign: 'center', fontSize: 8 },
    alternateRowStyles: { fillColor: [242, 248, 253] },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'center' },
      ...(withPrices
        ? {
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 15, halign: 'center' },
          }
        : {}),
    },
    margin: { left, right: 14 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawCell: (data: any) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const p = rowProducts[data.row.index];
      if (!p) return;
      const im = imgMap.get(p.id);
      if (!im) return;
      const maxW = data.cell.width - 3;
      const maxH = data.cell.height - 3;
      const scale = Math.min(maxW / im.w, maxH / im.h);
      const w = im.w * scale;
      const h = im.h * scale;
      const x = data.cell.x + (data.cell.width - w) / 2;
      const y = data.cell.y + (data.cell.height - h) / 2;
      try {
        doc.addImage(im.dataUrl, 'JPEG', x, y, w, h);
      } catch {
        /* image illisible : on laisse la cellule vide */
      }
    },
  });

  return doc;
}

/** Télécharge le catalogue en PDF. */
export async function exportPDF(products: Product[], opts: ExportOptions) {
  (await buildCataloguePDF(products, opts)).save(catalogueFileName(opts.withPrices, 'pdf'));
}

/** Envoie le catalogue au client en PDF depuis la tablette (partage / e-mail). */
export async function shareCataloguePDF(
  products: Product[],
  opts: ExportOptions,
  emails: string[]
) {
  const doc = await buildCataloguePDF(products, opts);
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
  // Un brouillon n'a pas encore de référence Odoo : on n'affiche que la date.
  let metaY = 22;
  if (order.reference) {
    doc.text(`N° ${order.reference}`, right, metaY, { align: 'right' });
    metaY += 5;
  }
  doc.text(`Date : ${formatDateShort(order.date)}`, right, metaY, { align: 'right' });

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

/** Nom de fichier du devis (référence Odoo, ou nom du client / brouillon). */
function devisFileName(order: OrderDetail): string {
  const ref =
    order.reference ||
    (order.client ? order.client.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') : '') ||
    'brouillon';
  return `devis-${ref}.pdf`;
}

/** Télécharge le devis PDF de la commande. */
export async function downloadOrderPDF(order: OrderDetail, client?: Client | null) {
  (await buildOrderPDF(order, client)).save(devisFileName(order));
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
  const file = new File([blob], devisFileName(order), { type: 'application/pdf' });
  const ref = order.reference ? ` ${order.reference}` : '';
  const subject = `Devis Sheleg${ref}`;
  const text = `Bonjour,\n\nVeuillez trouver ci-joint votre devis${ref} (${formatEuro(order.totalTTC)} TTC).\n\nCordialement,\nSheleg`;

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

/** Grammes avec virgule française, ou tiret si absent. */
function gramsPdf(n?: number | null): string {
  return n == null ? '—' : `${String(n).replace('.', ',')} g`;
}

/** Dimensions du colis « l × H × P » en cm pour le PDF, ou '' si aucune. */
function dimsPdf(log?: Product['logistics']): string {
  if (!log) return '';
  const { largeurCm, hauteurCm, profondeurCm } = log;
  if (largeurCm == null && hauteurCm == null && profondeurCm == null) return '';
  const v = (x?: number | null) => (x == null ? '—' : String(x).replace('.', ','));
  return `${v(largeurCm)} × ${v(hauteurCm)} × ${v(profondeurCm)} cm`;
}

/** Construit la fiche produit en PDF, mise en page par sections. */
export async function buildProductPDF(product: Product): Promise<jsPDF> {
  const doc = new jsPDF();
  const left = 14;
  const right = doc.internal.pageSize.getWidth() - 14;
  const fullW = right - left;
  const pageH = doc.internal.pageSize.getHeight();
  let y = 10;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = () => (doc as any).lastAutoTable?.finalY ?? y;
  const ensureSpace = (h: number) => {
    if (y + h > pageH - 14) {
      doc.addPage();
      y = 16;
    }
  };
  // Bandeau de section (séparateur bleu).
  const band = (title: string) => {
    ensureSpace(18);
    doc.setFillColor(7, 58, 107);
    doc.roundedRect(left, y, fullW, 7.6, 1.4, 1.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfSafe(title), left + 3, y + 5.2);
    y += 7.6 + 3.5;
    doc.setTextColor(30);
  };
  const infoTable = (rows: [string, string][]) => {
    if (!rows.length) return;
    autoTable(doc, {
      startY: y,
      body: rows.map(([k, v]) => [k, pdfSafe(v)]),
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: [245, 249, 252] },
      columnStyles: {
        0: { cellWidth: 72, textColor: [110, 110, 110] },
        1: { textColor: [25, 32, 46], halign: 'left' },
      },
      margin: { left, right: 14 },
    });
    y = finalY() + 5;
  };
  const paraText = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(pdfSafe(text), fullW);
    ensureSpace(lines.length * 5 + 4);
    doc.text(lines, left, y);
    y += lines.length * 5 + 5;
  };

  // En-tête : logo à gauche, titre + date à droite, puis filet.
  let headerBottom = 22;
  try {
    const logo = await loadLogoDataUrl();
    const w = 42;
    const h = (logo.h / logo.w) * w;
    doc.addImage(logo.dataUrl, 'PNG', left, 10, w, h);
    headerBottom = 10 + h;
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(7, 58, 107);
    doc.text('SHELEG', left, 20);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(7, 58, 107);
  doc.text('Fiche produit', right, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Éditée le ${DATE()}`, right, 22, { align: 'right' });
  y = Math.max(headerBottom, 26) + 2;
  doc.setDrawColor(210, 224, 238);
  doc.setLineWidth(0.4);
  doc.line(left, y, right, y);
  y += 7;

  // Nom + catégorie.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20);
  const nameLines = doc.splitTextToSize(pdfSafe(product.name), fullW);
  doc.text(nameLines, left, y);
  y += nameLines.length * 7 + 1;
  if (product.category) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(pdfSafe(product.category), left, y);
    y += 6;
  }

  // Photo à gauche + infos d'identité à droite.
  const lab = product.labeling;
  const log = product.logistics;
  const blockTop = y + 2;
  let photoBottom = blockTop;
  let infoX = left;
  const im = product.image ? await scaleImage(product.image, 360) : null;
  if (im) {
    const w = 45;
    const h = (im.h / im.w) * w;
    try {
      doc.addImage(im.dataUrl, 'JPEG', left, blockTop, w, h);
      photoBottom = blockTop + h;
      infoX = left + w + 8;
    } catch {
      /* image illisible */
    }
  }
  const kv: [string, string][] = [
    ['Référence', product.default_code || '—'],
    ['Code-barres', product.barcode || '—'],
  ];
  if (lab?.marque) kv.push(['Marque', lab.marque]);
  kv.push(['Conditionnement', `${packSize(product)} pièces / colis`]);
  kv.push(['Prix / pièce', euroPdf(unitPrice(product))]);
  kv.push(['Prix du colis', euroPdf(product.list_price)]);
  if (product.vat != null) kv.push(['TVA', `${String(product.vat).replace('.', ',')} %`]);
  if (lab?.kosher) kv.push(['Cacher', lab.kosher + (lab.kosherPassover ? ' · Pessah' : '')]);

  let iy = blockTop + 4;
  doc.setFontSize(10);
  for (const [k, v] of kv) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(k, infoX, iy);
    doc.setTextColor(30);
    doc.text(pdfSafe(v), infoX + 38, iy);
    iy += 6;
  }
  y = Math.max(photoBottom, iy) + 8;

  // Description.
  if (product.description) {
    band('Description');
    paraText(product.description);
  }

  // Informations logistiques.
  const logiRows: [string, string][] = [];
  if (lab?.poidsNetGr != null) logiRows.push(['Poids net', `${lab.poidsNetGr} g`]);
  if (lab?.poidsBrutGr != null) logiRows.push(['Poids brut', `${lab.poidsBrutGr} g`]);
  const dims = dimsPdf(log);
  if (dims) logiRows.push(['Dimensions du colis (l × H × P)', dims]);
  if (log?.colisParPalette != null) logiRows.push(['Colis par palette', String(log.colisParPalette)]);
  if (log?.hsCode) logiRows.push(['Code SH', log.hsCode]);
  if (logiRows.length) {
    band('Informations logistiques');
    infoTable(logiRows);
  }

  // Valeurs nutritionnelles (pour 100 g).
  const n = product.nutrition;
  if (product.hasNutrition && n) {
    band('Valeurs nutritionnelles (pour 100 g)');
    const energie = [
      n.energieKj != null ? `${String(n.energieKj).replace('.', ',')} kJ` : '',
      n.energieKcal != null ? `${String(n.energieKcal).replace('.', ',')} kcal` : '',
    ]
      .filter(Boolean)
      .join(' / ') || '—';
    autoTable(doc, {
      startY: y,
      body: [
        ['Énergie', energie],
        ['Matières grasses', gramsPdf(n.matieresGrasses)],
        ['   dont acides gras saturés', gramsPdf(n.acidesGrasSsatures)],
        ['Glucides', gramsPdf(n.glucides)],
        ['   dont sucres', gramsPdf(n.sucres)],
        ['Protéines', gramsPdf(n.proteines)],
        ['Sel', gramsPdf(n.sel)],
      ],
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: [245, 249, 252] },
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right', textColor: [25, 32, 46] } },
      margin: { left, right: 14 },
    });
    y = finalY() + 5;
  }

  // Ingrédients / Allergènes.
  if (lab?.ingredients) {
    band('Ingrédients');
    paraText(lab.ingredients);
  }
  if (lab?.allergenes) {
    band('Allergènes');
    paraText(lab.allergenes);
  }

  return doc;
}

/** Télécharge la fiche produit en PDF. */
export async function downloadProductPDF(product: Product) {
  const doc = await buildProductPDF(product);
  const code = product.default_code || String(product.id);
  doc.save(`fiche-${code}.pdf`);
}
