import * as THREE from 'three'
import { ARObject } from './ARObject'

export class Logo extends ARObject {
    private mainCube: THREE.Mesh | null = null
    private scannerPlaneH: THREE.Mesh | null = null
    private scannerPlaneV: THREE.Mesh | null = null
    private scannerGlow: THREE.PointLight | null = null

    constructor(width = 1) {
        const container = new THREE.Object3D()
        super(container)

        const system = new THREE.Group()
        this.mainObject.add(system)

        const loader = new THREE.TextureLoader()

        const createMat = (url: string) => {
            const texture = loader.load(url)
            texture.colorSpace = THREE.SRGBColorSpace
            return new THREE.MeshStandardMaterial({
                map: texture,
                emissive: new THREE.Color(0xffffff),
                emissiveMap: texture,
                emissiveIntensity: 2.5,
                metalness: 1.0,
                roughness: 0.2,
                transparent: true,
                opacity: .95
            })
        }

        // Main cube
        const geometry = new THREE.BoxGeometry(width, width, width)
        const materials = [
            createMat("logo-l-t.png"),
            createMat("logo-l-t.png"),
            createMat("logo-t-t.png"),
            createMat("logo-t-t.png"),
            createMat("logo-r-t.png"),
            createMat("logo-r-t.png"),
        ]
        const mesh = new THREE.Mesh(geometry, materials)
        // Initial tilted orientation
        mesh.rotation.set(-(Math.PI / 2), Math.PI / 4, 0)
        system.add(mesh)
        this.mainCube = mesh

        // --- SCANNER ANIMATION ADDITION ---
        
        const scannerGeo = new THREE.PlaneGeometry(width * 1.5, width * 1.5)
        const scannerMatBase = {
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.8, // Increased base opacity
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false, // Prevents the planes from clipping weirdly
        }

        // Horizontal Scanner Plane (Y-axis oscillation)
        this.scannerPlaneH = new THREE.Mesh(scannerGeo, new THREE.MeshBasicMaterial({
            ...scannerMatBase,
            color: 0x406AAE
        }))
        this.scannerPlaneH.rotation.x = Math.PI / 2
        system.add(this.scannerPlaneH)

        // Vertical Scanner Plane (Z-axis oscillation)
        this.scannerPlaneV = new THREE.Mesh(scannerGeo, new THREE.MeshBasicMaterial({
            ...scannerMatBase,
            color: 0x406AAE, // Your requested color
        }))
        // Apply requested tilt
        this.scannerPlaneV.rotation.set(-(Math.PI / 27), 0, 0)
        system.add(this.scannerPlaneV)

        // Enhanced point light to follow the scanners
        this.scannerGlow = new THREE.PointLight(0x3b82f6, 50, width * 10)
        system.add(this.scannerGlow)
    }

    update(delta: number) {
        const time = performance.now() / 1000
        const period = 10 // 10s per dramatic rotation loop
        
        // 1. Handle the Cube Rotation Logic
        const wave = Math.sin((2 * Math.PI * time) / period)
        let t = (wave + 1) / 2
        t = Math.pow(t, 3) // dramatic spike

        const minSpeed = 2.0
        const maxSpeed = 2.0
        const speed = minSpeed + (maxSpeed - minSpeed) * t

        if (this.mainCube) {
            this.mainCube.rotation.y += -delta * speed
        }

        // 2. Handle the Scanner Oscillations
        const scanHeight = 0.3
        
        // Horizontal Plane (Y-axis)
        if (this.scannerPlaneH) {
            const scanPeriodH = 4 
            const yOffset = Math.sin((2 * Math.PI * time) / scanPeriodH) * scanHeight
            this.scannerPlaneH.position.y = yOffset
            
            const mat = this.scannerPlaneH.material as THREE.MeshBasicMaterial
            // Higher minimum opacity for visibility
            mat.opacity = 0.5
            // mat.visible = false
        }

        // Vertical Plane (Z-axis)
        if (this.scannerPlaneV) {
            const scanPeriodV = 4
            const zOffset = Math.sin((2 * Math.PI * time) / scanPeriodV) * scanHeight
            this.scannerPlaneV.position.z = zOffset
            
            if (this.scannerGlow) {
                // Point light follows the vertical plane movement
                this.scannerGlow.position.z = zOffset
            }

            const mat = this.scannerPlaneV.material as THREE.MeshBasicMaterial
            mat.opacity = 0.8
        }
    }
}