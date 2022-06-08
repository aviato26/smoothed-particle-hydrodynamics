
// this implementation was from https://lucasschuermann.com/writing/implementing-sph-in-2d

import * as THREE from 'three';
import css from './css/style.css';
import Particle from './Particle.js';

export default class Main
{
  constructor()
  {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this.renderer.domElement );

    this.boxSize = 60;
    this.geometry = new THREE.BoxGeometry(this.boxSize, this.boxSize, this.boxSize);
    this.material = new THREE.MeshBasicMaterial( {
      color: 0xffffff,
      side: THREE.DoubleSide,
      wireframe: true
    } );

    this.container = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.container)

    this.numOfParticles = 100;
    this.particles = [];

    // creating particle for user interation against other particles
    this.usersMouse = new Particle();
    this.particles.push(this.usersMouse);
    //console.log(this.usersMouse)
    //this.scene.add(this.usersMouse.mesh);

    document.addEventListener('mousedown', () => {
      this.boxSize -= 1;
    })

    
    // first method parameters
    this.radius = 2;
    this.mass = 2.5;
    this.gravityConstant = -10
    this.restDensity = 300;
    this.viscosity = 200;
    this.drag = 1;

    this.smoothingRadius = 12;
    this.smoothingRadiusSquared = this.smoothingRadius * this.smoothingRadius;
    this.gravity = new THREE.Vector3(0, -10, 0);
    this.gravityMultiplicator = 2000;
    this.gas = 2000;
    this.deltaTime = 0.0007;
    this.damping = -0.5;
    
    this.poly6 = 4 / (Math.PI * Math.pow(this.smoothingRadius, 8));
    this.spiky_grad = -10 / (Math.PI * Math.pow(this.smoothingRadius, 5));
    this.visc_lap = 40 / (Math.PI * Math.pow(this.smoothingRadius, 5));


    let particle;

    //create particles
    for(let i = 0; i <= this.numOfParticles; i++){
      particle = new Particle(this.radius);
      
      particle.position.x = Math.cos(i) * Math.PI;
      particle.position.y = Math.sin(i) * Math.PI;      
      particle.position.z = Math.cos(i) + Math.sin(i * 0.9) * Math.PI;            

      this.particles.push(particle);

      this.scene.add(particle.mesh);

    }

    this.camera.position.z = this.boxSize + 50;

    this.animate = this.animate.bind(this);

    this.animate();
  }

computeDensityPressure(){
  let i;
  let j;
  let px;
  let py;
  let pz;
  let norm = new THREE.Vector3();

  let r2;
  let r2Sqrd;

  for(i = 0; i < this.particles.length; i++){
    // setting density to zero
    // must reset particle density to zero to get correct current density calculation
    this.particles[i].density = 0;

    for(j = 0; j < this.particles.length; j++){

      px = this.particles[j].position.x - this.particles[i].position.x;
      py = this.particles[j].position.y - this.particles[i].position.y;
      pz = this.particles[j].position.z - this.particles[i].position.z;
      
      r2 = (px * px) + (py * py) + (pz * pz);
      r2Sqrd = Math.sqrt(r2);

      if(r2 < this.smoothingRadiusSquared){
        this.particles[i].density += this.mass * this.poly6 * Math.pow((this.smoothingRadiusSquared) - r2, 3);
      }
    }
    this.particles[i].pressure = this.gas * (this.particles[i].density - this.restDensity);
  }

}

