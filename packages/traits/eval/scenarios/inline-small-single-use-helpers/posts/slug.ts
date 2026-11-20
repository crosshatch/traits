export const toSlug = (title: string) => title.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-")
