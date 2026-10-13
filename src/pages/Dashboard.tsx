import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Truck, FileWarning, FileCheck, AlertCircle, MapPin, Wrench } from 'lucide-react'

export default function Dashboard() {
  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*')
      if (error) throw error
      return data || []
    },
  })

  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['unit_documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_documents')
        .select('*, document_types(name, code, is_required)')
      if (error) throw error
      return data || []
    },
  })

  const totalUnits = units.length
  const byModel = units.reduce((acc: Record<string, number>, u: any) => {
    const m = u.model || 'Unknown'
    acc[m] = (acc[m] || 0) + 1
    return acc
  }, {})
  const byCabang = units.reduce((acc: Record<string, number>, u: any) => {
    const c = u.under_cabang || 'Unknown'
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})
  const missingDocs = docs.filter((d: any) => d.status === 'missing' || d.status === 'pending').length
  const uploadedDocs = docs.filter((d: any) => d.status === 'uploaded').length
  const requiredMissing = docs.filter(
    (d: any) => d.document_types?.is_required && (d.status === 'missing' || d.status === 'pending')
  ).length

  const stats = [
    { label: 'Total Unit', value: totalUnits, icon: Truck, color: 'text-blue-400' },
    { label: 'Dokumen Missing', value: missingDocs, icon: FileWarning, color: 'text-amber-400' },
    { label: 'Dokumen Uploaded', value: uploadedDocs, icon: FileCheck, color: 'text-accent' },
    { label: 'Required Belum Ada', value: requiredMissing, icon: AlertCircle, color: 'text-red-400' },
  ]

  if (loadingUnits || loadingDocs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-surface-50">Dashboard</h2>
        <p className="text-sm text-surface-400 mt-1">Overview populasi unit SDLG & status dokumen</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-start gap-4">
            <div className={`p-2.5 rounded-lg bg-surface-800 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-surface-50">{stat.value}</p>
              <p className="text-xs text-surface-400 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-surface-400" />
            <h3 className="text-sm font-medium text-surface-200">Top Model</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(byModel)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 8)
              .map(([model, count]) => (
                <div key={model} className="flex items-center justify-between text-sm">
                  <span className="text-surface-300">{model}</span>
                  <span className="font-medium text-surface-100">{count as number}</span>
                </div>
              ))}
            {Object.keys(byModel).length === 0 && (
              <p className="text-sm text-surface-500">Belum ada data</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-surface-400" />
            <h3 className="text-sm font-medium text-surface-200">Per Cabang</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(byCabang)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 8)
              .map(([cabang, count]) => (
                <div key={cabang} className="flex items-center justify-between text-sm">
                  <span className="text-surface-300">{cabang}</span>
                  <span className="font-medium text-surface-100">{count as number}</span>
                </div>
              ))}
            {Object.keys(byCabang).length === 0 && (
              <p className="text-sm text-surface-500">Belum ada data</p>
            )}
          </div>
        </div>
      </div>

      {totalUnits === 0 && (
        <div className="card text-center py-12">
          <Truck className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">Data unit sedang di-import</p>
          <p className="text-sm text-surface-500 mt-1">
            Master data sedang diproses. Refresh halaman setelah beberapa saat.
          </p>
        </div>
      )}

      {requiredMissing > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Perhatian</span>
          </div>
          <p className="text-sm text-surface-300">
            Ada <strong>{requiredMissing}</strong> dokumen wajib yang belum di-upload.
            Cek halaman Dokumen untuk detail.
          </p>
        </div>
      )}
    </div>
  )
}
