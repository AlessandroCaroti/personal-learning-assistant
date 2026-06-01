import { useCallback, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Esame } from '../types'
import * as storage from '../services/storageService'

export function useExam() {
  const [esami, setEsami] = useState<Esame[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const allEsami = await storage.getAllEsami()
      setEsami(
        [...allEsami].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const createEsame = useCallback(
    async (name: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Nome esame obbligatorio')

      const esame: Esame = {
        id: uuidv4(),
        name: trimmedName,
        createdAt: new Date().toISOString(),
        files: {},
      }

      await storage.saveEsame(esame)
      await reload()
      return esame
    },
    [reload],
  )

  const renameEsame = useCallback(
    async (id: string, name: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) return

      const esame = await storage.getEsame(id)
      if (!esame) return

      await storage.saveEsame({
        ...esame,
        name: trimmedName,
      })
      await reload()
    },
    [reload],
  )

  const deleteEsame = useCallback(
    async (id: string) => {
      await storage.deleteEsame(id)
      await reload()
    },
    [reload],
  )

  return {
    esami,
    loading,
    createEsame,
    renameEsame,
    deleteEsame,
    reload,
  }
}
