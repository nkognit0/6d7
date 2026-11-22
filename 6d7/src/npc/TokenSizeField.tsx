import { useStrings } from '../i18n'
import { MAX_TOKEN_SIZE } from '../map'
import { RowField, Select } from '../ui'

const SIZES = Array.from({ length: MAX_TOKEN_SIZE }, (_, i) => i + 1)

/**
 * «Размер фишки» of an NPC: 1×1 to 4×4 cells on the map (QnA, 22.11.2026) — in the window of an
 * NPC on the map and in the panel of the «NPC» tab.
 */
export function TokenSizeField({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const s = useStrings()
  const t = s.editor.npc
  return (
    <RowField label={t.tokenSize}>
      <Select value={String(value)} aria-label={t.tokenSize} onChange={(v) => onChange(Number(v))}
        options={SIZES.map((n) => ({ value: String(n), label: t.tokenSizeCells(n) }))} />
    </RowField>
  )
}
