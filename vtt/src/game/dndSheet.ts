// Stand-in for the 'dnd-sheet' package inside the VTT: the rules logic of the old app (app/src)
// needs only the sheet's type and its field labels, not its components and styles.
export type { DnDAttack, DnDSpell } from '../../../dnd-sheet/src/DnDCharacter'
export type { default as DnDCharacter } from '../../../dnd-sheet/src/DnDCharacter'
export { default as labels } from '../../../dnd-sheet/src/labels'
