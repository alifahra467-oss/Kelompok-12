import React from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw, WifiOff } from 'lucide-react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Terjadi kesalahan pada aplikasi.' };
  }

  render() {
    if (this.state.hasError) {
      let parsedMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) parsedMsg = parsed.error;
      } catch {
        // Keep raw message
      }
      return (
        <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 text-rose-700 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold">Terjadi Gangguan Sistem</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed break-words">{parsedMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0E2142] text-white text-sm font-semibold hover:bg-[#16315E] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const LoadingState: React.FC<{ label?: string; dark?: boolean }> = ({
  label = 'Memuat data sesi...',
  dark = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center py-16 px-6 text-center ${
      dark ? 'text-slate-200' : 'text-slate-600'
    }`}
  >
    <Loader2 className={`w-8 h-8 animate-spin mb-3 ${dark ? 'text-[#F1C56C]' : 'text-[#2563EB]'}`} />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center py-14 px-6 text-center bg-white rounded-2xl border border-slate-200">
    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
      <Inbox className="w-6 h-6" />
    </div>
    <h3 className="text-base font-bold text-[#0E2142] mb-1">{title}</h3>
    <p className="text-sm text-slate-500 max-w-md mb-5">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const DisconnectedBanner: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-amber-900">
    <div className="flex items-center gap-2.5 text-sm font-medium">
      <WifiOff className="w-4 h-4 shrink-0 text-amber-700" />
      <span>Koneksi internet terputus sementara. Mencoba menyambungkan kembali ke server...</span>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-semibold whitespace-nowrap shrink-0"
      >
        Hubungkan Ulang
      </button>
    )}
  </div>
);

export const FirebaseSetupNotice: React.FC = () => (
  <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center p-6">
    <div className="max-w-xl w-full bg-[#13294E] border border-white/15 rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-[#F1C56C] mb-2">Konfigurasi Firebase Diperlukan</h1>
      <p className="text-sm text-slate-200 leading-relaxed mb-4">
        Berkas <code className="font-mono text-[#F1C56C]">firebase-applet-config.json</code> belum terisi dengan proyek Firebase yang aktif. Platform multiplayer real-time ARENA KELAS 2.0 membutuhkan Firestore dan Firebase Authentication agar sesi kuis, buzzer, dan sinkronisasi proyektor dapat berjalan.
      </p>
      <ol className="text-sm text-slate-300 space-y-2 list-decimal pl-5 mb-6">
        <li>Aktifkan Firebase Firestore dan Google Sign-In melalui panel integrasi Firebase.</li>
        <li>Terapkan aturan keamanan dari berkas <code className="font-mono">firestore.rules</code>.</li>
        <li>Muat ulang halaman ini setelah konfigurasi selesai.</li>
      </ol>
    </div>
  </div>
);
