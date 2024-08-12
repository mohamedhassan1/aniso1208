import { OrbitControls, useAspect, useContextBridge } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import cn from 'clsx'
import { ASCIIEffect } from 'components/ascii-effect/index'
import { FontEditor } from 'components/font-editor'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  AnimationMixer,
  Group,
  MeshBasicMaterial,
  MeshNormalMaterial,
  TextureLoader,
  VideoTexture,
} from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import tunnel from 'tunnel-rat'
import s from './ascii.module.scss'
import { AsciiContext } from './context'

const ui = tunnel()

function Scene() {
  const ref = useRef()
  const { fit } = useContext(AsciiContext)
  const [asset, setAsset] = useState('/global-big.glb')

  console.log('Scene: fit value is', fit)

  const gltfLoader = useMemo(() => {
    const loader = new GLTFLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(
      'https://cdn.jsdelivr.net/npm/three@0.140.0/examples/js/libs/draco/'
    )
    loader.setDRACOLoader(dracoLoader)
    return loader
  }, [])

  const [mixer, setMixer] = useState()

  useFrame((_, t) => {
    mixer?.update(t)
  })

  const gltf = useMemo(() => {
    if (!asset) return
    let src = asset

    if (src.startsWith('data:application/octet-stream;base64') || src.includes('.glb')) {
      const group = new Group()

      gltfLoader.load(src, ({ scene, animations }) => {
        const mixer = new AnimationMixer(scene)
        setMixer(mixer)
        const clips = animations

        clips.forEach((clip) => {
          mixer.clipAction(clip).play()
        })

        group.add(scene)
        scene.traverse((mesh) => {
          if (
            Object.keys(mesh.userData)
              .map((v) => v.toLowerCase())
              .includes('occlude')
          ) {
            mesh.material = new MeshBasicMaterial({ color: '#000000' })
          } else {
            mesh.material = new MeshNormalMaterial()
          }
        })
      })

      return group
    }
  }, [asset])

  const [texture, setTexture] = useState()

  useEffect(() => {
    if (gltf) setTexture(null)
  }, [gltf])

  useEffect(() => {
    let src = asset

    if (
      src.startsWith('data:video') || src.includes('.mp4') || src.includes('.webm') || src.includes('.mov')) {
      const video = document.createElement('video')

      function onLoad() {
        setTexture(new VideoTexture(video))
      }

      video.addEventListener('loadedmetadata', onLoad, { once: true })

      video.src = src
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      video.loop = true
      video.autoplay = true
      video.play()
    } else if (
      src.startsWith('data:image') || src.includes('.jpg') || src.includes('.png') || src.includes('.jpeg')) {
      new TextureLoader().load(src, (texture) => {
        setTexture(texture)
      })
    }
  }, [asset])

  const { viewport, camera } = useThree()

  const dimensions = useMemo(() => {
    if (!texture) return
    if (texture.isVideoTexture) {
      return [texture.image.videoWidth, texture.image.videoHeight]
    } else {
      return [texture.image.naturalWidth, texture.image.naturalHeight]
    }
  }, [texture])

  const scale = useAspect(
    dimensions?.[0] || viewport.width, // Pixel-width
    dimensions?.[1] || viewport.height, // Pixel-height
    1 // Optional scaling factor
  )

  useEffect(() => {
    if (texture) {
      camera.position.set(0, 0, 5)
      camera.rotation.set(0, 0, 0)
      camera.zoom = 1
    } else {
      camera.position.set(500, 250, 500)
    }
    camera.updateProjectionMatrix()
  }, [camera, texture])

  return (
    <>
      <group ref={ref}>
        {gltf && (
          <>
            <OrbitControls 
              makeDefault 
              enableZoom={false} 
              enablePan={false} 
            />
            <group scale={200}>
              <primitive object={gltf} />
            </group>
          </>
        )}

        {texture && (
          <mesh scale={fit ? scale : [viewport.width, viewport.height, 1]}>
            <planeBufferGeometry />
            <meshBasicMaterial map={texture} />
          </mesh>
        )}
      </group>
    </>
  )
}

function Postprocessing() {
  const { gl, viewport } = useThree()
  const { set, matrix } = useContext(AsciiContext)

  useEffect(() => {
    set({ canvas: gl.domElement })
  }, [gl, set])

  console.log('Postprocessing: matrix effect is', matrix ? 'ON' : 'OFF')

  return (
    <EffectComposer>
      <ASCIIEffect
        charactersTexture={viewport.charactersTexture}
        granularity={viewport.granularity * viewport.dpr}
        charactersLimit={viewport.charactersLimit}
        fillPixels={viewport.fillPixels}
        color={viewport.color}
        fit={viewport.fit}
        greyscale={viewport.greyscale}
        invert={viewport.invert}
        matrix={matrix}
        time={viewport.time}
        background={viewport.background}
      />
    </EffectComposer>
  )
}

function Inner() {
  const ContextBridge = useContextBridge(AsciiContext)
  const { set, matrix } = useContext(AsciiContext)

  // Toggle matrix effect on Shift+R
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.shiftKey && event.key === 'R') {
        console.log('Shift+R pressed, toggling matrix effect...', !matrix)
        set({ matrix: !matrix })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [matrix, set])

  return (
    <>
      <div className={s.ascii}>
        <div className={cn(s.canvas)}>
          <Canvas
            flat
            linear
            orthographic
            camera={{ position: [0, 0, 500], near: 0.1, far: 10000 }}
            resize={{ debounce: 100 }}
            gl={{
              antialias: false,
              alpha: true,
              depth: false,
              stencil: false,
              powerPreference: 'high-performance',
            }}
          >
            <ContextBridge>
              <Scene />
              <Postprocessing />
            </ContextBridge>
          </Canvas>
        </div>
      </div>
      <FontEditor />
      <ui.Out />
    </>
  )
}

const DEFAULT = {
  characters: ' *,    ./O#RL',
  granularity: 8,
  charactersLimit: 16,
  fontSize: 72,
  fillPixels: false,
  setColor: true,
  color: '#ffffff',
  background: '#cd9bff',
  greyscale: false,
  invert: false,
  matrix: false, // Initially off
  setTime: false,
  time: 0,
  fit: true,  // Ensure fit is part of the context
}

export function ASCII({ children }) {
  const [charactersTexture, setCharactersTexture] = useState(null)
  const [canvas, setCanvas] = useState()
  const [state, setState] = useState(DEFAULT)

  function set(newSettings) {
    setState((prevState) => ({ ...prevState, ...newSettings }))
    if (newSettings.charactersTexture) setCharactersTexture(newSettings.charactersTexture)
    if (newSettings.canvas) setCanvas(newSettings.canvas)
    console.log('Settings updated:', newSettings)
  }

  console.log('Current matrix state in ASCII:', state.matrix)

  return (
    <AsciiContext.Provider
      value={{
        ...state,
        charactersTexture,
        canvas,
        set,
      }}
    >
      <Inner />
    </AsciiContext.Provider>
  )
}
