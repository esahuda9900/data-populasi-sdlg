import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [showRestored, setShowRestored] = useState<boolean>(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowRestored(true)
      setTimeout(() => setShowRestored(false), 4000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowRestored(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showRestored) return null

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/90 text-white text-xs font-semibold shadow-2xl backdrop-blur animate-bounce border border-red-400">
        <WifiOff className="w-4 h-4" />
        <span>Koneksi internet terputus. Menampilkan data tersimpan.</span>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/90 text-white text-xs font-semibold shadow-2xl backdrop-blur border border-emerald-400">
      <Wifi className="w-4 h-4" />
      <span>Koneksi internet terhubung kembali.</span>
    </div>
  )
}
