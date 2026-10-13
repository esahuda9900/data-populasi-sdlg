import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Truck, FileWarning, FileCheck, AlertCircle, MapPin, Wrench } from 'lucide-react'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      // Exact counts (not limited to 1000)
      const [unitsCount, missingCount, uploadedCount, processStats] = await Promise.all([
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('unit_documents').select('*', { count: 'exact', head: true }).in('status', ['missing', 'pending']),
        supabase.from('unit_documents').select('*', { count: 'exact', head: true }).eq('status', 'uploaded'),
        supabase.from('unit_process').select('arrival_check, pdi_check, comm_check'),
      ])

      // Aggregate model & cabang with higher limit
      const { data: unitRows } = await supabase
        .from('units')
        .select('model, under_cabang')
        .limit(10000)

      const byModel: Record<string, number> = {}
      const byCabang: Record<string, number> = {}
      for (const u of unitRows || []) {
        const m = u.model || 'Unknown'
        const c = u.under_cabang || 'Unknown'
        byModel[m] = (byModel[m] || 0) + 1
        byCabang[c] = (byCabang[c] || 0) + 1
      }

      // Process missing counts
      let pdiKosong = 0
      let commKosong = 0
      let arrivalKosong = 0
      // Fetch process in pages if needed
      const { count: processTotal } = await supabase
        .from('unit_process')
        .select('*', { count: 'exact', head: true })

      const { data: procRows } = await supabase
        .from('unit_process')
        .select('pdi_check, comm_check, arrival_check')
        .limit(10000)

      for (const p of procRows || []) {
        if (!p.pdi_check || p.pdi_check === 'KOSONG') pdiKosong++
        if (!p.comm_check || p.comm_check === 'KOSONG') commKosong++
        if (!p.arrival_check || p.arrival_check === 'KOSONG') arrivalKosong++
      }

      return {
        totalUnits: unitsCount.count ?? 0,
        missingDocs: missingCount.count ?? 0,
        uploadedDocs: uploadedCount.count ?? 0,
        byModel,
        byCabang,
        pdiKosong,
        commKosong,
        arrivalKosong,
        processTotal: processTotal ?? 0,
      }
    },
  })

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cards = [
    { label: 'Total Unit', value: stats.totalUnits, icon: Truck, color: 'text-blue-400' },
    { label: 'Dokumen Missing', value: stats.missingDocs, icon: FileWarning, color: 'text-amber-400' },
    { label: 'Dokumen Uploaded', value: stats.uploadedDocs, icon: FileCheck, color: 'text-accent' },
    { label: 'PDI Belum', value: stats.pdiKosong, icon: AlertCircle, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-surface-50">Dashboard</h2>
        <p className="text-sm text-surface-400 mt-1">Overview populasi unit SDLG & status dokumen</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat) => (
          <div key={stat.label} className="card flex items-start gap-4">
            <div className={`p-2.5 rounded-lg bg-surface-800 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-surface-50">{stat.value.toLocaleString('id-ID')}</p>
              <p className="text-xs text-surface-400 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-surface-400">Arrival KOSONG</p>
          <p className="text-xl font-semibold text-surface-50 mt-1">{stats.arrivalKosong.toLocaleString('id-ID')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400">PDI KOSONG</p>
          <p className="text-xl font-semibold text-red-400 mt-1">{stats.pdiKosong.toLocaleString('id-ID')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400">COMM KOSONG</p>
          <p className="text-xl font-semibold text-surface-50 mt-1">{stats.commKosong.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-surface-400" />
            <h3 className="text-sm font-medium text-surface-200">Top Model</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.byModel)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([model, count]) => (
                <div key={model} className="flex items-center justify-between text-sm">
                  <span className="text-surface-300">{model}</span>
                  <span className="font-medium text-surface-100">{count.toLocaleString('id-ID')}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-surface-400" />
            <h3 className="text-sm font-medium text-surface-200">Per Cabang</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.byCabang)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([cabang, count]) => (
                <div key={cabang} className="flex items-center justify-between text-sm">
                  <span className="text-surface-300">{cabang}</span>
                  <span className="font-medium text-surface-100">{count.toLocaleString('id-ID')}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {stats.missingDocs > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Perhatian</span>
          </div>
          <p className="text-sm text-surface-300">
            Ada <strong>{stats.missingDocs.toLocaleString('id-ID')}</strong> dokumen wajib yang belum di-upload.
            Cek halaman Dokumen untuk detail.
          </p>
        </div>
      )}
    </div>
  )
}
