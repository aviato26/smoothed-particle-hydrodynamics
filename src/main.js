
import * as THREE from 'three';
import css from './css/style.css';

export default class Main
{
  constructor()
  {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this.renderer.domElement );

    this.geometry;
    this.material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    //this.cube = new THREE.Mesh( this.geometry, this.material );
    this.mesh;

    // variables for sph
    this.numOfParticles = 100;
    this.velocitys = [];
    this.forces = [];
    this.position = [];
    this.viscosity = [];
    this.count = 0;

    // kernel radius
    this.h = 1.4;
    // this is the kernel radius squared for optimization
    this.hsq = this.h * this.h;
    this.mass = 0.1;
    this.visc = 1;
    this.poly6 = 4 / (Math.PI * (this.h ** 8 ));
    this.spiky_grad = -10 / (Math.PI * (this.h ** 5));
    this.visc_lap = 40 / (Math.PI * (this.h ** 5));

    // const for equation of state
    this.gasConst = 2000;

    // rest density
    this.restDens = 35;

    this.dt = 0.0007;
    //this.gravity = 0.9;
    this.gravity = new THREE.Vector4(0, -9.81, 0, 1);

    //create particles
    for(let i = 0; i <= this.numOfParticles; i++){

      this.velocitys.push(new THREE.Vector3(0));
      this.forces.push(new THREE.Vector3(0));

      //this.viscositys.push(new THREE.Vector3(0));      

      this.geometry = new THREE.SphereGeometry();
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.position.x = (i / 2) * Math.random() * 2;
      this.mesh.position.y = (i / 2) * Math.random() * 2;      
      
      this.position.push(this.mesh.position);

      this.position[i].rho = 0;
      this.position[i].p = 0;

      this.scene.add(this.mesh);
    }

    this.camera.position.z = 100;

