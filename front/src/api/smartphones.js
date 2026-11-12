// Smartphone catalog & detail API client helper for comparison & device selection
export function createSmartphoneApi(api) {
  return {
    async list(params = {}, signal) {
      const q = new URLSearchParams()
      if (params.brand) q.set('brand', params.brand)
      if (params.os) q.set('os', params.os)
      if (params.storage_gb) q.set('storage_gb', String(params.storage_gb))
      if (params.only_recommendable !== undefined) q.set('only_recommendable', String(params.only_recommendable))
      if (params.limit) q.set('limit', String(params.limit))
      if (params.cursor) q.set('cursor', String(params.cursor))
      const qs = q.toString()
      return api(`/api/smartphones${qs ? '?' + qs : ''}`, { signal })
    },
    async listAll(params = {}, signal) {
      const pageLimit = Math.min(50, Math.max(1, Number(params.limit || 50)))
      const seenIds = new Set()
      const allItems = []
      let cursor = params.cursor ? String(params.cursor) : null
      let lastResponse = null

      for (let page = 0; page < 100; page++) {
        if (signal?.aborted) {
          const abortErr = new Error('The operation was aborted')
          abortErr.name = 'AbortError'
          throw abortErr
        }
        const res = await this.list(
          {
            ...params,
            limit: pageLimit,
            ...(cursor ? { cursor } : {})
          },
          signal
        )
        lastResponse = res
        const pageItems = Array.isArray(res?.data) ? res.data : []
        for (const item of pageItems) {
          const key = item?.variant_id !== undefined && item?.variant_id !== null
            ? String(item.variant_id)
            : (item?.id !== undefined && item?.id !== null ? String(item.id) : '')
          if (key && seenIds.has(key)) continue
          if (key) seenIds.add(key)
          allItems.push(item)
        }
        const nextCursor = res?.next_cursor ? String(res.next_cursor) : null
        if (!nextCursor || nextCursor === cursor || pageItems.length === 0) break
        cursor = nextCursor
      }

      return {
        ...(lastResponse || {}),
        data: allItems,
        next_cursor: null
      }
    },
    async get(variantId, signal) {
      return api(`/api/smartphones/${variantId}`, { signal })
    },
    async search(query, cursor, signal) {
      const q = new URLSearchParams({ q: query })
      if (cursor) q.set('cursor', String(cursor))
      return api(`/api/owned-device-options?${q.toString()}`, { signal })
    }
  }
}
