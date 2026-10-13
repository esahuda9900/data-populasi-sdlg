import { Radio } from 'lucide-react'

interface LiveStatusBadgeProps {
  isLive: boolean
  lastSync: Date
}

export function LiveStatusBadge({ isLive, lastSync }: LiveStatusBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        isLive
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-surface-800 border-surface-700 text-surface-400'
      }`}
      title={`Sinkronisasi Realtime: ${isLive ? 'Aktif' : 'Menghubungkan...'}`}
    >
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isLive ? 'bg-emerald-400' : 'bg-surface-500'
          }`}
        />
      </span>
      <span className="flex items-center gap-1 font-mono text-[11px]">
        {isLive ? 'Live Sync' : 'Polling'}
      </span>
      <span className="text-surface-500 hidden sm:inline text-[10px]">
        ({lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
      </span>
    </div>
  )
}
