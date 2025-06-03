const numericComparison = (a: string, b: string) => {
  const numA = +a
  if (Number.isNaN(numA)) return false
  const numB = +b
  if (Number.isNaN(numB)) return false
  if (numA === numB) return 0
  return numA < numB ? -1 : 1
}

const collator = new Intl.Collator(undefined, { ignorePunctuation: false, sensitivity: 'base' })

export const naturalSort = (a?: string, b?: string) => {
  if (a === b) return 0
  if (!a) return -1
  if (!b) return 1

  const numericResult = numericComparison(a, b)
  if (numericResult !== false) return numericResult

  return collator.compare(a, b)
}
