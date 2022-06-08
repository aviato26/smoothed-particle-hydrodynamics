
import * as THREE from 'three';

class ParticleCollider{
    constructor(){
        this.position = new THREE.Vector3(0);
        this.up = new THREE.Vector3(0);
        this.right = new THREE.Vector3(0);
        this.scale = new THREE.Vector3(0);
    }
}

export default ParticleCollider;