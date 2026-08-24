<script setup lang="ts">
import {
  createInitialPhysics3DState,
  createLivePhysics3D,
  type VisualLinkNetwork,
} from '@mts/visual'
import {
  createVisualThreeControlBar,
  createVisualThreeLiveRenderer,
  destroyVisualThreeControlBar,
  destroyVisualThreeRenderer,
  type VisualThreeContainer,
  type VisualThreeControlHost,
} from '@mts/visual/three'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  network: VisualLinkNetwork
}>()

const surface = ref<HTMLElement | null>(null)
const controls = ref<HTMLElement | null>(null)
let mounted = false

function teardown(): void {
  const surfaceElement = surface.value
  if (!mounted || !surfaceElement) return

  const container = surfaceElement as unknown as VisualThreeContainer
  destroyVisualThreeControlBar(container)
  destroyVisualThreeRenderer(container)
  mounted = false
}

function mountNetwork(network: VisualLinkNetwork): void {
  const surfaceElement = surface.value
  const controlsElement = controls.value
  if (!surfaceElement || !controlsElement) return

  teardown()

  const container = surfaceElement as unknown as VisualThreeContainer
  const controlHost = controlsElement as unknown as VisualThreeControlHost
  const initialState = createInitialPhysics3DState(network)
  const controller = createLivePhysics3D(network, initialState)

  try {
    createVisualThreeLiveRenderer(container, network, controller)
    createVisualThreeControlBar(container, controlHost, {
      charge: 1,
      springStiffness: 0.055,
    })
    mounted = true
  } catch (error) {
    destroyVisualThreeControlBar(container)
    destroyVisualThreeRenderer(container)
    mounted = false
    throw error
  }
}

onMounted(() => mountNetwork(props.network))
watch(
  () => props.network,
  network => mountNetwork(network),
)
onUnmounted(teardown)
</script>

<template>
  <section class="visual-link-network-viewer">
    <div
      ref="surface"
      data-visual-link-network-surface
      class="visual-link-network-viewer__surface"
    >
      <div
        ref="controls"
        data-visual-link-network-controls
        class="visual-link-network-viewer__controls"
      ></div>
    </div>
  </section>
</template>

<style scoped>
.visual-link-network-viewer {
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.visual-link-network-viewer__surface {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
}

.visual-link-network-viewer__controls {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
}
</style>
