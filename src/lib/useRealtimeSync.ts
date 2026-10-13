import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export function useRealtimeSync(onEventReceived?: (tableName: string, eventType: string) => void) {
  const queryClient = useQueryClient()
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())

  useEffect(() => {
    // Create dedicated Supabase Realtime channel
    const channel = supabase
      .channel('sdlg_fleet_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'units' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['units_page'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
          queryClient.invalidateQueries({ queryKey: ['units_count'] })
          setLastSyncTime(new Date())
          if (onEventReceived) onEventReceived('units', payload.eventType)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unit_process' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['process_page_data'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
          queryClient.invalidateQueries({ queryKey: ['process_summary'] })
          setLastSyncTime(new Date())
          if (onEventReceived) onEventReceived('unit_process', payload.eventType)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unit_documents' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['docs_page_data'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard_full_compliance_data'] })
          queryClient.invalidateQueries({ queryKey: ['docs_missing_count'] })
          setLastSyncTime(new Date())
          if (onEventReceived) onEventReceived('unit_documents', payload.eventType)
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, onEventReceived])

  return { isLiveConnected, lastSyncTime }
}
