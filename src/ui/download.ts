/** Saves `data` as a JSON file through the browser's download. */
export function downloadJson(fileName: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoke once the click has handed the file to the browser.
  setTimeout(() => URL.revokeObjectURL(url))
}
