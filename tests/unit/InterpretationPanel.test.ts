// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import InterpretationPanel from '../../src/components/InterpretationPanel.vue'

describe('InterpretationPanel', () => {
  it('renders substitutions, aliases and resolution trace from canonical result', () => {
    const wrapper = mount(InterpretationPanel, {
      props: {
        result: {
          success: true,
          substitutions: [{ path: [0], link: 10 }],
          aliases: [{ path: [1], targetPath: [0] }],
          trace: ['equality', 'bind:0->10'],
        },
      },
    })

    expect(wrapper.text()).toContain('matched')
    expect(wrapper.text()).toContain('[] @ 0')
    expect(wrapper.text()).toContain('LinkRef 10')
    expect(wrapper.text()).toContain('[] @ 1')
    expect(wrapper.text()).toContain('→ [] @ 0')
    expect(wrapper.text()).toContain('equality')
    expect(wrapper.text()).toContain('bind:0->10')
  })

  it('renders an interpreter error separately from a failed match', () => {
    const wrapper = mount(InterpretationPanel, {
      props: {
        result: null,
        error: 'Symbol "x" is not bound',
      },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('Symbol "x" is not bound')
    expect(wrapper.text()).not.toContain('not matched')
  })

  it('renders failed matching as a normal canonical result', () => {
    const wrapper = mount(InterpretationPanel, {
      props: {
        result: {
          success: false,
          substitutions: [],
          aliases: [],
          trace: ['inequality'],
        },
      },
    })

    expect(wrapper.text()).toContain('not matched')
    expect(wrapper.text()).toContain('inequality')
  })
})
