import { supabase } from './supabase'
import { writeFieldAudits } from './auditLog'
import type { UserRole } from './authProfile'
import { canEdit, isAdmin } from './authProfile'

export type EditForm = {
  unit_number: string
  vin: string
  model: string
  customModel: string
  under_cabang: string
  customer: string
  location: string
  year_delivery: string
  status: string
  serial_number: string
  marketing_status: string
  device_number: string
}

export async function saveUnitEdits(opts: {
  unit: {
    id: string
    unit_number?: string | null
    vin?: string | null
    model?: string | null
    under_cabang?: string | null
    customer?: string | null
    location?: string | null
    year_delivery?: number | null
    status?: string | null
    serial_number?: string | null
    marketing_status?: string | null
    device_number?: string | null
  }
  editForm: EditForm
  role: UserRole | null | undefined
}): Promise<void> {
  const { unit, editForm, role } = opts
  if (!canEdit(role)) throw new Error('Role kamu tidak boleh mengedit data')

  const finalModel = editForm.model === 'CUSTOM' ? editForm.customModel.trim() : editForm.model
  const yearDelivNum = editForm.year_delivery ? parseInt(editForm.year_delivery, 10) : null
  if (yearDelivNum != null && (yearDelivNum < 2018 || yearDelivNum > 2030)) {
    throw new Error('Tahun delivery harus antara 2018–2030')
  }
  const allowedStatus = ['aktif', 'idle', 'maintenance', 'ready', 'sold', 'scrapped']
  if (editForm.status && !allowedStatus.includes(editForm.status)) {
    throw new Error('Status tidak valid')
  }

  const adminUser = isAdmin(role)
  const vinChanged = (editForm.vin.trim() || '') !== (unit.vin || '')
  const unitNumChanged = editForm.unit_number.trim() !== (unit.unit_number || '')
  if ((vinChanged || unitNumChanged) && !adminUser) {
    throw new Error('Hanya admin yang boleh mengubah VIN / No Unit')
  }
  if ((vinChanged || unitNumChanged) && adminUser) {
    const ok = window.confirm('Kamu akan mengubah VIN dan/atau No Unit. Ini field kritis. Lanjutkan?')
    if (!ok) throw new Error('Dibatalkan')
  }

  const payload: Record<string, unknown> = {
    under_cabang: editForm.under_cabang.trim() || null,
    customer: editForm.customer.trim() || null,
    location: editForm.location.trim() || null,
    year_delivery: yearDelivNum != null && !isNaN(yearDelivNum) ? yearDelivNum : null,
    status: editForm.status || 'aktif',
    serial_number: editForm.serial_number.trim() || null,
    marketing_status: editForm.marketing_status || null,
    device_number: editForm.device_number.trim() || null,
    model: finalModel || null,
    updated_at: new Date().toISOString(),
  }
  if (adminUser) {
    payload.unit_number = editForm.unit_number.trim()
    payload.vin = editForm.vin.trim() || null
  }

  const changes = [
    { field: 'under_cabang', oldValue: unit.under_cabang, newValue: payload.under_cabang },
    { field: 'customer', oldValue: unit.customer, newValue: payload.customer },
    { field: 'location', oldValue: unit.location, newValue: payload.location },
    { field: 'year_delivery', oldValue: unit.year_delivery, newValue: payload.year_delivery },
    { field: 'status', oldValue: unit.status, newValue: payload.status },
    { field: 'serial_number', oldValue: unit.serial_number, newValue: payload.serial_number },
    { field: 'marketing_status', oldValue: unit.marketing_status, newValue: payload.marketing_status },
    { field: 'device_number', oldValue: unit.device_number, newValue: payload.device_number },
    { field: 'model', oldValue: unit.model, newValue: payload.model },
  ]
  if (adminUser) {
    changes.push(
      { field: 'unit_number', oldValue: unit.unit_number, newValue: payload.unit_number },
      { field: 'vin', oldValue: unit.vin, newValue: payload.vin },
    )
  }

  const { error } = await supabase.from('units').update(payload).eq('id', unit.id)
  if (error) throw error

  await writeFieldAudits({
    tableName: 'units',
    recordId: unit.id,
    unitId: unit.id,
    changes,
    source: 'manual',
  })
}
