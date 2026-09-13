/** True while an IME is composing: its keystrokes belong to the candidate window. */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

/** Fields where a keystroke is text: inputs, textareas, selects, contenteditable (CodeMirror). */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])')) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}

/** Multi-line editors, where Ctrl+letter combinations are usually taken by the editor itself. */
export function isEditor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target instanceof HTMLTextAreaElement || target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

/** Whether a modal (dialog, lightbox, menu sheet) other than the quick switcher is open. */
export function isModalOpen(): boolean {
  return document.querySelector('[aria-modal="true"]:not([data-quick-switcher])') !== null
}
