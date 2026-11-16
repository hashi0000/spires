// GENERATED from functions/src. Edit the source, then run tools/sync-document-renderer.cjs.
import PDFDocument from "./pdfkitDocument";
import { DOCUMENT_BRAND as brand, registerDocumentFonts } from './pdfGenerator';
export async function generateInvoicePDF(input) {
    const doc = new PDFDocument({ size: 'A4', margin: 0, compress: false, bufferPages: true });
    registerDocumentFonts(doc);
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const x = brand.margin, width = doc.page.width - x * 2;
    let y = 0, inTable = false;
    const money = (pence) => '£' + (Number(pence || 0) / 100).toFixed(2);
    const headings = ['Description', 'Qty', 'Unit', 'Net', 'VAT', 'Total'];
    const widths = [235, 40, 65, 70, 65, width - 475];
    const tableHeader = () => { let cx = x; doc.rect(x, y, width, 24).fill(brand.navy); headings.forEach((label, index) => { doc.fillColor('#fff').font('InterBold').fontSize(8).text(label, cx + 5, y + 7, { width: widths[index] - 10, align: index ? 'right' : 'left' }); cx += widths[index]; }); y += 24; };
    const top = () => { brand.drawHeader(doc, input.number); brand.drawBanner(doc, input.title); y = brand.headerHeight + brand.bannerHeight + 15; if (inTable)
        tableHeader(); };
    doc.on('pageAdded', top);
    top();
    const room = (height) => { if (y + height > brand.contentBottom(doc)) {
        doc.addPage({ size: 'A4', margin: 0 });
    } };
    const pieces = (text, columnWidth, maxHeight) => {
        const result = [];
        let rest = String(text || '');
        while (rest) {
            doc.font('InterRegular').fontSize(8.5);
            if (doc.heightOfString(rest, { width: columnWidth }) <= maxHeight) {
                result.push(rest);
                break;
            }
            let low = 1, high = rest.length;
            while (low < high) {
                const mid = Math.ceil((low + high) / 2);
                if (doc.heightOfString(rest.slice(0, mid), { width: columnWidth }) <= maxHeight)
                    low = mid;
                else
                    high = mid - 1;
            }
            let cut = Math.max(1, low);
            const space = rest.lastIndexOf(' ', cut);
            if (space > cut / 2)
                cut = space;
            result.push(rest.slice(0, cut));
            rest = rest.slice(cut).trimStart();
        }
        return result.length ? result : [''];
    };
    const paragraph = (text) => { for (const part of pieces(text, width, 430)) {
        doc.font('InterRegular').fontSize(8.5);
        const h = doc.heightOfString(part, { width, lineGap: 3 });
        room(h + 12);
        doc.fillColor(brand.navy).font('InterRegular').fontSize(8.5).text(part, x, y, { width, lineGap: 3 });
        y = doc.y + 12;
    } };
    const heading = (text) => { room(35); doc.font('CinzelBold').fontSize(11).fillColor(brand.navy).text(text, x, y, { width }); y = doc.y + 8; };
    heading(input.supplierName || 'Spires Taxis Ltd');
    if (input.supplierAddress)
        paragraph(input.supplierAddress);
    if (input.companyNumber || input.vatNumber)
        paragraph([input.companyNumber ? 'Company number: ' + input.companyNumber : '', input.vatNumber ? 'VAT number: ' + input.vatNumber : ''].filter(Boolean).join('  ·  '));
    const metadata = [['Invoice date', input.invoiceDate], ['Due date', input.dueDate || ''], ...(input.references || [])].filter(([, value]) => value);
    paragraph(metadata.map(([label, value]) => label + ': ' + value).join('  ·  '));
    heading('Bill to');
    paragraph([input.customerName, input.customerAddress, input.customerEmail].filter(Boolean).join('\n'));
    room(55);
    inTable = true;
    tableHeader();
    let rowNumber = 0;
    for (const line of input.lines) {
        const parts = pieces(line.description, widths[0] - 10, 280);
        for (const [partIndex, part] of parts.entries()) {
            doc.font('InterRegular').fontSize(8.5);
            const description = part + (partIndex ? ' (continued)' : '');
            const height = Math.max(42, doc.heightOfString(description, { width: widths[0] - 10 }) + 14);
            room(height);
            if (rowNumber % 2 === 0)
                doc.rect(x, y, width, height).fill('#f7f4ec');
            const values = [description, partIndex ? '' : line.quantity, partIndex ? '' : money(line.unitPence), partIndex ? '' : money(line.netPence), partIndex ? '' : money(line.vatPence) + ' (' + Number(line.vatRatePercent || 0) + '%)', partIndex ? '' : money(line.totalPence)];
            let cx = x;
            values.forEach((value, index) => { doc.font(index === 5 ? 'InterBold' : 'InterRegular').fontSize(8.5).fillColor(brand.navy).text(value, cx + 5, y + 7, { width: widths[index] - 10, align: index ? 'right' : 'left' }); cx += widths[index]; });
            y += height;
            doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.5).strokeColor('#d5dde6').stroke();
            rowNumber += 1;
        }
    }
    inTable = false;
    y += 12;
    room(105);
    const totalX = x + width - 220;
    doc.moveTo(totalX, y).lineTo(x + width, y).lineWidth(2).strokeColor(brand.gold).stroke();
    y += 10;
    for (const [label, value] of [['Net', input.totals.netPence], ['VAT', input.totals.vatPence], ['Total', input.totals.totalPence]]) {
        doc.font(label === 'Total' ? 'InterBold' : 'InterRegular').fontSize(label === 'Total' ? 12 : 9).fillColor(brand.navy).text(label, totalX, y, { width: 100 }).text(money(value), totalX + 100, y, { width: 120, align: 'right' });
        y += 23;
    }
    if (input.paid) {
        room(30);
        doc.font('InterBold').fontSize(13).fillColor('#14532d').text('PAID', totalX, y, { width: 220, align: 'right' });
        y += 28;
    }
    if (input.paymentTerms) {
        heading('Payment terms');
        paragraph(input.paymentTerms);
    }
    if (input.paymentInstruction)
        paragraph(input.paymentInstruction);
    if (input.bank?.accountNumber) {
        heading('Bank transfer');
        paragraph([input.bank.name, 'Sort code: ' + input.bank.sortCode, 'Account number: ' + input.bank.accountNumber, 'Reference: ' + input.number].filter(Boolean).join('\n'));
    }
    if (input.notes) {
        heading('Notes');
        paragraph(input.notes);
    }
    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page++) {
        doc.switchToPage(page);
        brand.drawFooter(doc);
    }
    doc.end();
    await new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
    const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}
