import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const Scene3D = ({ pointData, onClose }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffd700, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Criar ambiente baseado no tipo
    const createEnvironment = (type) => {
      const group = new THREE.Group();

      switch(type) {
        case 'cidade':
          // Criar várias casas
          for (let i = 0; i < 8; i++) {
            const houseGeometry = new THREE.BoxGeometry(1, 1.5, 1);
            const houseMaterial = new THREE.MeshStandardMaterial({ 
              color: 0x8B4513,
              roughness: 0.8 
            });
            const house = new THREE.Mesh(houseGeometry, houseMaterial);
            
            // Telhado
            const roofGeometry = new THREE.ConeGeometry(0.7, 0.5, 4);
            const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = 1;
            roof.rotation.y = Math.PI / 4;
            
            const building = new THREE.Group();
            building.add(house);
            building.add(roof);
            
            const angle = (i / 8) * Math.PI * 2;
            building.position.x = Math.cos(angle) * 3;
            building.position.z = Math.sin(angle) * 3;
            building.position.y = 0.75;
            
            group.add(building);
          }
          break;

        case 'dungeon':
          // Corredor de dungeon
          const floorGeometry = new THREE.PlaneGeometry(20, 5);
          const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x404040,
            roughness: 0.9 
          });
          const floor = new THREE.Mesh(floorGeometry, floorMaterial);
          floor.rotation.x = -Math.PI / 2;
          group.add(floor);

          // Paredes
          const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a,
            roughness: 0.95 
          });
          
          const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(20, 3, 0.2),
            wallMaterial
          );
          leftWall.position.z = -2.5;
          leftWall.position.y = 1.5;
          
          const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(20, 3, 0.2),
            wallMaterial
          );
          rightWall.position.z = 2.5;
          rightWall.position.y = 1.5;
          
          group.add(leftWall);
          group.add(rightWall);

          // Tochas
          for (let i = 0; i < 5; i++) {
            const torchLight = new THREE.PointLight(0xff6600, 1, 5);
            torchLight.position.set(-8 + i * 4, 2, -2.3);
            group.add(torchLight);
          }
          break;

        case 'taverna':
          // Mesa central
          const tableGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32);
          const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x5d3a1a });
          const table = new THREE.Mesh(tableGeometry, tableMaterial);
          table.position.y = 0.8;
          group.add(table);

          // Cadeiras ao redor
          for (let i = 0; i < 6; i++) {
            const chairGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.4);
            const chair = new THREE.Mesh(chairGeometry, tableMaterial);
            const angle = (i / 6) * Math.PI * 2;
            chair.position.x = Math.cos(angle) * 2.2;
            chair.position.z = Math.sin(angle) * 2.2;
            chair.position.y = 0.3;
            group.add(chair);
          }
          break;

        case 'floresta':
          // Árvores
          for (let i = 0; i < 12; i++) {
            const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2511 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            
            const leavesGeometry = new THREE.SphereGeometry(0.8, 8, 8);
            const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5016 });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 1.5;
            
            const tree = new THREE.Group();
            tree.add(trunk);
            tree.add(leaves);
            
            tree.position.x = (Math.random() - 0.5) * 10;
            tree.position.z = (Math.random() - 0.5) * 10;
            tree.position.y = 1;
            
            group.add(tree);
          }
          break;

        default:
          // Ambiente genérico
          const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
          const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x7b68ee });
          const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
          cube.position.y = 0.5;
          group.add(cube);
      }

      return group;
    };

    const environment = createEnvironment(pointData.type);
    scene.add(environment);

    // Chão base
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a5f3a,
      roughness: 0.9 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);

    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);

    sceneRef.current = { scene, camera, renderer, environment };

    // Animação
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      environment.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [pointData.type]);

  return (
    <div className="scene-overlay">
      <div className="scene-container">
        <div className="scene-header">
          <div>
            <h2>{pointData.name}</h2>
            <p>{pointData.description}</p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={24} />
          </button>
        </div>
        <div ref={containerRef} className="scene-canvas" />
        <div className="scene-footer">
          <span className="scene-type">{pointData.type}</span>
        </div>
      </div>
    </div>
  );
};

// Geometria real dos dados (extraída do modelo 3D enviado) e texturas das 'bolsas' de skins

export default Scene3D;
