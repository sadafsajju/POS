import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { adminApi } from '@pos/api-client';
import { QrCode, Download, Printer, Globe } from 'lucide-react';
import QRCode from 'qrcode';

export const Route = createFileRoute('/admin/more/qr-codes')({
  component: QRCodesSettings,
});

function QRCodesSettings() {
  const queryClient = useQueryClient();
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [customerAppUrl, setCustomerAppUrl] = useState('https://your-restaurant-ordering.vercel.app');
  const [generatedQR, setGeneratedQR] = useState<{
    qrDataUrl: string;
    tableId: string;
    tableName: string;
    url: string;
  } | null>(null);

  // Fetch tables
  const { data: tablesResponse } = useQuery({
    queryKey: ['tables'],
    queryFn: () => adminApi.getTables(),
  });

  const tables = tablesResponse?.data || [];

  // Fetch existing QR codes
  const { data: qrCodes, refetch } = useQuery({
    queryKey: ['qr-codes'],
    queryFn: async () => {
      const response = await adminApi.getQRCodes();
      return response.data || [];
    },
  });

  // Generate QR code
  const generateMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await adminApi.generateQRCode({
        table_id: tableId,
        pos_hostname: customerAppUrl,
        pos_port: '', // Not needed for full URL
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to generate QR code');
      }
      return response.data;
    },
    onSuccess: async (data: any) => {
      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(data.qr_data, {
        width: 400,
        margin: 2,
      });

      setGeneratedQR({
        qrDataUrl,
        tableId: data.table_id,
        tableName: data.table_name,
        url: data.url,
      });

      refetch();
      queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
    },
  });

  const handleGenerate = () => {
    if (selectedTableId) {
      generateMutation.mutate(selectedTableId);
    }
  };

  const handleDownload = () => {
    if (generatedQR) {
      const link = document.createElement('a');
      link.download = `qr-code-table-${generatedQR.tableName}.png`;
      link.href = generatedQR.qrDataUrl;
      link.click();
    }
  };

  const handlePrint = () => {
    if (generatedQR) {
      const printWindow = window.open('', '', 'width=600,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>QR Code - Table ${generatedQR.tableName}</title>
              <style>
                body {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-family: sans-serif;
                  padding: 40px;
                }
                h1 { margin-bottom: 10px; font-size: 24px; }
                p { color: #666; margin-bottom: 20px; font-size: 18px; }
                img { border: 2px solid #000; padding: 20px; }
              </style>
            </head>
            <body>
              <h1>Table ${generatedQR.tableName}</h1>
              <p>Scan to order</p>
              <img src="${generatedQR.qrDataUrl}" alt="QR Code" />
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Fixed Header Strip ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">QR Code Generator</h2>
            <p className="text-sm text-zinc-500">Generate QR codes for customer self-service ordering</p>
          </div>
        </div>
      </header>

      {/* ── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Customer App URL Configuration */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-zinc-100">Customer App URL</h3>
          </div>
          <p className="text-sm text-zinc-500 mb-4">
            Enter the public URL where your customer ordering app is hosted (e.g., Vercel, Netlify, or your domain)
          </p>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Customer Ordering URL</label>
            <input
              value={customerAppUrl}
              onChange={(e) => setCustomerAppUrl(e.target.value)}
              placeholder="https://your-restaurant.com"
              className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">The QR code will link to: {customerAppUrl}/?qr=[token]</p>
          </div>
        </div>

        {/* Generate QR Code */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
          <h3 className="font-semibold text-zinc-100 mb-4">Generate New QR Code</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Select Table</label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
              >
                <option value="">-- Select a table --</option>
                {Array.isArray(tables) && tables.map((table: any) => (
                  <option key={table.id} value={table.id}>
                    Table {table.table_number}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!selectedTableId || generateMutation.isPending}
              className="w-full h-10 px-5 rounded-lg text-sm font-bold tracking-wide transition-colors bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>

          {/* Display Generated QR */}
          {generatedQR && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <div className="text-center space-y-4">
                <h4 className="font-semibold text-lg text-zinc-100">Table {generatedQR.tableName}</h4>

                <div className="bg-white p-4 inline-block rounded-lg">
                  <img
                    src={generatedQR.qrDataUrl}
                    alt="QR Code"
                    className="mx-auto"
                    style={{ width: '300px', height: '300px' }}
                  />
                </div>

                <p className="text-sm text-zinc-500 break-all px-4">
                  {generatedQR.url}
                </p>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Existing QR Codes */}
        {qrCodes && qrCodes.length > 0 && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
            <h3 className="font-semibold text-zinc-100 mb-4">Existing QR Codes</h3>

            <div className="space-y-3">
              {qrCodes.map((qr: any) => (
                <div
                  key={qr.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <QrCode className="w-4 h-4 text-zinc-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Table {qr.table_name}</p>
                      <p className="text-xs text-zinc-500">
                        Scanned {qr.scan_count} times
                        {qr.last_scanned_at && ` · Last: ${new Date(qr.last_scanned_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div>
                    {qr.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-zinc-700 text-zinc-500 border border-zinc-600">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
          <h3 className="font-semibold text-zinc-100 mb-3">How It Works</h3>
          <ol className="space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">1.</span>
              Deploy your customer-web app to Vercel/Netlify or your domain
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">2.</span>
              Enter the deployed URL in the configuration above
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">3.</span>
              Select a table and generate a QR code
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">4.</span>
              Download or print the QR code and place it on the table
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">5.</span>
              Customers scan → access online ordering → orders appear in your POS
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
