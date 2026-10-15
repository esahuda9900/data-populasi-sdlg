import { supabase } from './supabase'

export type AuditSource = 'manual' | 'ai' | 'import'

/** Write one audit row per changed field. Fails soft (logs console) so save still succeeds. */
export async function writeFieldAudits(opts: {
  tableName: string
  recordId?: string | null
  unitId?: string | null
  changes: { field: string; oldValue: unknown; newValue: unknown }[]
  source?: AuditSource
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const rows = opts.changes
    .filter((c) => String(c.oldValue ?? '') !== String(c.newValue ?? ''))
    .map((c) => ({
      table_name: opts.tableName,
      record_id: opts.recordId || null,
      unit_id: opts.unitId || null,
      field_name: c.field,
      old_value: c.oldValue == null ? null : String(c.oldValue),
      new_value: c.newValue == null ? null : String(c.newValue),
      action: 'UPDATE',
      source: opts.source || 'manual',
      changed_by: user.id,
    }))

  if (rows.length === 0) return

  const { error } = await supabase.from('audit_log').insert(rows)
  if (error) {
    console.warn('audit_log insert failed', error.message)
  }
}
