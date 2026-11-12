// The wizards of a sheet (a new sheet, its next level, the companion) for the screens that show a
// seat: the player's game and the sheet demo. A higher-level start opens «Новый уровень» again
// until the sheet reaches that level.
import { useMemo, useState } from 'react'
import type { CompanionSheet as CompanionData } from '@app/companion/companion'
import { MAX_LEVEL, sheetLevel } from '@app/levelup/read'
import { useStrings } from '../../i18n'
import { ConfirmDialog } from '../../ui'
import { CharacterWizard } from '../../wizard/character/CharacterWizard'
import { CompanionLevelUp, CompanionWizard } from '../../wizard/companion/CompanionWizard'
import { LevelUpWizard } from '../../wizard/levelup/LevelUpWizard'
import { importCharacter } from '../seat/import'
import { characterOf, withCharacter, type CompanionFields, type Seat } from '../seat/seat'

export function useSeatWizards(seat: Seat, onChange: (seat: Seat) => void) {
  const s = useStrings()
  const [creating, setCreating] = useState(false)
  const [levelUp, setLevelUp] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)
  const [companionWizard, setCompanionWizard] = useState<'new' | 'level' | null>(null)
  const [replacing, setReplacing] = useState(false)
  const character = useMemo(() => characterOf(seat), [seat])
  const level = sheetLevel(character)
  const companion = (seat.companion ?? null) as CompanionData | null

  const element = (
    <>
      <CharacterWizard
        opened={creating}
        onClose={() => setCreating(false)}
        onComplete={(c, startLevel) => {
          setCreating(false)
          importCharacter(c).then((next) => {
            onChange({ ...next, started: seat.started })
            if (startLevel > 1) {
              setGoal(startLevel)
              setLevelUp(true)
            }
          })
        }}
      />
      {levelUp && (
        <LevelUpWizard key={level ?? 0} character={character} goal={goal}
          onClose={() => {
            setLevelUp(false)
            setGoal(null)
          }}
          onComplete={(c) => {
            onChange(withCharacter(seat, c))
            const more = goal != null && (sheetLevel(c) ?? MAX_LEVEL) < goal
            setLevelUp(more)
            if (!more) setGoal(null)
          }} />
      )}
      {companionWizard === 'new' && (
        <CompanionWizard character={character} onClose={() => setCompanionWizard(null)}
          onComplete={(sheet) => {
            onChange({ ...seat, companion: sheet as CompanionFields })
            setCompanionWizard(null)
          }} />
      )}
      {companionWizard === 'level' && companion && (
        <CompanionLevelUp character={character} companion={companion} onClose={() => setCompanionWizard(null)}
          onComplete={(sheet) => {
            onChange({ ...seat, companion: sheet as CompanionFields })
            setCompanionWizard(null)
          }} />
      )}
      {replacing && (
        <ConfirmDialog text={s.companion.replaceConfirm} confirm={s.companion.replace} cancel={s.common.cancel}
          onConfirm={() => {
            setReplacing(false)
            setCompanionWizard('new')
          }}
          onCancel={() => setReplacing(false)} />
      )}
    </>
  )

  return {
    /** the level of the sheet; null — no class and level yet */
    level,
    canLevelUp: level != null && level < MAX_LEVEL,
    companion,
    create: () => setCreating(true),
    levelUp: () => setLevelUp(true),
    newCompanion: () => (companion ? setReplacing(true) : setCompanionWizard('new')),
    companionLevel: () => setCompanionWizard('level'),
    /** the open wizards: render it on the screen */
    element
  }
}
