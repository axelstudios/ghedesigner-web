export const overrideLogging = () => {
  const _origConsoleError = console.error

  console.error = function (...args) {
    const [a, b] = args

    // Ignore monaco's `Canceled` errors:
    const error = a instanceof Error ? a : b instanceof Error ? b : undefined
    if (error?.name === 'Canceled' && error.stack?.includes('/monaco/')) {
      return
    }

    return _origConsoleError.apply(console, args)
  }
}
