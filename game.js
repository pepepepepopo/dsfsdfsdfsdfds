import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/PointerLockControls.js';

class HorrorMaze {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();
    this.controls = null;
    this.walls = [];
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.prevTime = performance.now();
    this.sanity = 100;
    this.sanityDisplay = document.getElementById('sanity');
    this.isLocked = false;
    this.monster = null;
    this.monsterTexture = null;
    this.ambientAudio = document.getElementById('ambientAudio');
    this.jumpscareAudio = document.getElementById('jumpscareAudio');
    this.gameOverOverlay = document.getElementById('gameOverOverlay');
    this.gameStarted = false;
    this.colorBlocks = [];
    this.collectedColors = {
      red: false,
      blue: false,
      yellow: false
    };
    this.hasRainbowBlock = false;
    this.canThrow = false;
    this.spawnPoint = new THREE.Vector3(2, 1.6, 2);
    this.objectiveDisplay = document.getElementById('objective');
    this.setupMainMenu();
  }

  setupMainMenu() {
    const playButton = document.getElementById('playButton');
    playButton.addEventListener('click', () => {
      document.getElementById('mainMenu').style.display = 'none';
      document.getElementById('game').style.display = 'block';
      document.getElementById('ui').style.display = 'block';
      document.querySelector('.crosshair').style.display = 'block';
      document.getElementById('instructions').style.display = 'block';
      
      if (!this.gameStarted) {
        this.gameStarted = true;
        this.init();
      }
    });
  }

  init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // Add fog for spooky atmosphere
    this.scene.fog = new THREE.FogExp2(0x000000, 0.15);

    // Setup lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    const flashlight = new THREE.PointLight(0xffffff, 1, 10);
    this.camera.add(flashlight);
    this.scene.add(this.camera);

    // Create maze
    this.createMaze();

    // Create color blocks after maze
    this.createColorBlocks();

    // Load monster texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('smiley.png', (texture) => {
      this.monsterTexture = texture;
      this.createMonster();
    });

    // Updated pointer lock handling
    this.controls = new PointerLockControls(this.camera, document.body);

    this.controls.addEventListener('lock', () => {
      this.isLocked = true;
      document.getElementById('instructions').style.display = 'none';
      if (this.ambientAudio) {
        this.ambientAudio.play().catch(error => {
          console.warn('Audio playback failed:', error);
        });
      }
    });

    this.controls.addEventListener('unlock', () => {
      this.isLocked = false;
      if (!this.gameOverOverlay.style.display === 'block') {
        document.getElementById('instructions').style.display = 'block';
      }
      if (this.ambientAudio) {
        this.ambientAudio.pause();
      }
    });

    // Improved click handler with better error handling
    const startGame = async (e) => {
      // Ignore clicks when game is over or menu is showing
      if (this.gameOverOverlay.style.display === 'block' ||
          document.getElementById('mainMenu').style.display === 'block') {
        return;
      }

      try {
        if (!this.isLocked) {
          await this.controls.lock();
        }
      } catch (error) {
        console.warn('Pointer lock failed:', error);
        this.isLocked = false;
      }
    };

    // Use mousedown instead of click for better responsiveness
    document.addEventListener('mousedown', startGame);

    // Click to start with improved error handling
    // Cleanup on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        if (this.ambientAudio) {
          this.ambientAudio.pause();
        }
      } else if (this.isLocked && this.ambientAudio) {
        this.ambientAudio.play().catch(console.warn);
      }
    });

    // Movement controls
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
    document.addEventListener('keyup', (event) => this.onKeyUp(event));

    // Start position
    this.camera.position.set(2, 1.6, 2);

    // Start animation loop
    this.animate();
  }

  createMaze() {
    const mazeSize = 20;
    const wallGeometry = new THREE.BoxGeometry(2, 3, 2);
    const wallMaterial = new THREE.MeshPhongMaterial({
      color: 0x444444,
      roughness: 0.8,
      metalness: 0.2
    });

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(mazeSize * 2, mazeSize * 2);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0x222222,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Ceiling
    const ceiling = floor.clone();
    ceiling.position.y = 3;
    this.scene.add(ceiling);

    // Create boundary walls
    const boundaryWalls = [
      { pos: [-mazeSize, 1.5, 0], scale: [2, 3, mazeSize * 2] },  // Left wall
      { pos: [mazeSize, 1.5, 0], scale: [2, 3, mazeSize * 2] },   // Right wall
      { pos: [0, 1.5, -mazeSize], scale: [mazeSize * 2, 3, 2] },  // Front wall
      { pos: [0, 1.5, mazeSize], scale: [mazeSize * 2, 3, 2] }    // Back wall
    ];

    boundaryWalls.forEach(wall => {
      const boundaryWall = new THREE.Mesh(wallGeometry, wallMaterial);
      boundaryWall.position.set(...wall.pos);
      boundaryWall.scale.set(...wall.scale);
      this.scene.add(boundaryWall);
      this.walls.push(boundaryWall);
    });

    // Create maze walls
    for (let i = 0; i < mazeSize; i++) {
      for (let j = 0; j < mazeSize; j++) {
        if (Math.random() < 0.3) {
          const wall = new THREE.Mesh(wallGeometry, wallMaterial);
          wall.position.set(i * 2 - mazeSize + 2, 1.5, j * 2 - mazeSize + 2);
          this.scene.add(wall);
          this.walls.push(wall);
        }
      }
    }

    // Clear the starting area and monster spawn area
    this.walls = this.walls.filter(wall => {
      const distanceFromStart = wall.position.distanceTo(new THREE.Vector3(2, 1.6, 2));
      const distanceFromMonsterSpawn = wall.position.distanceTo(new THREE.Vector3(-18, 1.5, -18));
      return (distanceFromStart > 3 && distanceFromMonsterSpawn > 3) || 
             wall.scale.x > 2 || wall.scale.z > 2; // Keep boundary walls
    });
  }

  createColorBlocks() {
    const colors = {
      red: 0xff0000,
      blue: 0x0000ff,
      yellow: 0xffff00
    };

    Object.entries(colors).forEach(([colorName, colorValue]) => {
      const blockGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const blockMaterial = new THREE.MeshPhongMaterial({ color: colorValue, emissive: colorValue, emissiveIntensity: 0.5 });
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      
      // Find random valid position
      let validPosition = false;
      while (!validPosition) {
        const x = (Math.random() * 36 - 18);
        const z = (Math.random() * 36 - 18);
        block.position.set(x, 1, z);
        
        // Check if position is clear of walls and other blocks
        validPosition = this.isPositionValid(block.position);
      }

      block.userData.color = colorName;
      this.scene.add(block);
      this.colorBlocks.push(block);
    });

    this.updateObjectiveDisplay();
  }

  isPositionValid(position) {
    // Check distance from spawn
    if (position.distanceTo(this.spawnPoint) < 5) return false;

    // Check distance from monster spawn
    if (position.distanceTo(new THREE.Vector3(-18, 1.5, -18)) < 5) return false;

    // Check distance from walls
    for (const wall of this.walls) {
      if (position.distanceTo(wall.position) < 2) return false;
    }

    // Check distance from other color blocks
    for (const block of this.colorBlocks) {
      if (position.distanceTo(block.position) < 3) return false;
    }

    return true;
  }

  updateObjectiveDisplay() {
    let text = 'Collect: ';
    if (!this.collectedColors.red) text += '🔴 ';
    if (!this.collectedColors.blue) text += '🔵 ';
    if (!this.collectedColors.yellow) text += '🟡 ';
    
    if (Object.values(this.collectedColors).every(v => v)) {
      if (!this.hasRainbowBlock) {
        text = 'Return to spawn to create Rainbow Block!';
        if (this.camera.position.distanceTo(this.spawnPoint) < 3) {
          this.createRainbowBlock();
        }
      } else {
        text = 'Throw Rainbow Block at Smiley! (Click to throw)';
      }
    }
    
    this.objectiveDisplay.textContent = text;
  }

  createMonster() {
    const monsterGeometry = new THREE.PlaneGeometry(2, 2);
    const monsterMaterial = new THREE.MeshBasicMaterial({
      map: this.monsterTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.monster = new THREE.Mesh(monsterGeometry, monsterMaterial);
    this.monster.position.set(-18, 1.5, -18);
    this.scene.add(this.monster);
  }

  updateMonster() {
    if (!this.monster || !this.isLocked || !this.gameStarted) return;
    
    // Make monster always face the camera
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.monster.position);
    this.monster.lookAt(this.camera.position);

    // Calculate monster speed based on sanity
    const baseSpeed = 0.01; // Speed at 100% sanity
    const maxSpeed = 0.1;   // Speed at 0% sanity
    const speedMultiplier = 1 + ((100 - this.sanity) / 100) * 9; // Ranges from 1 to 10
    const monsterSpeed = baseSpeed * speedMultiplier;

    // Move monster towards player
    direction.normalize();
    this.monster.position.add(direction.multiplyScalar(monsterSpeed));

    // Check if monster caught player
    const distanceToPlayer = this.monster.position.distanceTo(this.camera.position);
    if (distanceToPlayer < 1.5) {
      try {
        // Game over - monster caught player
        this.sanity = 0;
        this.sanityDisplay.textContent = this.sanity;
        this.controls.unlock();
        if (this.ambientAudio) {
          this.ambientAudio.pause();
        }
        
        // Show static overlay and shaking smiley
        this.gameOverOverlay.style.display = 'block';
        
        // Play jumpscare sound
        if (this.jumpscareAudio) {
          this.jumpscareAudio.currentTime = 0;
          this.jumpscareAudio.play().catch(console.warn);
        }
        
        document.getElementById('instructions').innerHTML = '<h1>Game Over!</h1><p>The smiley got you!</p><p>Click to try again</p>';
        document.getElementById('instructions').style.display = 'block';
        
        // Add click handler to restart
        const restartHandler = () => {
          this.gameOverOverlay.style.display = 'none';
          this.monster.position.set(-18, 1.5, -18);
          this.camera.position.set(2, 1.6, 2);
          this.sanity = 100;
          this.sanityDisplay.textContent = this.sanity;
          this.scene.fog.density = 0.15;
          document.removeEventListener('click', restartHandler);
        };
        document.addEventListener('click', restartHandler);
      } catch (error) {
        console.warn('Error during game over sequence:', error);
      }
    }

    // Decrease sanity faster when monster is closer
    if (distanceToPlayer < 5) {
      this.sanity = Math.max(0, this.sanity - 0.1);
      this.sanityDisplay.textContent = Math.round(this.sanity);
    }
  }

  onKeyDown(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
    }
  }

  updateMovement() {
    const time = performance.now();
    const delta = (time - this.prevTime) / 1000;

    this.velocity.x -= this.velocity.x * 5.0 * delta;
    this.velocity.z -= this.velocity.z * 5.0 * delta;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const speed = 7.0;
    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * speed * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * speed * delta;
    }

    const maxVelocity = 7.0;
    this.velocity.x = Math.max(Math.min(this.velocity.x, maxVelocity), -maxVelocity);
    this.velocity.z = Math.max(Math.min(this.velocity.z, maxVelocity), -maxVelocity);

    const oldPosition = this.camera.position.clone();
    this.controls.moveRight(-this.velocity.x * delta);
    this.controls.moveForward(-this.velocity.z * delta);

    // Check boundaries and collisions
    const mazeSize = 20;
    const boundaryLimit = mazeSize - 1;
    const playerRadius = 0.5;

    // Check if player is trying to go out of bounds
    if (Math.abs(this.camera.position.x) > boundaryLimit || 
        Math.abs(this.camera.position.z) > boundaryLimit) {
      this.camera.position.copy(oldPosition);
    }

    // Check wall collisions
    for (const wall of this.walls) {
      const distance = this.camera.position.distanceTo(wall.position);
      const collisionRadius = playerRadius + (wall.scale.x > 2 || wall.scale.z > 2 ? 1.5 : 1);
      if (distance < collisionRadius) {
        this.camera.position.copy(oldPosition);
        break;
      }
    }

    if (Math.random() < 0.01) {
      this.sanity = Math.max(0, this.sanity - 1);
      this.sanityDisplay.textContent = this.sanity;
      
      if (this.sanity < 30) {
        this.scene.fog.density = 0.15 + (30 - this.sanity) * 0.01;
      }
    }

    this.colorBlocks.forEach((block, index) => {
      if (block && this.camera.position.distanceTo(block.position) < 1) {
        this.collectedColors[block.userData.color] = true;
        this.scene.remove(block);
        this.colorBlocks[index] = null;
        this.updateObjectiveDisplay();
      }
    });

    this.colorBlocks = this.colorBlocks.filter(block => block !== null);

    this.prevTime = time;
  }

  createRainbowBlock() {
    if (this.hasRainbowBlock) return;
    
    const rainbowGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const rainbowMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
    });

    // Create rainbow colors for vertices
    const colors = [];
    const rainbow = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
    for (let i = 0; i < rainbowGeometry.attributes.position.count; i++) {
      const color = new THREE.Color(rainbow[i % rainbow.length]);
      colors.push(color.r, color.g, color.b);
    }
    
    rainbowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    this.rainbowBlock = new THREE.Mesh(rainbowGeometry, rainbowMaterial);
    this.rainbowBlock.position.copy(this.camera.position);
    this.scene.add(this.rainbowBlock);
    
    this.hasRainbowBlock = true;
    this.canThrow = true;
    
    // Add click listener for throwing
    document.addEventListener('click', () => this.throwRainbowBlock());
  }

  throwRainbowBlock() {
    if (!this.canThrow || !this.hasRainbowBlock) return;
    
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    
    const throwSpeed = 0.5;
    const throwAnimation = () => {
      this.rainbowBlock.position.add(direction.multiplyScalar(throwSpeed));
      
      // Check if hit monster
      if (this.rainbowBlock.position.distanceTo(this.monster.position) < 1) {
        this.winGame();
        return;
      }
      
      // Continue animation if not hit
      if (this.hasRainbowBlock) {
        requestAnimationFrame(throwAnimation);
      }
    };
    
    throwAnimation();
  }

  winGame() {
    // Ensure clean state when winning
    this.isLocked = false;
    this.hasRainbowBlock = false;
    this.scene.remove(this.rainbowBlock);
    this.scene.remove(this.monster);
    
    this.controls.unlock();
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
    
    document.getElementById('instructions').innerHTML = '<h1>You Won!</h1><p>You defeated Smiley!</p><p>Click to play again</p>';
    document.getElementById('instructions').style.display = 'block';
    
    const resetHandler = () => {
      if (!this.isLocked) {
        this.resetGame();
        document.removeEventListener('mousedown', resetHandler);
      }
    };
    document.addEventListener('mousedown', resetHandler);
  }

  resetGame() {
    // Ensure clean state before reset
    this.isLocked = false;
    if (this.controls) {
      this.controls.unlock();
    }
    
    // Reset collection status
    this.collectedColors = {
      red: false,
      blue: false,
      yellow: false
    };
    this.hasRainbowBlock = false;
    this.canThrow = false;
    
    // Remove old color blocks
    this.colorBlocks.forEach(block => this.scene.remove(block));
    this.colorBlocks = [];
    
    // Create new color blocks
    this.createColorBlocks();
    
    // Reset monster
    this.createMonster();
    
    // Reset player position and sanity
    this.camera.position.copy(this.spawnPoint);
    this.sanity = 100;
    this.sanityDisplay.textContent = this.sanity;
    
    this.updateObjectiveDisplay();
    
    // Reset UI elements
    this.gameOverOverlay.style.display = 'none';
    document.getElementById('instructions').style.display = 'block';
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.isLocked) {
      this.updateMovement();
      this.updateMonster();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('resize', () => {
  if (window.game && window.game.gameStarted) {
    window.game.camera.aspect = window.innerWidth / window.innerHeight;
    window.game.camera.updateProjectionMatrix();
    window.game.renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

window.game = new HorrorMaze();
