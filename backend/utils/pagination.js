// Reads ?page=2&limit=10 from the address and returns safe numbers
export const getPagination = (query, defaultLimit = 10) => {

    const page = Math.max(parseInt(query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 100)

    return { page, limit, skip: (page - 1) * limit }
}

// Makes user text safe to use inside a regular expression (for search boxes)
export const escapeRegex = (text) => {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