computeForces(){
  let i;
  let j;

  let px;
  let py;
  let pz;

  let r2;
  let r;

  let norm = new THREE.Vector3();

  let fpress;
  let fvisc;
  let fgrav = new THREE.Vector3();

  for(i = 0; i < this.particles.length; i++){

    fpress = new THREE.Vector3();
    fvisc = new THREE.Vector3();

    for(j = 0; j < this.particles.length; j++){
      norm.subVectors(this.particles[j].position, this.particles[i].position).normalize();
      px = this.particles[j].position.x - this.particles[i].position.x;
      py = this.particles[j].position.y - this.particles[i].position.y;
      pz = this.particles[j].position.z - this.particles[i].position.z;
      
      r2 = ((px * px) + (py * py) + (pz * pz));
      r = Math.sqrt(r2);

      if(r < this.smoothingRadius){
        fpress.x += -norm.x * this.mass * (this.particles[i].pressure + this.particles[j].pressure) / (2 * this.particles[j].density) * this.spiky_grad * Math.pow(this.smoothingRadius - r, 3);
        fpress.y += -norm.y * this.mass * (this.particles[i].pressure + this.particles[j].pressure) / (2 * this.particles[j].density) * this.spiky_grad * Math.pow(this.smoothingRadius - r, 3);        
        fpress.z += -norm.z * this.mass * (this.particles[i].pressure + this.particles[j].pressure) / (2 * this.particles[j].density) * this.spiky_grad * Math.pow(this.smoothingRadius - r, 3);        

        fvisc.x += this.viscosity * this.mass * (this.particles[j].velocity.x - this.particles[i].velocity.x) / this.particles[j].density * this.visc_lap * (this.smoothingRadius - r);
        fvisc.y += this.viscosity * this.mass * (this.particles[j].velocity.y - this.particles[i].velocity.y) / this.particles[j].density * this.visc_lap * (this.smoothingRadius - r);
        fvisc.z += this.viscosity * this.mass * (this.particles[j].velocity.z - this.particles[i].velocity.z) / this.particles[j].density * this.visc_lap * (this.smoothingRadius - r);                
      }

    }

    fgrav.y += this.gravityConstant * this.mass;

    this.particles[i].combinedForce.x = fpress.x + fvisc.x;
    this.particles[i].combinedForce.y = fpress.y + fvisc.y + fgrav.y;
    this.particles[i].combinedForce.z = fpress.z + fvisc.z;

  }

}

integrate(){
  let i;
  const damp = 0.5;
  const constrain = this.boxSize / 2.1;
  const restingLength = Math.abs(constrain);

  for(i = 0; i < this.particles.length; i++){

    if(this.particles[i].position.y < -constrain){
      this.particles[i].velocity.y = -this.particles[i].velocity.y;
      this.particles[i].velocity.y *= damp;

    this.particles[i].position.y = -restingLength;
    }
    else if(this.particles[i].position.y > constrain){
      this.particles[i].velocity.y = -this.particles[i].velocity.y;
      this.particles[i].velocity.y *= damp;
      
      this.particles[i].position.y = restingLength;
    }
    else if(this.particles[i].position.x < -constrain){
      this.particles[i].velocity.x = -this.particles[i].velocity.x;
      this.particles[i].velocity.x *= damp;

      this.particles[i].position.x = -restingLength;
    }
    else if(this.particles[i].position.x > constrain){
      this.particles[i].velocity.x = -this.particles[i].velocity.x;
      this.particles[i].velocity.x *= damp;

      this.particles[i].position.x = restingLength;
    }
    else if(this.particles[i].position.z < -constrain){
      this.particles[i].velocity.z = -this.particles[i].velocity.z;
      this.particles[i].velocity.z *= damp;      
      
      this.particles[i].position.z = -restingLength;
    }
    else if(this.particles[i].position.z > constrain){
      this.particles[i].velocity.z = -this.particles[i].velocity.z;
      this.particles[i].velocity.z *= damp;

      this.particles[i].position.z = restingLength;
    }
    else {
      

      this.particles[i].velocity.x += this.deltaTime * this.particles[i].combinedForce.x / this.particles[i].density;
      this.particles[i].velocity.y += this.deltaTime * this.particles[i].combinedForce.y / this.particles[i].density;
      this.particles[i].velocity.z += this.deltaTime * this.particles[i].combinedForce.z / this.particles[i].density;        
  
      this.particles[i].position.x += this.deltaTime * this.particles[i].velocity.x;
      this.particles[i].position.y += this.deltaTime * this.particles[i].velocity.y;
      this.particles[i].position.z += this.deltaTime * this.particles[i].velocity.z;        


   }
   
  }
}


  animate(){
    requestAnimationFrame( this.animate );

    this.computeDensityPressure();
    this.computeForces();
    this.integrate();

    this.renderer.render( this.scene, this.camera );
  };

}

new Main();
