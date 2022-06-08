
import * as THREE from 'three';

class Particle{
    constructor(radius = 1){
        this.geometry = new THREE.SphereGeometry(radius);
        this.material = new THREE.MeshBasicMaterial({ color:0x0000ff })
        this.mesh = new THREE.Mesh(this.geometry, this.material);

        this.position = this.mesh.position;
        this.velocity = new THREE.Vector3(0);
        this.combinedForce = new THREE.Vector3(0);
        this.density = 0;
        this.pressure = 0;
    }
}

export default Particle;