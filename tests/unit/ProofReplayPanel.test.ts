// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProofReplayPanel from '../../src/components/ProofReplayPanel.vue'
import { MTS_CONTRACT_VERSION, MTS_PROOF_SCHEMA } from '../../src/core/proofReplay'

function artifact(link = 10): string {
  return JSON.stringify({
    schema: MTS_PROOF_SCHEMA,
    contractVersion: MTS_CONTRACT_VERSION,
    steps: [
      {
        rule: 'interpret',
        expression: '[] = ◁',
        context: { start: 10, end: 12, parent: { start: 20, end: 22 } },
        expected: {
          success: true,
          substitutions: [{ path: [0], link }],
          aliases: [],
        },
      },
    ],
  })
}

describe('ProofReplayPanel', () => {
  it('shows an independently accepted proof with step/context/substitution details', () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: artifact() } })

    expect(wrapper.text()).toContain('REPLAY ACCEPTED')
    expect(wrapper.text()).toContain(MTS_PROOF_SCHEMA)
    expect(wrapper.text()).toContain(MTS_CONTRACT_VERSION)
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

  it('shows validator errors for malformed/untrusted artifacts', () => {
    const wrapper = mount(ProofReplayPanel, {
      props: {
        modelValue: '{"schema":"wrong","contractVersion":"mts-contract/v0.2","steps":[]}',
      },
    })

    expect(wrapper.text()).toContain('Validation error')
    expect(wrapper.text()).toContain('$.schema')
    expect(wrapper.text()).not.toContain('REPLAY REJECTED')
  })

  it('emits proof JSON edits without interpreting them in the component', async () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: '' } })
    await wrapper.get('textarea').setValue('{"schema":"mts-proof/v0.2"}')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['{"schema":"mts-proof/v0.2"}'])
  })

  it('emits close from the presentation control', async () => {
    const wrapper = mount(ProofReplayPanel, { props: { modelValue: '' } })
    await wrapper.get('[aria-label="Close proof replay"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