    this.animate = this.animate.bind(this);
    this.computeDensityPressure();
    this.computeForces();
    this.integrate();
    this.update(this.scene.children)
    this.animate();
  }

  computeDensityPressure(){
    let i;
    let j;
    let neighborParticle = new THREE.Vector3(0);
    let r;
    
    for(i = 0; i < this.position.length; i++){
      for(j = 0; j < this.position.length; j++){
        // looping through all the particles to get there distances from one another
        neighborParticle.subVectors(this.position[j], this.position[i]);

        //r = new THREE.Vector3().dot(neighborParticle);
        //r = new THREE.Vector3().subVectors(this.position[j], this.position[i]).dot(neighborParticle)

        r = (neighborParticle.x * neighborParticle.x) + (neighborParticle.y * neighborParticle.y) + (neighborParticle.z * neighborParticle.z);

        if(r < this.hsq){
          //this.position[i].rho += this.mass * this.poly6 * (this.hsq - neighborParticle.x ** 3);
          this.position[i].rho += this.mass * (315 / (64 * Math.PI * (this.h ** 9) * ((this.hsq - r)**3)))
        }
      }
      //console.log(this.position[i].rho)
      this.position[i].p = this.gasConst * (this.position[i].rho - this.restDens);
      //console.log(this.position[i])
    }
    //console.log(this.count)

  }

  computeForces(){
    let i;
    let j;
    let vel = new THREE.Vector3();
    let rp2;
    let r;
    let rpn = new THREE.Vector3();
    let neighborParticle = new THREE.Vector3(0);

    let fpress;
    let fvisc;
    let fgrav;
    let gravDamp = 2000;

    for(i = 0; i < this.position.length; i++){

      fpress = new THREE.Vector3(0);
      fvisc = new THREE.Vector3(0);
      fgrav = new THREE.Vector3(0, -9.81, 0);


      for(j = 0; j < this.position.length; j++){
        neighborParticle.subVectors(this.position[j], this.position[i]);
        //r = rd.dot(neighborParticle);
        //r = new THREE.Vector3().subVectors(this.position[j], this.position[i]).dot(neighborParticle)
        rp2 = (neighborParticle.x * neighborParticle.x) + (neighborParticle.y * neighborParticle.y) + (neighborParticle.z * neighborParticle.z);

        if(rp2 < this.hsq){
          r = neighborParticle.length();
          rpn = neighborParticle.normalize();

          // compute pressure force contribution
          //fpress.addScalar(-r * this.mass * (this.position[i].p + this.position[j].p) / (2 * this.position[j].rho) * this.spiky_grad * ((this.h - r) ** 3) );
          //fpress.add(rpn.negate().multiplyScalar(this.mass * (this.position[j].p + this.position[i].p) / (2 * this.position[j].rho) * (-45 / (Math.PI * (this.h ** 6))) * ((this.h - r) ** 2) )); //* this.mass * (this.position[i].p + this.position[j].p) / (2 * this.position[j].rho) * this.spiky_grad * ((this.h - r) ** 3) );          
          fpress.x += -rpn.negate().x * this.mass * (this.position[i].p + this.position[j].p) / (2 * this.position[j].rho) * this.spiky_grad * Math.pow(this.h - r , 3);
          //fpress = rpn.negate().multiplyScalar(this.mass * (this.position[j].p + this.position[i].p) / (2 * this.position[j].rho) * (-45 / (Math.PI * (this.h ** 6))) * ((this.h - r) ** 2) ); //* this.mass * (this.position[i].p + this.position[j].p) / (2 * this.position[j].rho) * this.spiky_grad * ((this.h - r) ** 3) );                    
          fvisc.add(vel.subVectors(this.velocitys[j], this.velocitys[i]).multiplyScalar(this.visc * this.mass).divideScalar(this.position[j].rho).multiplyScalar(45 / (Math.PI * (this.h ** 6) * (this.h - r))));
        }

        //fgrav.y = this.gravity * this.position[i].rho// * 0.9;                            

        //fgrav.y -= 0.1;
        //this.forces[i].add(fpress);
        //this.forces[i].add(fpress);                
        //this.forces[i].add(fpress).add(fvisc)//.add(fgrav);
        //this.forces[i] = fpress.add(fvisc);
        //console.log(fpress.add(fvisc))
        //this.forces[i].add(fgrav);
      }
      //this.forces[i] = fpress.add(fvisc).add(fgrav).multiplyScalar(this.position[i].rho).multiplyScalar(gravDamp);
      //this.forces[i] = fpress.add(fvisc).add(fgrav).multiplyScalar(this.position[i].rho).multiplyScalar(gravDamp);      

        if(this.position[i].y < -40){
          //fgrav.negate();
          fgrav.y = .1;
          //this.gravDamp;
          //this.forces[i] = fpress.add(fvisc).add(fgrav).multiplyScalar(this.position[i].rho).multiplyScalar(gravDamp);                
         }
         else{           
          //this.forces[i] = fpress.add(fvisc).add(fgrav).multiplyScalar(this.position[i].rho).multiplyScalar(gravDamp);      
         }
         this.forces[i] = fpress.add(fvisc).add(fgrav).multiplyScalar(this.position[i].rho)//.multiplyScalar(gravDamp);      
         //console.log(this.position[i].rho, this.position[i].p)         
    }

  }

  integrate(){
    let i;

    for(i = 0; i < this.position.length; i++){
      this.velocitys[i].add(this.forces[i].multiplyScalar(this.dt).divideScalar(this.position[i].rho));
      this.position[i].add(this.velocitys[i].multiplyScalar(this.dt));
      //console.log(this.position[i])
    }

  }

  update(particles){
    this.computeDensityPressure();
    this.computeForces();
    this.integrate();

    particles.map((particle, index) => {
/*
       if(particle.position.y < -30){
         //fgrav.negate();
         this.forces[index].negate();
          //this.gravity = -this.gravity;
          //this.velocitys[index].y -= (this.dt * this.gravity);
          //this.velocitys[index].negate();
          //particle.position.y = -particle.position.y;          
          //this.position[index].y = -this.position[index].y;                        
          //this.gravity = this.gravity;          
        }
        else{
          //this.velocitys[index].y = -this.velocitys[index].y;                            
          //this.gravity = -this.gravity
        }
        //console.log(this.position[index].rho)
        //fgrav.y = -this.gravity * this.position[index].rho * 0.9;                            
        this.forces[index].add(fgrav).multiplyScalar(this.position[index].rho).multiplyScalar(this.gravDamp);
*/
        particle.position.x = this.position[index].x;
        particle.position.y = this.position[index].y;
        //console.log(particle.position)
      })

    //console.log(particles[0].position.x, particles[0].position.y)
  }


  animate(){
    requestAnimationFrame( this.animate );

    this.dt += 0.0007;
    //this.velocitys[0].y -= 0.001;

    this.update(this.scene.children)

    //this.forces[this.count].y -= 0.01
    //console.log(this.scene.children[0].position)

/*
    this.scene.children.map((particle, index) => {
      if(particle.position.y > -10){
        this.velocitys[index].y -= (this.dt * this.gravity);                        
      }
      else{
        this.velocitys[index].y = -this.velocitys[index].y;                            
      }
      this.velocitys[index].multiplyScalar(0.981);

      particle.position.y += this.velocitys[index].y;

    })
*/
    this.renderer.render( this.scene, this.camera );
  };

}

new Main();
