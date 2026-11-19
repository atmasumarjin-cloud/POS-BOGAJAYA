import { formatIDR, type PosTransactionRecord } from './accounting';

export interface BluetoothPrinterState {
  connected: boolean;
  deviceName: string | null;
  paperWidth: '58mm' | '80mm';
  lastPrintedInvoice: string | null;
}

export function buildReceiptLines(
  tx: PosTransactionRecord,
  paperWidth: '58mm' | '80mm' = '58mm'
): string[] {
  const width = paperWidth === '58mm' ? 32 : 48;
  const divider = '-'.repeat(width);
  const padLine = (left: string, right: string) => {
    const maxLeft = Math.max(4, width - right.length - 1);
    const trimmedLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    const spaces = Math.max(1, width - trimmedLeft.length - right.length);
    return `${trimmedLeft}${' '.repeat(spaces)}${right}`;
  };
  const center = (text: string) => {
    if (text.length >= width) return text.slice(0, width);
    const pad = Math.floor((width - text.length) / 2);
    return `${' '.repeat(pad)}${text}`;
  };

  const dateStr = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(tx.createdAtIso));

  const lines: string[] = [
    center('TOKO BOGAJAYA SURABAYA'),
    center('Pusat Oleh-Oleh Sejak 1976'),
    center(tx.branch),
    center('www.tokobogajaya.com'),
    divider,
    padLine('No:', tx.invoiceNo),
    padLine('Tgl:', dateStr),
    padLine('Plg:', tx.customerName),
    padLine('Bayar:', tx.paymentMethod),
    divider,
  ];

  for (const item of tx.items) {
    lines.push(item.name.slice(0, width));
    lines.push(
      padLine(`  ${item.qty} x ${formatIDR(item.unitPrice)}`, formatIDR(item.lineTotal))
    );
  }

  lines.push(divider);
  lines.push(padLine('Subtotal', formatIDR(tx.subtotal)));
  if (tx.discount > 0) {
    lines.push(padLine('Diskon', `-${formatIDR(tx.discount)}`));
  }
  if (tx.taxAmount > 0) {
    lines.push(padLine('PPN', formatIDR(tx.taxAmount)));
  }
  lines.push(padLine('TOTAL', formatIDR(tx.total)));
  lines.push(padLine('Tunai/Bayar', formatIDR(tx.cashReceived)));
  lines.push(padLine('Kembali', formatIDR(tx.changeAmount)));
  lines.push(divider);
  lines.push(center('Terima Kasih - Selamat Menikmati'));
  lines.push(center('WA CS: 0858-1689-4196'));

  return lines;
}

export function buildEscPosReceiptBytes(
  tx: PosTransactionRecord,
  paperWidth: '58mm' | '80mm' = '58mm'
): Uint8Array {
  const lines = buildReceiptLines(tx, paperWidth);
  const text = `${lines.join('\n')}\n\n\n`;
  const encoder = new TextEncoder();
  const body = encoder.encode(text);

  // ESC @ (init), body, GS V 66 0 (cut)
  const init = new Uint8Array([0x1b, 0x40]);
  const cut = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
  const output = new Uint8Array(init.length + body.length + cut.length);
  output.set(init, 0);
  output.set(body, init.length);
  output.set(cut, init.length + body.length);
  return output;
}

export async function connectBluetoothThermalPrinter(): Promise<{
  device: any;
  characteristic: any;
  name: string;
}> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error(
      'Web Bluetooth API tidak tersedia pada browser ini. Gunakan Chrome/Edge desktop atau Android untuk cetak langsung via Bluetooth.'
    );
  }

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      '000018f0-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    ],
  });

  const server = await device.gatt?.connect();
  if (!server) {
    throw new Error('Gagal terhubung ke GATT server printer Bluetooth.');
  }

  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        return {
          device,
          characteristic: ch,
          name: device.name || 'Thermal Printer BLE',
        };
      }
    }
  }

  throw new Error('Tidak ditemukan karakteristik cetak pada perangkat Bluetooth yang dipilih.');
}

export async function writeEscPosToCharacteristic(
  characteristic: any,
  bytes: Uint8Array
): Promise<void> {
  const chunkSize = 100;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}
