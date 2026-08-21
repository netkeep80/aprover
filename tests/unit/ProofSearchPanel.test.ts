// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProofSearchPanel from '../../src/components/ProofSearchPanel.vue'
import { parseProofJsonV04 } from '../../src/core/proofReplayV04'

describe('ProofSearchPanel legacy compatibility path', () => {
  it('runs untrusted legacy search and locally replays the generated historical artifact', async () => {
    const wrapper = mount(ProofSearchPanel)

    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('LEGACY CANDIDATE FOUND')
    expect(wrapper.text()).toContain('LEGACY REPLAY MATCHED')
    expect(wrapper.text()).toContain('not accepted MTS v0.10 proof approval')

    const source = (wrapper.get('.proof-search-artifact').element as HTMLTextAreaElement).value
    const proof = parseProofJsonV04(source)
    expect(proof.judgments).toHaveLength(1)
    const judgment = proof.judgments[0]
    expect(judgment.relation).toBe('ContextuallySatisfies')
    if (judgment.relation !== 'ContextuallySatisfies') throw new Error('expected contextual judgment')
    expect(judgment.expression).toBe('[] = ◁')
    expect(judgment.expected.substitutions).toEqual([{ path: [0], link: 10 }])
  })

  it('shows legacy not-matched separately from errors', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('#proof-search-expression').setValue('◁ = ▷')
    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('LEGACY NOT MATCHED')
    expect(wrapper.text()).toContain('not-matched')
    expect(wrapper.find('.proof-search-artifact').exists()).toBe(false)
  })

  it('validates explicit context input before search', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('#proof-search-context').setValue('{"start":"bad","end":12}')
    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('SEARCH ERROR')
    expect(wrapper.text()).toContain('context.start: expected integer LinkRef')
    expect(wrapper.find('.proof-search-artifact').exists()).toBe(false)
  })

  it('accepts explicit symbols, memory and recursive parent context for legacy search', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('#proof-search-expression').setValue('30 = [] ⟼ []')
    await wrapper
      .get('#proof-search-context')
      .setValue('{"start":10,"end":12,"parent":{"start":20,"end":22}}')
    await wrapper.get('#proof-search-symbols').setValue('{"30":30}')
    await wrapper.get('#proof-search-memory').setValue('[{"id":30,"start":2,"end":3}]')
    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('LEGACY CANDIDATE FOUND')
    expect(wrapper.text()).toContain('LEGACY REPLAY MATCHED')

    const source = (wrapper.get('.proof-search-artifact').element as HTMLTextAreaElement).value
    const proof = parseProofJsonV04(source)
    const judgment = proof.judgments[0]
    expect(judgment.relation).toBe('ContextuallySatisfies')
    if (judgment.relation !== 'ContextuallySatisfies') throw new Error('expected contextual judgment')
    expect(judgment.context.parent).toEqual({ start: 20, end: 22 })
    expect(judgment.memory).toEqual([{ id: 30, start: 2, end: 3 }])
  })

  it('hands the historical artifact to the legacy replay workflow', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('.proof-search-run').trigger('click')
    await wrapper.get('.proof-search-result button').trigger('click')

    const emitted = wrapper.emitted('open-replay')
    expect(emitted).toHaveLength(1)
    expect(parseProofJsonV04(emitted?.[0]?.[0] as string).judgments).toHaveLength(1)
  })
})
