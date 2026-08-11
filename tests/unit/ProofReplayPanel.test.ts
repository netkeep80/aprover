// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProofReplayPanel from '../../src/components/ProofReplayPanel.vue'
import {
  MTS_PROOF_CONTRACT_VERSION_V04,
  MTS_PROOF_SCHEMA_V04,
} from '../../src/core/proofReplayV04'

function artifact(link = 10): string {
  return JSON.stringify({
    proofVersion: MTS_PROOF_SCHEMA_V04,
    contractVersion: MTS_PROOF_CONTRACT_VERSION_V04,
    judgments: [
      {
        relation: 'ContextuallySatisfies',
        expression: '[] = ◁',
        context: {
          start: 10,
          end: 12,
          parent: { start: 20, end: 22, parent: null },
        },
        symbols: [],
        memory: [],
        expected: {
          substitutions: [{ path: [0], link }],
          aliases: [],
        },
      },
    ],
  })
}

describe('ProofReplayPanel', () => {
  it('shows an independently accepted current proof with context/substitution details', () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: artifact() } })

    expect(wrapper.text()).toContain('REPLAY ACCEPTED')
    expect(wrapper.text()).toContain(MTS_PROOF_SCHEMA_V04)
    expect(wrapper.text()).toContain(MTS_PROOF_CONTRACT_VERSION_V04)
    expect(wrapper.text()).toContain('[] = ◁')
    expect(wrapper.text()).toContain('current: ◁=10 · ▷=12')
    expect(wrapper.text()).toContain('parent↑1: ◁=20 · ▷=22')
    expect(wrapper.text()).toContain('[] @ 0 → LinkRef 10')
  })

  it('shows a replay rejection separately from validation errors', () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: artifact(12) } })

    expect(wrapper.text()).toContain('REPLAY REJECTED')
    expect(wrapper.text()).not.toContain('Validation error')
  })

  it('shows validator errors for legacy artifacts instead of compatibility replay', () => {
    const wrapper = mount(ProofReplayPanel, {
      props: {
        modelValue: '{"schema":"mts-proof/v0.2","contractVersion":"mts-contract/v0.2","steps":[]}',
      },
    })

    expect(wrapper.text()).toContain('Validation error')
    expect(wrapper.text()).toContain('$.proofVersion')
    expect(wrapper.text()).toContain('mts-proof/v0.4')
    expect(wrapper.text()).not.toContain('REPLAY REJECTED')
  })

  it('emits proof JSON edits without interpreting them in the component', async () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: '' } })
    await wrapper.get('textarea').setValue('{"proofVersion":"mts-proof/v0.4"}')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      '{"proofVersion":"mts-proof/v0.4"}',
    ])
  })

  it('emits close from the presentation control', async () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: '' } })
    await wrapper.get('[aria-label="Close proof replay"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
