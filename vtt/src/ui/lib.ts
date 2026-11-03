/** Joins class names, skipping empty ones. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

/**
 * Interactive states of the UI Library. Real components get them from the browser (:hover,
 * :active, :focus-visible, disabled); `previewState` pins one for the component preview page.
 */
export type PreviewState = 'hover' | 'active' | 'focus'

export const stateAttr = (state?: PreviewState) => (state ? { 'data-state': state } : {})
