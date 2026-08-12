// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnumDenotationPanel from '../../src/components/AnumDenotationPanel.vue'

describe('AnumDenotationPanel current raw transport v0.4', () => {
  it('shows semantic stream result without occurrence-tree ids', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['10'] } })

    expect(wrapper.text()).toContain('Anum raw transport deserialization v0.4')
    expect(wrapper.text()).toContain('semantic-link')
    expect(wrapper.text()).toContain('(L⟼U)')
    expect(wrapper.text()).toContain('L, U')
    expect(wrapper.text()).toContain('VALUE → VALUE')
    expect(wrapper.text()).not.toContain('node:')
    expect(wrapper.text()).not.toContain('protocol:')
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('renders empty group as root', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['[]'] } })

    expect(wrapper.get('.result').text()).toBe('R')
    expect(wrapper.text()).toContain('OPEN → CLOSE')
  })

  it('renders non-empty nested root-wrap', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['[10]'] } })

    expect(wrapper.get('.result').text()).toBe('(R⟼(L⟼U))')
    expect(wrapper.text()).toContain('maxDepth')
    expect(wrapper.text()).toContain('1')
  })

  it('renders multiple raw lines independently and exposes semantic errors', () => {
    const wrapper = mount(AnumDenotationPanel, {
      props: { rawLines: ['1', '[]', ']'] },
    })

    expect(wrapper.findAll('.entry')).toHaveLength(3)
    expect(wrapper.findAll('.result').map(node => node.text())).toEqual(['L', 'R'])
    expect(wrapper.get('[role="alert"]').text()).toContain('unexpected-close')
  })

  it('contains no L4 mutation controls and states identity boundary', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['1110'] } })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('ordered poles')
    expect(wrapper.text()).toContain('not identities')
    expect(wrapper.text()).toContain('no MemoryView')
  })
})
