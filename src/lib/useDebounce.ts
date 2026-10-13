import { useState, useEffect } from 'react'

/**
 * Custom hook to debounce a fast-changing value (e.g. search input).
 * Prevents redundant API queries and network spamming on keystrokes.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
