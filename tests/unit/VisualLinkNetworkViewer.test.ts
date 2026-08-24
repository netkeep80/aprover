// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import type { VisualLinkNetwork } from '@mts/visual'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VisualLinkNetworkViewer from '../../src/components/VisualLinkNetworkViewer.vue'

const threeMocks = vi.hoisted(() => ({
  createRenderer: vi.fn(),
  createControls: vi.fn(),
  destroyRenderer: vi.fn(),
}))

vi.mock('@mts/visual/three', () => ({
  createVisualThreeLiveRenderer: threeMocks.createRenderer,
  createVisualThreeControlBar: threeMocks.createControls,
  destroyVisualThreeRenderer: threeMocks.destroyRenderer,
}))

const rootNetwork: VisualLinkNetwork = Object.freeze({
  links: Object.freeze([
    Object.freeze({ key: 'root', startKey: 'root', endKey: 'root' }),
  ]),
})

const extendedNetwork: VisualLinkNetwork = Object.freeze({
  links: Object.freeze([
    Object.freeze({ key: 'root', startKey: 'root', endKey: 'root' }),
    Object.freeze({ key: 'link', startKey: 'root', endKey: 'root' }),
  ]),
})

function surface(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[data-visual-link-network-surface]').element as HTMLElement
}

function controls(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[data-visual-link-network-controls]').element as HTMLElement
}

describe('VisualLinkNetworkViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts accepted live physics, Three renderer and shared controls for the exact supplied network', async () => {
    const wrapper = mount(VisualLinkNetworkViewer, {
      props: { network: rootNetwork },
    })
    await nextTick()

    expect(threeMocks.createRenderer).toHaveBeenCalledTimes(1)
    const [rendererSurface, rendererNetwork, controller] = threeMocks.createRenderer.mock.calls[0]
    expect(rendererSurface).toBe(surface(wrapper))
    expect(rendererNetwork).toBe(rootNetwork)
    expect(controller.model.keys).toEqual(['root'])

    expect(threeMocks.createControls).toHaveBeenCalledTimes(1)
    const [controlSurface, controlHost, options] = threeMocks.createControls.mock.calls[0]
    expect(controlSurface).toBe(surface(wrapper))
    expect(controlHost).toBe(controls(wrapper))
    expect(Number.isFinite(options.charge)).toBe(true)
    expect(Number.isFinite(options.springStiffness)).toBe(true)
    expect(options).toEqual({ charge: 1, springStiffness: 0.055 })

    expect(threeMocks.destroyRenderer).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('destroys the previous presentation before mounting a replacement network', async () => {
    const wrapper = mount(VisualLinkNetworkViewer, {
      props: { network: rootNetwork },
    })
    await nextTick()
    const mountedSurface = surface(wrapper)

    await wrapper.setProps({ network: extendedNetwork })
    await nextTick()

    expect(threeMocks.destroyRenderer).toHaveBeenCalledTimes(1)
    expect(threeMocks.destroyRenderer).toHaveBeenNthCalledWith(1, mountedSurface)
    expect(threeMocks.createRenderer).toHaveBeenCalledTimes(2)
    expect(threeMocks.createRenderer.mock.calls[1][1]).toBe(extendedNetwork)

    wrapper.unmount()
  })

  it('destroys the active shared renderer exactly once on unmount', async () => {
    const wrapper = mount(VisualLinkNetworkViewer, {
      props: { network: rootNetwork },
    })
    await nextTick()
    const mountedSurface = surface(wrapper)

    wrapper.unmount()

    expect(threeMocks.destroyRenderer).toHaveBeenCalledTimes(1)
    expect(threeMocks.destroyRenderer).toHaveBeenCalledWith(mountedSurface)
  })
})
