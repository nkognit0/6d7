import type { CampaignSession, CampaignSettings } from '../campaign'
import { useStrings } from '../i18n'
import { SettingRow } from '../ui'
import { TabPage } from './TabPage'
import styles from './EditorScreen.module.css'

/**
 * D&D VTT / editor / rules (41:4119): the settings of the campaign. Maps follow them unless they
 * changed a setting themselves. Doors open freely only while tokens move freely, so the door
 * setting shows only then.
 */
export function SettingsTab({ session }: { session: CampaignSession }) {
  const t = useStrings().editor.settings
  const { settings } = session.campaign
  const set = (patch: Partial<CampaignSettings>) => session.apply([{ doc: 'campaign', op: { type: 'settings', patch } }])
  return (
    <TabPage title={t.title}>
      <div className={styles.settings}>
        <SettingRow title={t.freeMovement} description={t.freeMovementHint} checked={settings.freeMove} onChange={(v) => set({ freeMove: v })} />
        {settings.freeMove && <SettingRow title={t.freeDoors} description={t.freeDoorsHint} checked={settings.freeDoors} onChange={(v) => set({ freeDoors: v })} />}
        <SettingRow title={t.dynamicFog} description={t.dynamicFogHint} checked={settings.dynamicFog} onChange={(v) => set({ dynamicFog: v })} />
      </div>
    </TabPage>
  )
}
