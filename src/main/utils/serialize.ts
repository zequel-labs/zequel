export const toPlainObject = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))
