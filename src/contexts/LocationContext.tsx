import { createContext, useContext, useState, type ReactNode } from 'react'
import type { CascadeSelection } from '@/hooks/useCascadeLocation'

interface LocationContextValue {
  selectedLocation: CascadeSelection | null
  setSelectedLocation: (loc: CascadeSelection | null) => void
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedLocation, setSelectedLocation] = useState<CascadeSelection | null>(null)

  return (
    <LocationContext.Provider value={{ selectedLocation, setSelectedLocation }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useSelectedLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useSelectedLocation deve ser usado dentro de <LocationProvider>')
  return ctx
}
