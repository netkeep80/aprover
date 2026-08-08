// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnumDenotationPanel from '../../src/components/AnumDenotationPanel.vue'

describe('AnumDenotationPanel', () => {
  it('renders structural root denotation and canonical inverse', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['01'] } })

    expect(wrapper.text()).toContain('Anum denotation v0.2')
    expect(wrapper.text()).toContain('structural')
    expect(wrapper.text()).toContain('protocol:0')
    expect(wrapper.text()).toContain('protocol:1')
    expect(wrapper.text()).toContain('node:0')
    expect(wrapper.text()).toContain('canonicalRaw')
    expect(wrapper.text()).toContain('01')
  })

  it('renders nested recursive nodes in postorder', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['[01]1'] } })
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('0')
    expect(rows[1].text()).toContain('1')
    expect(wrapper.text()).toContain('[01]1')
  })

  it('switches to quote and relative context through the same core consumer', async () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['[01]'] } })
    const select = wrapper.get('select')

    await select.setValue('quote')
    expect(wrapper.text()).toContain('quoted-raw')
    expect(wrapper.text()).toContain('01')

    await select.setValue('relative')
    expect(wrapper.text()).toContain('raw')
    expect(wrapper.text()).toContain('[01]')
  })

  it('renders multiple raw lines independently', () => {
    const wrapper = mount(AnumDenotationPanel, {
      props: { rawLines: ['0', '01', '[['] },
    })

    expect(wrapper.findAll('.entry')).toHaveLength(3)
    expect(wrapper.text()).toContain('line 1')
    expect(wrapper.text()).toContain('line 2')
    expect(wrapper.text()).toContain('line 3')
    expect(wrapper.text()).toContain('raw')
  })

  it('contains no L4 mutation controls', () => {
    const wrapper = mount(AnumDenotationPanel, { props: { rawLines: ['01'] } })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('Presentation only')
    expect(wrapper.text()).toContain('no MemoryView')
  })
})
