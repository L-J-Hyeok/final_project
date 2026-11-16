export function createCatalogApi(request) {
  const root = '/api/catalog'
  async function all(path, signal) {
    const rows = []
    const cursors = new Set()
    let after = null
    do {
      const query = new URLSearchParams({ limit: '30' })
      if (after) query.set('after', after)
      const { data, next_cursor } = await request(path + '?' + query, { signal })
      rows.push(...data)
      after = next_cursor
      if (after && cursors.has(after)) throw new Error('Invalid catalog cursor')
      cursors.add(after)
    } while (after)
    return rows
  }

  return {
    categories: signal => request(root + '/categories', { signal }),
    models: (category, signal) => all(root + '/' + encodeURIComponent(category) + '/models', signal),
    skus: (category, modelId, signal) => all(root + '/' + encodeURIComponent(category) + '/models/' +
      encodeURIComponent(modelId) + '/skus', signal),
    compare: (category, selections, signal) => request(root + '/' + encodeURIComponent(category) + '/compare?' +
      new URLSearchParams({ items: selections.join(',') }), { signal })
  }
}
