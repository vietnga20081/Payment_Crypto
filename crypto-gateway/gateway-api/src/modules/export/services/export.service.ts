import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma/client';

interface TxExportRow {
  orderId: string;
  merchantName: string;
  amount: string;
  fee: string;
  netAmount: string;
  status: string;
  txHash: string;
  createdAt: string;
}

export class ExportService {
  private async fetchTransactions(params: {
    merchantId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TxExportRow[]> {
    const where: Prisma.TransactionWhereInput = {
      ...(params.merchantId && { merchantId: params.merchantId }),
      ...(params.status && { status: params.status as Prisma.EnumTransactionStatusFilter | undefined }),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };

    const rows = await prisma.transaction.findMany({
      where,
      include: { merchant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    return rows.map((t) => ({
      orderId: t.orderId,
      merchantName: t.merchant.name,
      amount: t.amount.toString(),
      fee: t.fee.toString(),
      netAmount: t.netAmount.toString(),
      status: t.status,
      txHash: t.txHash || '-',
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async exportTransactionsExcel(res: Response, params: { merchantId?: string; status?: string; startDate?: string; endDate?: string }) {
    const rows = await this.fetchTransactions(params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Crypto Payment Gateway';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 24 },
      { header: 'Merchant', key: 'merchantName', width: 20 },
      { header: 'Amount (USDT)', key: 'amount', width: 16 },
      { header: 'Fee (USDT)', key: 'fee', width: 14 },
      { header: 'Net Amount (USDT)', key: 'netAmount', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Tx Hash', key: 'txHash', width: 40 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FF' } };

    rows.forEach((r) => sheet.addRow(r));

    // Summary row
    const totalAmount = rows.reduce((s, r) => s + Number(r.amount), 0);
    const totalFee = rows.reduce((s, r) => s + Number(r.fee), 0);
    sheet.addRow({});
    const summaryRow = sheet.addRow({ orderId: 'TOTAL', amount: totalAmount.toFixed(6), fee: totalFee.toFixed(6) });
    summaryRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }

  async exportTransactionsPdf(res: Response, params: { merchantId?: string; status?: string; startDate?: string; endDate?: string }) {
    const rows = await this.fetchTransactions(params);

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).text('Báo cáo Giao dịch', { align: 'center' });
    doc.fontSize(9).fillColor('gray').text(`Xuất lúc: ${new Date().toLocaleString('vi-VN')}`, { align: 'center' });
    doc.moveDown(1);

    const colWidths = [110, 90, 70, 60, 70, 70, 130, 110];
    const headers = ['Order ID', 'Merchant', 'Amount', 'Fee', 'Net', 'Status', 'Tx Hash', 'Created'];
    let y = doc.y;
    const startX = 30;

    doc.fontSize(8).fillColor('black').font('Helvetica-Bold');
    headers.forEach((h, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(h, x, y, { width: colWidths[i] });
    });
    doc.font('Helvetica');
    y += 16;
    doc.moveTo(startX, y - 2).lineTo(800, y - 2).stroke();

    rows.forEach((r) => {
      if (y > 540) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        y = 30;
      }
      const values = [r.orderId, r.merchantName, r.amount, r.fee, r.netAmount, r.status, r.txHash.slice(0, 20), new Date(r.createdAt).toLocaleString('vi-VN')];
      values.forEach((v, i) => {
        const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fontSize(7).text(String(v), x, y, { width: colWidths[i] });
      });
      y += 14;
    });

    doc.end();
  }
}
