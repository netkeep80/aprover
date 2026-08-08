// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProofSearchPanel from '../../src/components/ProofSearchPanel.vue'
import { parseProofJson } from '../../src/core/proofReplay'

describe('ProofSearchPanel', () => {
  it('runs untrusted search and independently replays the generated artifact', async () => {
    const wrapper = mount(ProofSearchPanel)

    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('SEARCH PROVEN')
    expect(wrapper.text()).toContain('REPLAY ACCEPTED')

    const source = (wrapper.get('.proof-search-artifact').element as HTMLTextAreaElement).value
    const proof = parseProofJson(source)
    expect(proof.steps).toHaveLength(1)
    expect(proof.steps[0].expression).toBe('[] = ◁')
    expect(proof.steps[0].expected.substitutions).toEqual([{ path: [0], link: 10 }])
  })

  it('shows not-proven separately from errors', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('#proof-search-expression').setValue('◁ = ▷')
    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('NOT PROVEN')
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

  it('accepts explicit symbols, memory and recursive parent context', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('#proof-search-expression').setValue('30 = [] ⟼ []')
    await wrapper
      .get('#proof-search-context')
      .setValue('{"start":10,"end":12,"parent":{"start":20,"end":22}}')
    await wrapper.get('#proof-search-symbols').setValue('{"30":30}')
    await wrapper
      .get('#proof-search-memory')
      .setValue('[{"id":30,"start":2,"end":3}]')
    await wrapper.get('.proof-search-run').trigger('click')

    expect(wrapper.text()).toContain('SEARCH PROVEN')
    expect(wrapper.text()).toContain('REPLAY ACCEPTED')

    const source = (wrapper.get('.proof-search-artifact').element as HTMLTextAreaElement).value
    const proof = parseProofJson(source)
    expect(proof.steps[0].context.parent).toEqual({ start: 20, end: 22 })
    expect(proof.steps[0].distinguishedMemory).toEqual([{ id: 30, start: 2, end: 3 }])
  })

  it('hands the portable generated artifact to the replay workflow', async () => {
    const wrapper = mount(ProofSearchPanel)
    await wrapper.get('.proof-search-run').trigger('click')
    await wrapper.get('.proof-search-result button').trigger('click')

    const emitted = wrapper.emitted('open-replay')
    expect(emitted).toHaveLength(1)
    expect(parseProofJson(emitted?.[0]?.[0] as string).steps).toHaveLength(1)
  })
})
