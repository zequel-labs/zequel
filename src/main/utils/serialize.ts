export const toPlainObject = <T>(obj: T): T =>
  JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ))
