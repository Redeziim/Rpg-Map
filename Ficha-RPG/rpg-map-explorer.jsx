import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Camera, Map, Users, Eye, Edit3, Plus, X, Upload, Grid, ChevronRight, Castle, Sword, Scroll, Skull, ScrollText, Dices, RotateCw, Image as ImageIcon, Type, GripVertical, Trash2, ListPlus, Settings2, ShoppingBag, Check, Hash, ArrowUp, ArrowDown, Palette, Minus, Heart, Calculator, ListChecks } from 'lucide-react';

// Componente de visualização 3D
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
const DICE_GEOMETRY = {"4":{"positions":[-0.9553,0.1998,-0.218,0.2613,-0.8716,-0.4148,0.1107,-0.0566,0.9922,-0.9553,0.1998,-0.218,0.1107,-0.0566,0.9922,0.5833,0.7284,-0.3595,-0.9553,0.1998,-0.218,0.5833,0.7284,-0.3595,0.2613,-0.8716,-0.4148,0.2613,-0.8716,-0.4148,0.5833,0.7284,-0.3595,0.1107,-0.0566,0.9922],"normals":[-0.5833,-0.7284,0.3595,-0.5833,-0.7284,0.3595,-0.5833,-0.7284,0.3595,-0.2613,0.8716,0.4148,-0.2613,0.8716,0.4148,-0.2613,0.8716,0.4148,-0.1107,0.0566,-0.9922,-0.1107,0.0566,-0.9922,-0.1107,0.0566,-0.9922,0.9553,-0.1998,0.218,0.9553,-0.1998,0.218,0.9553,-0.1998,0.218],"uvs":[0.0007,0.1237,0.1623,0.0304,0.1623,0.217,0.3253,0.0007,0.3253,0.1873,0.1637,0.094,0.0007,0.3354,0.1623,0.2421,0.1623,0.4287,0.3253,0.3753,0.1637,0.282,0.3253,0.1887],"indices":[0,1,2,3,4,5,6,7,8,9,10,11],"vcount":12,"tricount":4},"6":{"positions":[-0.5773,-0.5774,-0.5774,-0.5773,-0.5774,0.5774,-0.5773,0.5774,0.5774,-0.5773,0.5774,-0.5774,-0.5773,0.5774,-0.5774,-0.5773,0.5774,0.5774,0.5774,0.5774,0.5774,0.5774,0.5774,-0.5774,0.5774,0.5774,-0.5774,0.5774,0.5774,0.5774,0.5774,-0.5774,0.5774,0.5774,-0.5774,-0.5774,0.5774,-0.5774,-0.5774,0.5774,-0.5774,0.5774,-0.5773,-0.5774,0.5774,-0.5773,-0.5774,-0.5774,-0.5773,0.5774,-0.5774,0.5774,0.5774,-0.5774,0.5774,-0.5774,-0.5774,-0.5773,-0.5774,-0.5774,0.5774,0.5774,0.5774,-0.5773,0.5774,0.5774,-0.5773,-0.5774,0.5774,0.5774,-0.5774,0.5774],"normals":[-1.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,-1.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,1.0,0.0,0.0,1.0],"uvs":[0.7334,0.0007,0.7334,0.1448,0.5892,0.1448,0.5892,0.0007,0.3104,0.4462,0.4545,0.4462,0.4545,0.5903,0.3104,0.5903,0.1448,0.5235,0.1448,0.6676,0.0007,0.6676,0.0007,0.5235,0.2903,0.5235,0.2903,0.6676,0.1462,0.6676,0.1462,0.5235,0.5904,0.1462,0.7345,0.1462,0.7345,0.2903,0.5904,0.2903,0.4686,0.5988,0.4686,0.4547,0.6128,0.4547,0.6128,0.5988],"indices":[0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,20,21,22,20,22,23],"vcount":24,"tricount":12},"8":{"positions":[0.7084,0.0,0.7058,0.7058,0.0,-0.7084,-0.0,1.0,0.0,0.7084,0.0,0.7058,-0.0,1.0,0.0,-0.7058,-0.0,0.7084,0.7084,0.0,0.7058,-0.7058,-0.0,0.7084,-0.0,-1.0,-0.0,0.7084,0.0,0.7058,-0.0,-1.0,-0.0,0.7058,0.0,-0.7084,-0.7084,-0.0,-0.7058,-0.0,1.0,0.0,0.7058,0.0,-0.7084,-0.7084,-0.0,-0.7058,-0.7058,-0.0,0.7084,-0.0,1.0,0.0,-0.7084,-0.0,-0.7058,-0.0,-1.0,-0.0,-0.7058,-0.0,0.7084,-0.7084,-0.0,-0.7058,0.7058,0.0,-0.7084,-0.0,-1.0,-0.0],"normals":[0.8165,0.5774,-0.0015,0.8165,0.5774,-0.0015,0.8165,0.5774,-0.0015,0.0015,0.5774,0.8165,0.0015,0.5774,0.8165,0.0015,0.5774,0.8165,0.0015,-0.5774,0.8165,0.0015,-0.5774,0.8165,0.0015,-0.5774,0.8165,0.8165,-0.5774,-0.0015,0.8165,-0.5774,-0.0015,0.8165,-0.5774,-0.0015,-0.0015,0.5774,-0.8165,-0.0015,0.5774,-0.8165,-0.0015,0.5774,-0.8165,-0.8165,0.5774,0.0015,-0.8165,0.5774,0.0015,-0.8165,0.5774,0.0015,-0.8165,-0.5774,0.0015,-0.8165,-0.5774,0.0015,-0.8165,-0.5774,0.0015,-0.0015,-0.5774,-0.8165,-0.0015,-0.5774,-0.8165,-0.0015,-0.5774,-0.8165],"uvs":[0.4589,0.1462,0.4589,0.0007,0.5849,0.0734,0.4658,0.2944,0.5918,0.3671,0.4658,0.4399,0.4593,0.4399,0.3333,0.3671,0.4593,0.2944,0.0007,0.5221,0.0007,0.3767,0.1267,0.4494,0.3267,0.2203,0.4526,0.1475,0.4526,0.293,0.3302,0.4106,0.2042,0.4834,0.2042,0.3379,0.4594,0.2203,0.5853,0.1475,0.5853,0.293,0.3267,0.0734,0.4526,0.0007,0.4526,0.1462],"indices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],"vcount":24,"tricount":8},"10":{"positions":[0.153,0.5853,-0.6672,-0.8734,-0.1272,-0.4701,-0.3588,0.7942,0.2272,0.079,0.8826,-0.161,-0.3588,0.7942,0.2272,-0.8734,-0.1272,-0.4701,-0.5022,-0.113,0.739,-0.326,0.4511,0.7081,-0.5022,-0.113,0.739,-0.8734,-0.1272,-0.4701,-0.079,-0.8826,0.161,-0.153,-0.5853,0.6672,-0.079,-0.8826,0.161,-0.8734,-0.1272,-0.4701,0.326,-0.4511,-0.7081,0.3588,-0.7942,-0.2272,0.5022,0.113,-0.739,0.326,-0.4511,-0.7081,-0.8734,-0.1272,-0.4701,0.153,0.5853,-0.6672,0.8734,0.1272,0.4701,-0.326,0.4511,0.7081,-0.5022,-0.113,0.739,-0.153,-0.5853,0.6672,-0.326,0.4511,0.7081,0.8734,0.1272,0.4701,0.079,0.8826,-0.161,-0.3588,0.7942,0.2272,0.079,0.8826,-0.161,0.8734,0.1272,0.4701,0.5022,0.113,-0.739,0.153,0.5853,-0.6672,0.5022,0.113,-0.739,0.8734,0.1272,0.4701,0.3588,-0.7942,-0.2272,0.326,-0.4511,-0.7081,0.3588,-0.7942,-0.2272,0.8734,0.1272,0.4701,-0.153,-0.5853,0.6672,-0.079,-0.8826,0.161],"normals":[-0.5609,0.6754,-0.4788,-0.5609,0.6754,-0.4788,-0.5609,0.6754,-0.4788,-0.5609,0.6754,-0.4788,-0.9128,0.3004,0.2767,-0.9128,0.3004,0.2767,-0.9128,0.3004,0.2767,-0.9128,0.3004,0.2767,-0.7625,-0.6004,0.2412,-0.7625,-0.6004,0.2412,-0.7625,-0.6004,0.2412,-0.7625,-0.6004,0.2412,-0.3176,-0.782,-0.5362,-0.3176,-0.782,-0.5362,-0.3176,-0.782,-0.5362,-0.3176,-0.782,-0.5362,-0.193,0.0065,-0.9812,-0.193,0.0065,-0.9812,-0.193,0.0065,-0.9812,-0.193,0.0065,-0.9812,0.193,-0.0065,0.9812,0.193,-0.0065,0.9812,0.193,-0.0065,0.9812,0.193,-0.0065,0.9812,0.3176,0.782,0.5362,0.3176,0.782,0.5362,0.3176,0.782,0.5362,0.3176,0.782,0.5362,0.7625,0.6004,-0.2412,0.7625,0.6004,-0.2412,0.7625,0.6004,-0.2412,0.7625,0.6004,-0.2412,0.9128,-0.3004,-0.2767,0.9128,-0.3004,-0.2767,0.9128,-0.3004,-0.2767,0.9128,-0.3004,-0.2767,0.5609,-0.6754,0.4788,0.5609,-0.6754,0.4788,0.5609,-0.6754,0.4788,0.5609,-0.6754,0.4788],"uvs":[0.8444,0.4443,0.8444,0.5788,0.7427,0.4907,0.7815,0.4412,0.1123,0.7421,0.1123,0.8766,0.0106,0.7885,0.0494,0.739,0.7096,0.6579,0.6079,0.7459,0.6079,0.6114,0.6707,0.6084,0.2382,0.8134,0.2307,0.6791,0.3372,0.7612,0.3011,0.8129,0.197,0.873,0.1342,0.87,0.1342,0.7355,0.2359,0.8235,0.5971,0.436,0.5971,0.3015,0.66,0.2984,0.6988,0.3479,0.4963,0.6602,0.3946,0.7482,0.3946,0.6137,0.4575,0.6106,0.7264,0.4513,0.7264,0.5859,0.6247,0.4978,0.6636,0.4483,0.6787,0.3776,0.7804,0.2896,0.7804,0.4241,0.7175,0.4271,0.2814,0.688,0.3832,0.6,0.3832,0.7345,0.3203,0.7376],"indices":[0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,20,21,22,20,22,23,24,25,26,24,26,27,28,29,30,28,30,31,32,33,34,32,34,35,36,37,38,36,38,39],"vcount":40,"tricount":20},"12":{"positions":[0.629,-0.7606,0.1607,0.9758,-0.1942,-0.1004,0.8696,0.3537,0.3445,0.4572,0.1258,0.8804,0.3085,-0.5628,0.7669,0.629,-0.7606,0.1607,0.1222,-0.9438,-0.3072,0.1558,-0.4905,-0.8574,0.6834,-0.0273,-0.7296,0.9758,-0.1942,-0.1004,0.629,-0.7606,0.1607,0.3085,-0.5628,0.7669,-0.3964,-0.6238,0.6736,-0.5115,-0.8592,0.0098,0.1222,-0.9438,-0.3072,0.9758,-0.1942,-0.1004,0.6834,-0.0273,-0.7296,0.3964,0.6238,-0.6736,0.5115,0.8592,-0.0098,0.8696,0.3537,0.3445,0.1222,-0.9438,-0.3072,-0.5115,-0.8592,0.0098,-0.8696,-0.3537,-0.3445,-0.4572,-0.1258,-0.8804,0.1558,-0.4905,-0.8574,0.3085,-0.5628,0.7669,0.4572,0.1258,0.8804,-0.1558,0.4905,0.8574,-0.6834,0.0273,0.7296,-0.3964,-0.6238,0.6736,0.8696,0.3537,0.3445,0.5115,0.8592,-0.0098,-0.1222,0.9438,0.3072,-0.1558,0.4905,0.8574,0.4572,0.1258,0.8804,-0.6834,0.0273,0.7296,-0.9758,0.1942,0.1004,-0.8696,-0.3537,-0.3445,-0.5115,-0.8592,0.0098,-0.3964,-0.6238,0.6736,-0.4572,-0.1258,-0.8804,-0.3085,0.5628,-0.7669,0.3964,0.6238,-0.6736,0.6834,-0.0273,-0.7296,0.1558,-0.4905,-0.8574,-0.629,0.7606,-0.1607,-0.1222,0.9438,0.3072,0.5115,0.8592,-0.0098,0.3964,0.6238,-0.6736,-0.3085,0.5628,-0.7669,-0.629,0.7606,-0.1607,-0.9758,0.1942,0.1004,-0.6834,0.0273,0.7296,-0.1558,0.4905,0.8574,-0.1222,0.9438,0.3072,-0.629,0.7606,-0.1607,-0.3085,0.5628,-0.7669,-0.4572,-0.1258,-0.8804,-0.8696,-0.3537,-0.3445,-0.9758,0.1942,0.1004],"normals":[0.8155,-0.2613,0.5165,0.8155,-0.2613,0.5165,0.8155,-0.2613,0.5165,0.8155,-0.2613,0.5165,0.8155,-0.2613,0.5165,0.6459,-0.6082,-0.4615,0.6459,-0.6082,-0.4615,0.6459,-0.6082,-0.4615,0.6459,-0.6082,-0.4615,0.6459,-0.6082,-0.4615,0.0382,-0.9439,0.3282,0.0382,-0.9439,0.3282,0.0382,-0.9439,0.3282,0.0382,-0.9439,0.3282,0.0382,-0.9439,0.3282,0.865,0.4065,-0.2942,0.865,0.4065,-0.2942,0.865,0.4065,-0.2942,0.865,0.4065,-0.2942,0.865,0.4065,-0.2942,-0.3927,-0.6979,-0.5989,-0.3927,-0.6979,-0.5989,-0.3927,-0.6979,-0.5989,-0.3927,-0.6979,-0.5989,-0.3927,-0.6979,-0.5989,-0.1183,-0.1367,0.9835,-0.1183,-0.1367,0.9835,-0.1183,-0.1367,0.9835,-0.1183,-0.1367,0.9835,-0.1183,-0.1367,0.9835,0.3927,0.6979,0.5989,0.3927,0.6979,0.5989,0.3927,0.6979,0.5989,0.3927,0.6979,0.5989,0.3927,0.6979,0.5989,-0.865,-0.4065,0.2942,-0.865,-0.4065,0.2942,-0.865,-0.4065,0.2942,-0.865,-0.4065,0.2942,-0.865,-0.4065,0.2942,0.1183,0.1367,-0.9835,0.1183,0.1367,-0.9835,0.1183,0.1367,-0.9835,0.1183,0.1367,-0.9835,0.1183,0.1367,-0.9835,-0.0382,0.9439,-0.3282,-0.0382,0.9439,-0.3282,-0.0382,0.9439,-0.3282,-0.0382,0.9439,-0.3282,-0.0382,0.9439,-0.3282,-0.6459,0.6082,0.4615,-0.6459,0.6082,0.4615,-0.6459,0.6082,0.4615,-0.6459,0.6082,0.4615,-0.6459,0.6082,0.4615,-0.8155,0.2613,-0.5165,-0.8155,0.2613,-0.5165,-0.8155,0.2613,-0.5165,-0.8155,0.2613,-0.5165,-0.8155,0.2613,-0.5165],"uvs":[0.1155,0.9671,0.0502,0.9883,0.0099,0.9328,0.0502,0.8773,0.1155,0.8985,0.5663,0.8425,0.501,0.8637,0.4606,0.8082,0.501,0.7526,0.5663,0.7738,0.8528,0.2917,0.8932,0.3472,0.8528,0.4028,0.7875,0.3816,0.7875,0.3129,0.774,0.8192,0.8144,0.8748,0.774,0.9303,0.7087,0.9091,0.7087,0.8404,0.7611,0.8037,0.7208,0.7482,0.7611,0.6926,0.8264,0.7138,0.8264,0.7825,0.8073,0.013,0.8477,0.0686,0.8073,0.1241,0.742,0.1029,0.742,0.0343,0.786,0.5802,0.8264,0.6357,0.786,0.6912,0.7208,0.67,0.7208,0.6014,0.3379,0.8194,0.3782,0.7638,0.4435,0.7851,0.4435,0.8537,0.3782,0.8749,0.6633,0.8807,0.598,0.8595,0.598,0.7908,0.6633,0.7696,0.7037,0.8252,0.1303,0.9349,0.1707,0.8794,0.236,0.9006,0.236,0.9692,0.1707,0.9905,0.7403,0.1998,0.7807,0.1443,0.846,0.1655,0.846,0.2341,0.7807,0.2553,0.2345,0.8783,0.2749,0.8228,0.3402,0.844,0.3402,0.9127,0.2749,0.9339],"indices":[1,4,0,4,1,3,3,1,2,7,5,6,5,7,9,9,7,8,10,13,14,13,10,12,12,10,11,16,19,15,19,16,17,19,17,18,24,22,23,22,24,20,22,20,21,29,27,28,27,29,25,27,25,26,32,30,31,30,32,33,30,33,34,39,37,38,37,39,35,37,35,36,41,44,40,44,41,42,44,42,43,45,48,49,48,45,47,47,45,46,53,51,52,51,53,50,50,53,54,59,57,58,57,59,56,56,59,55],"vcount":60,"tricount":36},"20":{"positions":[0.597,0.2467,0.7633,-0.0162,-0.6068,0.7947,0.8065,-0.5743,0.1407,0.597,0.2467,0.7633,0.1086,0.9767,0.1852,-0.4475,0.3518,0.8222,0.8836,0.4044,-0.236,0.8065,-0.5743,0.1407,0.4475,-0.3518,-0.8222,0.8836,0.4044,-0.236,0.0162,0.6068,-0.7947,0.1086,0.9767,0.1852,-0.8836,-0.4044,0.236,-0.1086,-0.9767,-0.1852,-0.0162,-0.6068,0.7947,-0.8836,-0.4044,0.236,-0.4475,0.3518,0.8222,-0.8065,0.5743,-0.1407,-0.597,-0.2467,-0.7633,0.4475,-0.3518,-0.8222,-0.1086,-0.9767,-0.1852,-0.597,-0.2467,-0.7633,-0.8065,0.5743,-0.1407,0.0162,0.6068,-0.7947,0.597,0.2467,0.7633,-0.4475,0.3518,0.8222,-0.0162,-0.6068,0.7947,-0.8836,-0.4044,0.236,-0.0162,-0.6068,0.7947,-0.4475,0.3518,0.8222,0.8836,0.4044,-0.236,0.4475,-0.3518,-0.8222,0.0162,0.6068,-0.7947,-0.597,-0.2467,-0.7633,0.0162,0.6068,-0.7947,0.4475,-0.3518,-0.8222,0.8065,-0.5743,0.1407,0.8836,0.4044,-0.236,0.597,0.2467,0.7633,0.1086,0.9767,0.1852,0.597,0.2467,0.7633,0.8836,0.4044,-0.236,-0.1086,-0.9767,-0.1852,-0.8836,-0.4044,0.236,-0.597,-0.2467,-0.7633,-0.8065,0.5743,-0.1407,-0.597,-0.2467,-0.7633,-0.8836,-0.4044,0.236,-0.0162,-0.6068,0.7947,-0.1086,-0.9767,-0.1852,0.8065,-0.5743,0.1407,0.4475,-0.3518,-0.8222,0.8065,-0.5743,0.1407,-0.1086,-0.9767,-0.1852,-0.4475,0.3518,0.8222,0.1086,0.9767,0.1852,-0.8065,0.5743,-0.1407,0.0162,0.6068,-0.7947,-0.8065,0.5743,-0.1407,0.1086,0.9767,0.1852],"normals":[0.5819,-0.3919,0.7126,0.5819,-0.3919,0.7126,0.5819,-0.3919,0.7126,0.1083,0.6607,0.7428,0.1083,0.6607,0.7428,0.1083,0.6607,0.7428,0.8967,-0.2188,-0.3848,0.8967,-0.2188,-0.3848,0.8967,-0.2188,-0.3848,0.423,0.8338,-0.3546,0.423,0.8338,-0.3546,0.423,0.8338,-0.3546,-0.423,-0.8338,0.3547,-0.423,-0.8338,0.3547,-0.423,-0.8338,0.3547,-0.8967,0.2188,0.3848,-0.8967,0.2188,0.3848,-0.8967,0.2188,0.3848,-0.1083,-0.6607,-0.7428,-0.1083,-0.6607,-0.7428,-0.1083,-0.6607,-0.7428,-0.5819,0.3919,-0.7126,-0.5819,0.3919,-0.7126,-0.5819,0.3919,-0.7126,0.0559,-0.0035,0.9984,0.0559,-0.0035,0.9984,0.0559,-0.0035,0.9984,-0.5652,-0.2766,0.7772,-0.5652,-0.2766,0.7772,-0.5652,-0.2766,0.7772,0.5652,0.2766,-0.7772,0.5652,0.2766,-0.7772,0.5652,0.2766,-0.7772,-0.0559,0.0035,-0.9984,-0.0559,0.0035,-0.9984,-0.0559,0.0035,-0.9984,0.9594,0.0322,0.2802,0.9594,0.0322,0.2802,0.9594,0.0322,0.2802,0.6667,0.6828,0.2989,0.6667,0.6828,0.2989,0.6667,0.6828,0.2989,-0.6667,-0.6828,-0.2989,-0.6667,-0.6828,-0.2989,-0.6667,-0.6828,-0.2989,-0.9594,-0.0322,-0.2802,-0.9594,-0.0322,-0.2802,-0.9594,-0.0322,-0.2802,0.2859,-0.9051,0.3147,0.2859,-0.9051,0.3147,0.2859,-0.9051,0.3147,0.4804,-0.7981,-0.3635,0.4804,-0.7981,-0.3635,0.4804,-0.7981,-0.3635,-0.4804,0.7981,0.3635,-0.4804,0.7981,0.3635,-0.4804,0.7981,0.3635,-0.2859,0.9051,-0.3147,-0.2859,0.9051,-0.3147,-0.2859,0.9051,-0.3147],"uvs":[0.9932,0.6763,0.9932,0.771,0.9112,0.7236,0.9455,0.5353,0.8634,0.5826,0.8634,0.4879,0.9932,0.8684,0.9932,0.9631,0.9112,0.9158,0.8592,0.1268,0.8592,0.0321,0.9412,0.0795,0.5118,0.8763,0.5938,0.9237,0.5118,0.971,0.8278,0.7236,0.9098,0.6763,0.9098,0.771,0.9112,0.7723,0.9932,0.8197,0.9112,0.867,0.8087,0.9393,0.8907,0.892,0.8907,0.9867,0.8848,0.2586,0.9668,0.2112,0.9668,0.3059,0.9098,0.5802,0.9098,0.6749,0.8278,0.6275,0.6984,0.9386,0.6164,0.986,0.6164,0.8913,0.9073,0.2995,0.9893,0.3468,0.9073,0.3942,0.4066,0.9887,0.3245,0.9414,0.4066,0.894,0.9935,0.4511,0.9115,0.4985,0.9115,0.4038,0.9932,0.6275,0.9112,0.6749,0.9112,0.5802,0.4984,0.9724,0.4164,0.9251,0.4984,0.8777,0.8278,0.867,0.8278,0.7723,0.9098,0.8197,0.9421,0.1074,0.9421,0.2021,0.8601,0.1547,0.9993,0.0007,0.9993,0.0954,0.9173,0.048,0.5133,0.7184,0.5133,0.6237,0.5954,0.6711],"indices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59],"vcount":60,"tricount":20}};

const DICE_SKINS = [
  { id: "nebulosa", label: "Nebulosa", tex: "data:image/jpeg;base64,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" },
  { id: "chamas", label: "Chamas", tex: "data:image/jpeg;base64,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" },
  { id: "floresta", label: "Floresta", tex: "data:image/jpeg;base64,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" },
  { id: "ametista", label: "Ametista", tex: "data:image/jpeg;base64,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" },
  { id: "pedra", label: "Pedra", tex: "data:image/jpeg;base64,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" },
  { id: "carmesim", label: "Carmesim", tex: "data:image/jpeg;base64,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" },
  { id: "safira", label: "Safira", tex: "data:image/jpeg;base64,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" },
];

// Constrói a malha 3D do dado de acordo com o número de lados
// Cache de texturas carregadas (evita recriar a cada roll)
const _textureCache = {};
const getSkinTexture = (skinId) => {
  if (_textureCache[skinId]) return _textureCache[skinId];
  const skin = DICE_SKINS.find(s => s.id === skinId) || DICE_SKINS[0];
  const loader = new THREE.TextureLoader();
  const tex = loader.load(skin.tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // GLB usa UV com origem top-left, igual ao asset original
  _textureCache[skinId] = tex;
  return tex;
};

// Constrói a malha 3D do dado a partir da geometria real extraída do modelo enviado,
// aplicando a textura ("skin") escolhida na bolsa de dados
const buildDieGroup = (sides, skinId) => {
  const group = new THREE.Group();
  const geo = DICE_GEOMETRY[sides] || DICE_GEOMETRY[20];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3));
  if (geo.normals) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3));
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geo.uvs, 2));
  geometry.setIndex(geo.indices);
  if (!geo.normals) geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: getSkinTexture(skinId),
    metalness: 0.15,
    roughness: 0.55,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // ajusta escala visual para um tamanho consistente entre os diferentes dados
  mesh.scale.setScalar(1.35);
  group.add(mesh);

  const edges = new THREE.EdgesGeometry(geometry, 25);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1a1008, transparent: true, opacity: 0.35 });
  const line = new THREE.LineSegments(edges, edgeMaterial);
  line.scale.setScalar(1.35);
  group.add(line);

  return group;
};

// Visual 3D do dado, com rotação contínua e "arremesso" físico ao rolar
const Dice3D = ({ diceType, skinId, spinTrigger }) => {
  const containerRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 150;
    const height = containerRef.current.clientHeight || 150;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.3, 4.3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff2d8, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffe9b0, 1.3);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xff9d2e, 0.7, 12);
    rimLight.position.set(-3, -2, 3);
    scene.add(rimLight);

    const dieGroup = buildDieGroup(diceType, skinId);
    scene.add(dieGroup);

    // Antes da primeira rolagem, o dado flutua suavemente.
    // Após rolar, ele sempre desacelera até parar por completo (efeito de "pouso").
    const idle = { x: 0.008, y: 0.012, z: 0.005 };
    const velocity = { ...idle };
    const hasRolledRef = { current: false };

    const state = { renderer, scene, camera, dieGroup, velocity, idle, hasRolledRef };
    stateRef.current = state;

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      dieGroup.rotation.x += velocity.x;
      dieGroup.rotation.y += velocity.y;
      dieGroup.rotation.z += velocity.z;
      const target = hasRolledRef.current ? { x: 0, y: 0, z: 0 } : idle;
      velocity.x += (target.x - velocity.x) * 0.04;
      velocity.y += (target.y - velocity.y) * 0.04;
      velocity.z += (target.z - velocity.z) * 0.04;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      stateRef.current = null;
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [diceType, skinId]);

  useEffect(() => {
    if (spinTrigger === 0) return;
    const s = stateRef.current;
    if (!s) return;
    s.hasRolledRef.current = true;
    // impulso de rotação aleatório e forte, simulando o lançamento do dado
    const dir = () => (Math.random() > 0.5 ? 1 : -1);
    s.velocity.x = dir() * (0.45 + Math.random() * 0.55);
    s.velocity.y = dir() * (0.45 + Math.random() * 0.55);
    s.velocity.z = dir() * (0.25 + Math.random() * 0.35);
  }, [spinTrigger]);

  return <div ref={containerRef} className="dice-3d-canvas" />;
};

// Componente de Dado Rolável — suporta expressões com múltiplos dados (ex: 1d4 + 1d20, 2d4 - 1d4)
const DICE_OPTIONS = [4, 6, 8, 10, 12, 20];


const DiceRoller = () => {
  const [terms, setTerms] = useState([{ id: 'init', sign: 1, qty: 1, sides: 20 }]);
  const [nextSign, setNextSign] = useState(1);
  const [breakdown, setBreakdown] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState([]);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [skinId, setSkinId] = useState(DICE_SKINS[0].id);
  const [pouchOpen, setPouchOpen] = useState(false);

  const addTerm = (sides) => {
    if (rolling) return;
    setBreakdown(null);
    setTerms(prev => {
      const existingIndex = prev.findIndex(t => t.sides === sides && t.sign === nextSign);
      if (existingIndex !== -1) {
        return prev.map((t, i) => i === existingIndex ? { ...t, qty: Math.min(20, t.qty + 1) } : t);
      }
      if (prev.length >= 6) return prev; // limite de termos na expressão
      return [...prev, { id: `${sides}-${nextSign}-${Date.now()}`, sign: nextSign, qty: 1, sides }];
    });
  };

  const updateTermQty = (id, delta) => {
    if (rolling) return;
    setBreakdown(null);
    setTerms(prev => prev.map(t => t.id === id ? { ...t, qty: Math.max(1, Math.min(20, t.qty + delta)) } : t));
  };

  const removeTerm = (id) => {
    if (rolling) return;
    setBreakdown(null);
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  const computeRoll = () => {
    const parts = terms.map(t => ({
      sign: t.sign,
      sides: t.sides,
      qty: t.qty,
      rolls: Array.from({ length: t.qty }, () => 1 + Math.floor(Math.random() * t.sides))
    }));
    const total = parts.reduce((sum, p) => sum + p.sign * p.rolls.reduce((a, b) => a + b, 0), 0);
    return { parts, total };
  };

  const formula = terms
    .map((t, i) => `${i === 0 ? (t.sign === 1 ? '' : '− ') : (t.sign === 1 ? '+ ' : '− ')}${t.qty}d${t.sides}`)
    .join(' ');

  const rollDice = () => {
    if (rolling || terms.length === 0) return;
    setRolling(true);
    setBreakdown(null);
    setSpinTrigger(t => t + 1);

    let tickCount = 0;
    const maxTicks = 16;
    const tickInterval = setInterval(() => {
      setBreakdown(computeRoll());
      tickCount++;
      if (tickCount >= maxTicks) {
        clearInterval(tickInterval);
        const final = computeRoll();
        setBreakdown(final);
        setRolling(false);
        setHistory(prev => [
          { id: Date.now(), formula, total: final.total },
          ...prev.slice(0, 7)
        ]);
      }
    }, 75);
  };

  return (
    <div className="dice-roller">
      <h3>
        <Dices size={18} />
        Dados
        <button
          className="pouch-btn"
          onClick={() => setPouchOpen(o => !o)}
          title="Escolher bolsa de dados"
        >
          <ShoppingBag size={17} />
        </button>
      </h3>

      {pouchOpen && (
        <div className="pouch-panel">
          {DICE_SKINS.map(skin => (
            <button
              key={skin.id}
              className={`pouch-skin-btn ${skinId === skin.id ? 'active' : ''}`}
              onClick={() => { setSkinId(skin.id); setPouchOpen(false); }}
              disabled={rolling}
            >
              <img src={skin.tex} alt={skin.label} />
              <span>{skin.label}</span>
              {skinId === skin.id && <Check size={14} className="pouch-check" />}
            </button>
          ))}
        </div>
      )}

      <div className="dice-formula-bar">
        {terms.length === 0 ? (
          <span className="dice-formula-empty">Adicione um dado abaixo</span>
        ) : (
          terms.map((t, i) => (
            <div key={t.id} className="dice-term-chip">
              {i > 0 && <span className="term-sign">{t.sign === 1 ? '+' : '−'}</span>}
              <button onClick={() => updateTermQty(t.id, -1)} disabled={rolling}>-</button>
              <span className="term-label">{t.qty}d{t.sides}</span>
              <button onClick={() => updateTermQty(t.id, 1)} disabled={rolling}>+</button>
              <button className="term-remove" onClick={() => removeTerm(t.id)} disabled={rolling}>
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="dice-op-toggle">
        <span>Próximo dado:</span>
        <button className={nextSign === 1 ? 'active' : ''} onClick={() => setNextSign(1)} disabled={rolling}>+</button>
        <button className={nextSign === -1 ? 'active' : ''} onClick={() => setNextSign(-1)} disabled={rolling}>−</button>
      </div>

      <div className="dice-type-grid">
        {DICE_OPTIONS.map(d => (
          <button
            key={d}
            className="dice-type-btn"
            onClick={() => addTerm(d)}
            disabled={rolling || terms.length >= 6}
          >
            d{d}
          </button>
        ))}
      </div>

      <div className="dice-display-area">
        {terms.length === 0 ? (
          <div className="dice-face-3d dice-face-3d-empty">
            <span className="dice-face-label">Adicione um dado</span>
          </div>
        ) : (
          <div className="dice-multi-row">
            {terms.map((t, i) => {
              const part = breakdown ? breakdown.parts[i] : null;
              return (
                <div key={t.id} className="dice-face-3d dice-face-3d-mini">
                  {i > 0 && <span className="dice-mini-sign">{t.sign === 1 ? '+' : '−'}</span>}
                  <Dice3D diceType={t.sides} skinId={skinId} spinTrigger={spinTrigger} />
                  <span className="dice-face-label">{t.qty}d{t.sides}</span>
                  {part && (
                    <span className={`dice-face-value dice-face-value-mini ${rolling ? 'flicker' : ''}`}>
                      {part.rolls.join('+')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {breakdown && (
          <>
            <div className="dice-breakdown">
              {breakdown.parts.map((p, i) => (
                <span key={i} className="dice-breakdown-part">
                  {i > 0 && <span className="breakdown-sign">{p.sign === 1 ? '+' : '−'}</span>}
                  {p.qty}d{p.sides}: [{p.rolls.join(', ')}]
                </span>
              ))}
            </div>
            <div className="dice-total-line">
              Total: <strong>{breakdown.total}</strong>
            </div>
          </>
        )}
      </div>

      <button className="roll-btn" onClick={rollDice} disabled={rolling || terms.length === 0}>
        <RotateCw size={18} className={rolling ? 'spin' : ''} />
        {rolling ? 'Rolando...' : 'Rolar'}
      </button>

      {history.length > 0 && (
        <div className="dice-history">
          <h4>Histórico</h4>
          {history.map(h => (
            <div key={h.id} className="dice-history-item">
              <span>{h.formula}</span>
              <strong>{h.total}</strong>
            </div>
          ))}

        </div>
      )}
    </div>
  );
};


// Fontes temáticas de RPG disponíveis para o Mestre escolher na ficha
const SHEET_FONTS = [
  { id: 'cinzel', label: 'Cinzel', family: "'Cinzel', serif" },
  { id: 'medieval', label: 'MedievalSharp', family: "'MedievalSharp', cursive" },
  { id: 'uncial', label: 'Uncial Antiqua', family: "'Uncial Antiqua', cursive" },
  { id: 'fell', label: 'IM Fell English', family: "'IM Fell English', serif" },
  { id: 'metamorphous', label: 'Metamorphous', family: "'Metamorphous', cursive" },
  { id: 'grenze', label: 'Grenze', family: "'Grenze', serif" },
];

// Tipos de campo que o Mestre (ou o jogador, nos seus campos extras) pode adicionar à ficha
const FIELD_TYPES = [
  { id: 'text', label: 'Texto curto', icon: Type },
  { id: 'textarea', label: 'Texto longo', icon: ScrollText },
  { id: 'number', label: 'Número', icon: Hash },
  { id: 'image', label: 'Imagem', icon: ImageIcon },
  { id: 'list', label: 'Lista', icon: ListPlus },
  { id: 'formula', label: 'Fórmula', icon: Calculator },
  { id: 'attack', label: 'Ataque/Habilidade', icon: Sword },
  { id: 'checklist', label: 'Lista de marcação', icon: ListChecks },
];

// Avalia uma fórmula simples com referências a outros campos pelo nome (ex: "(Força-10)/2").
// Após substituir os nomes pelos valores, só sobra aritmética básica — nunca código arbitrário.
const evaluateFormula = (formula, labelValueMap) => {
  if (!formula) return null;
  let expr = formula;
  const labels = Object.keys(labelValueMap).sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safeLabel, 'gi');
    expr = expr.replace(re, `(${labelValueMap[label]})`);
  }
  if (!/^[0-9+\-*/().\s]*$/.test(expr)) return 'erro';
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr || '0'});`)();
    if (typeof result !== 'number' || !isFinite(result)) return 'erro';
    return Math.round(result * 100) / 100;
  } catch {
    return 'erro';
  }
};

// Ficha de Personagem: o Mestre monta a estrutura (campos + fonte), o Jogador só preenche os valores
// Barras de Status (Vida, Sanidade, Esforço, etc.) — cada jogador cria as suas próprias,
// com cor livre. Dados ficam em storage compartilhado (indexado pelo nome do jogador)
// para que o Mestre possa visualizar e ajustar a barra de qualquer um.
// Aba "Status do Grupo": mostra um card por jogador com avatar e barras de status,
// visível e atualizado para todos (Mestre pode ajustar valores direto pelos cards)
const GroupStatus = ({ viewMode, allPlayersBars, onUpdatePlayerBars }) => {
  const isMaster = viewMode === 'master';
  const playerNames = Object.keys(allPlayersBars || {}).filter(
    n => (allPlayersBars[n]?.bars || []).length > 0 || allPlayersBars[n]?.avatar
  );

  // Detecta mudanças de valor nas barras (dano/cura) comparando com o snapshot anterior,
  // e dispara uma animação flutuante tipo "-12" / "+8" sobre a barra afetada
  const [effects, setEffects] = useState({}); // { "player::barId": { delta, kind, key } }
  const prevValuesRef = useRef({});
  const initializedRef = useRef(false);

  useEffect(() => {
    const prev = prevValuesRef.current;
    const next = {};
    const newEffects = {};

    playerNames.forEach(name => {
      (allPlayersBars[name]?.bars || []).forEach(bar => {
        const key = `${name}::${bar.id}`;
        next[key] = bar.current;
        if (initializedRef.current && prev[key] !== undefined && prev[key] !== bar.current) {
          const delta = bar.current - prev[key];
          newEffects[key] = { delta, kind: delta > 0 ? 'heal' : 'damage', key: Date.now() + Math.random() };
        }
      });
    });

    if (Object.keys(newEffects).length > 0) {
      setEffects(curr => ({ ...curr, ...newEffects }));
      Object.keys(newEffects).forEach(key => {
        const effectKey = newEffects[key].key;
        setTimeout(() => {
          setEffects(curr => (curr[key]?.key === effectKey ? (({ [key]: _, ...rest }) => rest)(curr) : curr));
        }, 1600);
      });
    }

    prevValuesRef.current = next;
    initializedRef.current = true;
  }, [allPlayersBars]);

  const adjustBar = (targetPlayerName, bar, delta) => {
    const entry = allPlayersBars[targetPlayerName];
    const clamped = Math.max(0, Math.min(bar.current + delta, bar.max));
    const newBars = entry.bars.map(b => b.id === bar.id ? { ...b, current: clamped } : b);
    onUpdatePlayerBars(targetPlayerName, newBars);
  };

  if (playerNames.length === 0) {
    return (
      <div className="group-status-empty empty-state">
        <Users size={64} />
        <h2>Ninguém configurou status ainda</h2>
        <p>Assim que os jogadores criarem suas barras na aba "Ficha de Personagem", eles aparecem aqui.</p>
      </div>
    );
  }

  return (
    <div className="group-status-grid">
      {playerNames.map(name => {
        const entry = allPlayersBars[name] || { avatar: null, bars: [] };
        const cardHasDamage = entry.bars.some(bar => effects[`${name}::${bar.id}`]?.kind === 'damage');
        return (
          <div key={name} className={`group-status-card ${cardHasDamage ? 'card-hit-shake' : ''}`}>
            <div className="group-status-card-header">
              {entry.avatar ? (
                <img src={entry.avatar} alt={name} className="group-status-avatar" />
              ) : (
                <div className="group-status-avatar group-status-avatar-placeholder">
                  <ImageIcon size={22} />
                </div>
              )}
              <h4>{name}</h4>
            </div>

            <div className="group-status-bars">
              {entry.bars.length === 0 && (
                <p className="status-bars-hint">Sem barras configuradas.</p>
              )}
              {entry.bars.map(bar => {
                const effect = effects[`${name}::${bar.id}`];
                return (
                  <div key={bar.id} className="status-bar-row">
                    <div className="status-bar-top">
                      <span className="status-bar-label">{bar.label}</span>
                      <span className="status-bar-numbers">{bar.current} / {bar.max}</span>
                    </div>
                    <div className={`status-bar-track ${effect ? `bar-flash-${effect.kind}` : ''}`}>
                      <div
                        className="status-bar-fill"
                        style={{ width: `${Math.min(100, (bar.current / bar.max) * 100)}%`, background: bar.color }}
                      />
                      {effect && (
                        <span key={effect.key} className={`bar-float-text bar-float-${effect.kind}`}>
                          {effect.delta > 0 ? `+${effect.delta}` : effect.delta}
                        </span>
                      )}
                      {bar.current === 0 && (
                        <span className="bar-down-badge" title="Caído">☠</span>
                      )}
                    </div>
                    {isMaster && (
                      <div className="status-bar-controls">
                        <button onClick={() => adjustBar(name, bar, -5)} className="status-bar-quick">-5</button>
                        <button onClick={() => adjustBar(name, bar, -1)}><Minus size={13} /></button>
                        <button onClick={() => adjustBar(name, bar, 1)}><Plus size={13} /></button>
                        <button onClick={() => adjustBar(name, bar, 5)} className="status-bar-quick">+5</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StatusBars = ({ viewMode, playerName, onPlayerNameChange, allPlayersBars, onUpdatePlayerBars, onUpdatePlayerAvatar }) => {
  const [nameDraft, setNameDraft] = useState(playerName || '');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#c0392b');
  const [newMax, setNewMax] = useState(100);
  const [masterSelectedPlayer, setMasterSelectedPlayer] = useState('');

  const isMaster = viewMode === 'master';
  const playerNames = Object.keys(allPlayersBars || {});
  const activePlayer = isMaster ? masterSelectedPlayer : playerName;
  const activeEntry = (allPlayersBars && allPlayersBars[activePlayer]) || { avatar: null, bars: [] };
  const activeBars = activeEntry.bars || [];

  const confirmName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) onPlayerNameChange(trimmed);
  };

  const addBar = () => {
    const label = newLabel.trim();
    if (!label || !activePlayer) return;
    const bar = { id: `bar_${Date.now()}`, label, color: newColor, max: Number(newMax) || 100, current: Number(newMax) || 100 };
    onUpdatePlayerBars(activePlayer, [...activeBars, bar]);
    setNewLabel('');
    setNewMax(100);
  };

  const removeBar = (barId) => {
    onUpdatePlayerBars(activePlayer, activeBars.filter(b => b.id !== barId));
  };

  const setBarValue = (barId, value) => {
    const clamped = Math.max(0, Math.min(value, activeBars.find(b => b.id === barId)?.max ?? value));
    onUpdatePlayerBars(activePlayer, activeBars.map(b => b.id === barId ? { ...b, current: clamped } : b));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activePlayer) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpdatePlayerAvatar(activePlayer, ev.target.result);
    reader.readAsDataURL(file);
  };

  const adjustBar = (barId, delta) => {
    const bar = activeBars.find(b => b.id === barId);
    if (!bar) return;
    setBarValue(barId, bar.current + delta);
  };

  // Modo Jogador sem nome definido ainda: pede o nome antes de tudo
  if (!isMaster && !playerName) {
    return (
      <div className="status-bars-panel">
        <h3><Heart size={17} /> Barras de Status</h3>
        <p className="status-bars-hint">Defina seu nome de jogador para criar suas barras (vida, sanidade, etc).</p>
        <div className="status-name-row">
          <input
            type="text"
            placeholder="Seu nome de jogador"
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmName()}
          />
          <button className="sheet-tool-btn" onClick={confirmName} disabled={!nameDraft.trim()}>Confirmar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="status-bars-panel">
      <h3><Heart size={17} /> Barras de Status</h3>

      {isMaster && (
        <div className="status-master-select-row">
          <span>Ver/editar barras de:</span>
          <select value={masterSelectedPlayer} onChange={e => setMasterSelectedPlayer(e.target.value)}>
            <option value="">Selecione um jogador...</option>
            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {!isMaster && (
        <div className="status-player-header">
          <div className="status-avatar-wrap">
            {activeEntry.avatar ? (
              <img src={activeEntry.avatar} alt={playerName} className="status-avatar-img" />
            ) : (
              <div className="status-avatar-placeholder"><ImageIcon size={20} /></div>
            )}
            <label className="status-avatar-upload-btn" title="Foto do personagem">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} />
              <Camera size={13} />
            </label>
          </div>
          <p className="status-bars-hint">Jogando como <strong>{playerName}</strong></p>
        </div>
      )}

      {isMaster && !masterSelectedPlayer && (
        <p className="status-bars-hint">
          {playerNames.length === 0
            ? 'Nenhum jogador criou barras de status ainda.'
            : 'Escolha um jogador acima para visualizar e ajustar suas barras.'}
        </p>
      )}

      {activePlayer && (
        <>
          <div className="status-bar-list">
            {activeBars.map(bar => (
              <div key={bar.id} className="status-bar-row">
                <div className="status-bar-top">
                  <span className="status-bar-label">{bar.label}</span>
                  <span className="status-bar-numbers">{bar.current} / {bar.max}</span>
                </div>
                <div className="status-bar-track">
                  <div
                    className="status-bar-fill"
                    style={{ width: `${Math.min(100, (bar.current / bar.max) * 100)}%`, background: bar.color }}
                  />
                </div>
                <div className="status-bar-controls">
                  <button onClick={() => adjustBar(bar.id, -1)}><Minus size={13} /></button>
                  <input
                    type="number"
                    value={bar.current}
                    onChange={e => setBarValue(bar.id, Number(e.target.value))}
                  />
                  <button onClick={() => adjustBar(bar.id, 1)}><Plus size={13} /></button>
                  <button onClick={() => adjustBar(bar.id, -5)} className="status-bar-quick">-5</button>
                  <button onClick={() => adjustBar(bar.id, 5)} className="status-bar-quick">+5</button>
                  <button onClick={() => removeBar(bar.id)} className="status-bar-remove"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          {!isMaster && (
            <div className="status-bar-add-row">
              <input
                type="text"
                placeholder="Nome (ex: Vida, Sanidade)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                title="Cor da barra"
              />
              <input
                type="number"
                placeholder="Máx"
                value={newMax}
                onChange={e => setNewMax(e.target.value)}
                className="status-bar-max-input"
              />
              <button className="field-add-btn" onClick={addBar} disabled={!newLabel.trim()}>
                <Plus size={14} />
                Adicionar barra
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CharacterSheet = ({ viewMode, sheetFields, onFieldsChange, sheetFont, onFontChange, playerName, onPlayerNameChange, playerSheets, onUpdatePlayerSheet }) => {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldFormula, setNewFieldFormula] = useState('');
  const [newFieldTab, setNewFieldTab] = useState('');
  const [extraBuilderOpen, setExtraBuilderOpen] = useState(false);
  const [newExtraType, setNewExtraType] = useState('text');
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraFormula, setNewExtraFormula] = useState('');
  const [newExtraTab, setNewExtraTab] = useState('');
  const [masterSelectedPlayer, setMasterSelectedPlayer] = useState('');
  const [attackRolls, setAttackRolls] = useState({});
  const [activeSheetTab, setActiveSheetTab] = useState('Geral');

  const DEFAULT_TAB = 'Geral';

  const isMaster = viewMode === 'master';
  const fontFamily = (SHEET_FONTS.find(f => f.id === sheetFont) || SHEET_FONTS[0]).family;
  const playerNames = Object.keys(playerSheets || {});
  const activePlayer = isMaster ? masterSelectedPlayer : playerName;
  const activeEntry = (playerSheets && playerSheets[activePlayer]) || { extraFields: [], values: {} };
  const extraFields = activeEntry.extraFields || [];

  // Rascunho local dos VALORES do jogador ativo: digitar atualiza a UI na hora,
  // o storage só grava após uma pausa (debounce). Reseta ao trocar de jogador (Mestre).
  const [draftValues, setDraftValues] = useState(activeEntry.values || {});
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveTimeoutRef = useRef(null);
  const draftRef = useRef(activeEntry.values || {});

  useEffect(() => {
    draftRef.current = activeEntry.values || {};
    setDraftValues(activeEntry.values || {});
    setSaveStatus('idle');
  }, [activePlayer]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // --- Campos BASE (modelo do Mestre) ---
  const addField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const field = { id: `f_${Date.now()}`, type: newFieldType, label, tab: newFieldTab.trim() || DEFAULT_TAB };
    if (newFieldType === 'formula') field.formula = newFieldFormula.trim();
    onFieldsChange([...sheetFields, field]);
    setNewFieldLabel('');
    setNewFieldFormula('');
    setNewFieldTab('');
  };

  const removeField = (id) => onFieldsChange(sheetFields.filter(f => f.id !== id));
  const renameField = (id, label) => onFieldsChange(sheetFields.map(f => f.id === id ? { ...f, label } : f));
  const setFieldTab = (id, tab) => onFieldsChange(sheetFields.map(f => f.id === id ? { ...f, tab: tab || DEFAULT_TAB } : f));
  const moveField = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= sheetFields.length) return;
    const next = [...sheetFields];
    [next[index], next[target]] = [next[target], next[index]];
    onFieldsChange(next);
  };

  // --- Campos EXTRAS (cada jogador monta os seus, por cima do modelo base) ---
  const addExtraField = () => {
    const label = newExtraLabel.trim();
    if (!label || !activePlayer) return;
    const field = { id: `x_${Date.now()}`, type: newExtraType, label, tab: newExtraTab.trim() || DEFAULT_TAB };
    if (newExtraType === 'formula') field.formula = newExtraFormula.trim();
    onUpdatePlayerSheet(activePlayer, { extraFields: [...extraFields, field] });
    setNewExtraLabel('');
    setNewExtraFormula('');
    setNewExtraTab('');
  };

  const removeExtraField = (id) => {
    onUpdatePlayerSheet(activePlayer, { extraFields: extraFields.filter(f => f.id !== id) });
  };

  const renameExtraField = (id, label) => {
    onUpdatePlayerSheet(activePlayer, { extraFields: extraFields.map(f => f.id === id ? { ...f, label } : f) });
  };

  const setExtraFieldTab = (id, tab) => {
    onUpdatePlayerSheet(activePlayer, { extraFields: extraFields.map(f => f.id === id ? { ...f, tab: tab || DEFAULT_TAB } : f) });
  };

  const moveExtraField = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= extraFields.length) return;
    const next = [...extraFields];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdatePlayerSheet(activePlayer, { extraFields: next });
  };

  // --- Valores preenchidos (base + extras, mesmo objeto de valores) ---
  const setValue = (id, value) => {
    const next = { ...draftRef.current, [id]: value };
    draftRef.current = next;
    setDraftValues(next);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await onUpdatePlayerSheet(activePlayer, { values: next });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev)), 1800);
    }, 700);
  };

  const handleImageField = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setValue(id, ev.target.result);
    reader.readAsDataURL(file);
  };

  const addListItem = (id) => setValue(id, [...(draftRef.current[id] || []), '']);
  const updateListItem = (id, idx, text) => {
    const current = [...(draftRef.current[id] || [])];
    current[idx] = text;
    setValue(id, current);
  };
  const removeListItem = (id, idx) => {
    setValue(id, (draftRef.current[id] || []).filter((_, i) => i !== idx));
  };

  // --- Lista marcável (checklist) ---
  const addChecklistItem = (id) => {
    const current = draftRef.current[id] || [];
    setValue(id, [...current, { id: `c_${Date.now()}`, text: '', checked: false }]);
  };
  const updateChecklistText = (id, itemId, text) => {
    const current = (draftRef.current[id] || []).map(it => it.id === itemId ? { ...it, text } : it);
    setValue(id, current);
  };
  const toggleChecklistItem = (id, itemId) => {
    const current = (draftRef.current[id] || []).map(it => it.id === itemId ? { ...it, checked: !it.checked } : it);
    setValue(id, current);
  };
  const removeChecklistItem = (id, itemId) => {
    setValue(id, (draftRef.current[id] || []).filter(it => it.id !== itemId));
  };

  // --- Ataque/Habilidade (bônus + dano com rolagem de dado 3D de verdade) ---
  const setAttackField = (id, key, val) => {
    const current = draftRef.current[id] || { bonus: 0, damage: '' };
    setValue(id, { ...current, [key]: val });
  };

  const rollAttack = (id) => {
    const current = draftRef.current[id] || { bonus: 0, damage: '' };
    const bonus = Number(current.bonus) || 0;
    setAttackRolls(prev => ({
      ...prev,
      [id]: { ...prev[id], atkRolling: true, atkSpin: (prev[id]?.atkSpin || 0) + 1, atk: null }
    }));
    setTimeout(() => {
      const d20 = 1 + Math.floor(Math.random() * 20);
      setAttackRolls(prev => ({
        ...prev,
        [id]: { ...prev[id], atkRolling: false, atk: { d20, bonus, total: d20 + bonus } }
      }));
    }, 1200);
  };

  const rollDamage = (id) => {
    const current = draftRef.current[id] || { bonus: 0, damage: '' };
    const cleaned = (current.damage || '').replace(/\s/g, '');
    const match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return;
    const qty = Math.min(parseInt(match[1], 10), 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;

    setAttackRolls(prev => ({
      ...prev,
      [id]: { ...prev[id], dmgRolling: true, dmgSpin: (prev[id]?.dmgSpin || 0) + 1, dmgDice: { qty, sides, mod }, dmg: null }
    }));
    setTimeout(() => {
      const rolls = Array.from({ length: qty }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0) + mod;
      setAttackRolls(prev => ({
        ...prev,
        [id]: { ...prev[id], dmgRolling: false, dmg: { rolls, mod, total } }
      }));
    }, 1200);
  };

  // Todos os campos (base + extras) — usado para resolver fórmulas por nome
  const allFieldsForFormulas = [...sheetFields, ...extraFields];

  // Nomes de abas já usados em qualquer campo (base ou extra) — sugestões para o datalist
  const allTabNames = Array.from(new Set(allFieldsForFormulas.map(f => f.tab).filter(Boolean)));

  const renderField = (f, { removable }) => (
    <div key={f.id} className={`sheet-field sheet-field-${f.type}`}>
      <div className="sheet-field-label-row">
        <label style={{ fontFamily }}>{f.label}</label>
        {removable && (
          <button className="sheet-field-remove-mini" onClick={() => removeExtraField(f.id)} title="Remover meu campo">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {f.type === 'text' && (
        <input type="text" value={draftValues[f.id] || ''} onChange={e => setValue(f.id, e.target.value)} placeholder="Preencha aqui..." />
      )}
      {f.type === 'number' && (
        <input type="number" value={draftValues[f.id] ?? ''} onChange={e => setValue(f.id, e.target.value)} placeholder="0" />
      )}
      {f.type === 'textarea' && (
        <textarea value={draftValues[f.id] || ''} onChange={e => setValue(f.id, e.target.value)} placeholder="Preencha aqui..." rows={4} />
      )}
      {f.type === 'image' && (
        <div className="sheet-field-image">
          {draftValues[f.id] ? <img src={draftValues[f.id]} alt={f.label} /> : (
            <div className="sheet-field-image-placeholder"><ImageIcon size={28} /></div>
          )}
          <label className="upload-btn sheet-image-upload-btn">
            <input type="file" accept="image/*" onChange={e => handleImageField(f.id, e)} />
            {draftValues[f.id] ? 'Trocar imagem' : 'Enviar imagem'}
          </label>
        </div>
      )}
      {f.type === 'list' && (
        <div className="sheet-field-list">
          {(draftValues[f.id] || []).map((item, idx) => (
            <div key={idx} className="sheet-list-item">
              <input type="text" value={item} onChange={e => updateListItem(f.id, idx, e.target.value)} placeholder={`Item ${idx + 1}`} />
              <button onClick={() => removeListItem(f.id, idx)}><X size={14} /></button>
            </div>
          ))}
          <button className="sheet-list-add-btn" onClick={() => addListItem(f.id)}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}

      {f.type === 'formula' && (() => {
        const labelValueMap = {};
        allFieldsForFormulas.forEach(other => {
          labelValueMap[other.label] = draftValues[other.id];
        });
        const result = evaluateFormula(f.formula, labelValueMap);
        return (
          <div className="sheet-field-formula">
            <span className="formula-result">{result === null ? '—' : result}</span>
            <span className="formula-expr">{f.formula}</span>
          </div>
        );
      })()}

      {f.type === 'attack' && (() => {
        const val = draftValues[f.id] || { bonus: 0, damage: '' };
        const rolls = attackRolls[f.id] || {};
        const showAtkDice = rolls.atkRolling || rolls.atk;
        const showDmgDice = (rolls.dmgRolling || rolls.dmg) && rolls.dmgDice;
        return (
          <div className="sheet-field-attack">
            <div className="attack-inputs-row">
              <label className="attack-mini-label">Bônus
                <input type="number" value={val.bonus ?? 0} onChange={e => setAttackField(f.id, 'bonus', e.target.value)} />
              </label>
              <label className="attack-mini-label">Dano
                <input type="text" placeholder="1d8+2" value={val.damage || ''} onChange={e => setAttackField(f.id, 'damage', e.target.value)} />
              </label>
            </div>
            <div className="attack-roll-row">
              <button className="attack-roll-btn" onClick={() => rollAttack(f.id)} disabled={rolls.atkRolling}>
                <Dices size={14} /> Rolar Ataque
              </button>
              <button className="attack-roll-btn" onClick={() => rollDamage(f.id)} disabled={!val.damage || rolls.dmgRolling}>
                <Dices size={14} /> Rolar Dano
              </button>
            </div>

            {showAtkDice && (
              <div className="attack-dice-row">
                <div className="dice-face-3d dice-face-3d-mini">
                  <Dice3D diceType={20} skinId={DICE_SKINS[0].id} spinTrigger={rolls.atkSpin} />
                  <span className="dice-face-label">d20</span>
                  {rolls.atk && <span className={`dice-face-value dice-face-value-mini ${rolls.atkRolling ? 'flicker' : ''}`}>{rolls.atk.d20}</span>}
                </div>
              </div>
            )}
            {showDmgDice && (
              <div className="attack-dice-row">
                {Array.from({ length: rolls.dmgDice.qty }).map((_, i) => (
                  <div key={i} className="dice-face-3d dice-face-3d-mini">
                    <Dice3D diceType={rolls.dmgDice.sides} skinId={DICE_SKINS[0].id} spinTrigger={rolls.dmgSpin} />
                    <span className="dice-face-label">d{rolls.dmgDice.sides}</span>
                    {rolls.dmg && <span className={`dice-face-value dice-face-value-mini ${rolls.dmgRolling ? 'flicker' : ''}`}>{rolls.dmg.rolls[i]}</span>}
                  </div>
                ))}
              </div>
            )}

            {(rolls.atk || rolls.dmg) && (
              <div className="attack-result-row">
                {rolls.atk && <span>Ataque: d20({rolls.atk.d20}) + {rolls.atk.bonus} = <strong>{rolls.atk.total}</strong></span>}
                {rolls.dmg && <span>Dano: [{rolls.dmg.rolls.join(', ')}]{rolls.dmg.mod ? ` ${rolls.dmg.mod > 0 ? '+' : ''}${rolls.dmg.mod}` : ''} = <strong>{rolls.dmg.total}</strong></span>}
              </div>
            )}
          </div>
        );
      })()}

      {f.type === 'checklist' && (
        <div className="sheet-field-checklist">
          {(draftValues[f.id] || []).map(item => (
            <div key={item.id} className="checklist-item-row">
              <input type="checkbox" checked={!!item.checked} onChange={() => toggleChecklistItem(f.id, item.id)} />
              <input
                type="text"
                value={item.text}
                onChange={e => updateChecklistText(f.id, item.id, e.target.value)}
                placeholder="Descreva o item..."
                className={item.checked ? 'checklist-text-done' : ''}
              />
              <button onClick={() => removeChecklistItem(f.id, item.id)}><X size={14} /></button>
            </div>
          ))}
          <button className="sheet-list-add-btn" onClick={() => addChecklistItem(f.id)}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="character-sheet" style={{ fontFamily }}>
      <datalist id="sheet-tab-options">
        {allTabNames.map(t => <option key={t} value={t} />)}
      </datalist>
      {activePlayer && (
        <div className={`save-status save-status-${saveStatus}`}>
          {saveStatus === 'saving' && <>Salvando...</>}
          {saveStatus === 'saved' && <><Check size={14} /> Salvo</>}
        </div>
      )}

      {isMaster && (
        <div className="sheet-master-toolbar">
          <button className="sheet-tool-btn" onClick={() => setBuilderOpen(o => !o)}>
            <Settings2 size={16} />
            {builderOpen ? 'Fechar construtor' : 'Configurar modelo base'}
          </button>
          <button className="sheet-tool-btn" onClick={() => setFontPickerOpen(o => !o)}>
            <Palette size={16} />
            Fonte da ficha
          </button>
        </div>
      )}

      {isMaster && fontPickerOpen && (
        <div className="font-picker-panel">
          {SHEET_FONTS.map(f => (
            <button
              key={f.id}
              className={`font-swatch-btn ${sheetFont === f.id ? 'active' : ''}`}
              style={{ fontFamily: f.family }}
              onClick={() => { onFontChange(f.id); setFontPickerOpen(false); }}
            >
              Abc 123
              <small>{f.label}</small>
            </button>
          ))}
        </div>
      )}

      {isMaster && builderOpen && (
        <div className="field-builder-panel">
          <h4>Adicionar campo ao modelo base (todos os jogadores recebem)</h4>
          <div className="field-type-grid">
            {FIELD_TYPES.map(ft => {
              const Icon = ft.icon;
              return (
                <button key={ft.id} className={`field-type-btn ${newFieldType === ft.id ? 'active' : ''}`} onClick={() => setNewFieldType(ft.id)}>
                  <Icon size={16} /> {ft.label}
                </button>
              );
            })}
          </div>
          <div className="field-add-row">
            <input
              type="text"
              placeholder="Nome do campo (ex: Força, Retrato, Inventário...)"
              value={newFieldLabel}
              onChange={e => setNewFieldLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addField()}
            />
            {newFieldType === 'formula' && (
              <input
                type="text"
                placeholder="Fórmula (ex: (Força-10)/2)"
                value={newFieldFormula}
                onChange={e => setNewFieldFormula(e.target.value)}
                className="formula-input"
              />
            )}
            <input
              type="text"
              placeholder="Aba (opcional)"
              value={newFieldTab}
              onChange={e => setNewFieldTab(e.target.value)}
              list="sheet-tab-options"
              className="field-tab-input"
            />
            <button className="field-add-btn" onClick={addField} disabled={!newFieldLabel.trim()}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
          {newFieldType === 'formula' && (
            <p className="status-bars-hint">Use os nomes de outros campos numéricos na fórmula, ex: (Força-10)/2</p>
          )}

          {sheetFields.length > 0 && (
            <div className="field-list">
              {sheetFields.map((f, i) => {
                const ft = FIELD_TYPES.find(t => t.id === f.type) || FIELD_TYPES[0];
                const Icon = ft.icon;
                return (
                  <div key={f.id} className="field-list-row">
                    <Icon size={15} className="field-list-icon" />
                    <input type="text" value={f.label} onChange={e => renameField(f.id, e.target.value)} className="field-list-label-input" />
                    <span className="field-list-type">{ft.label}</span>
                    <input
                      type="text"
                      value={f.tab || DEFAULT_TAB}
                      onChange={e => setFieldTab(f.id, e.target.value)}
                      list="sheet-tab-options"
                      className="field-list-tab-input"
                      title="Aba desta ficha"
                    />
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} title="Mover para cima"><ArrowUp size={14} /></button>
                    <button onClick={() => moveField(i, 1)} disabled={i === sheetFields.length - 1} title="Mover para baixo"><ArrowDown size={14} /></button>
                    <button onClick={() => removeField(f.id)} className="field-remove-btn" title="Remover campo"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isMaster && (
        <div className="status-master-select-row">
          <span>Ver/editar ficha de:</span>
          <select value={masterSelectedPlayer} onChange={e => setMasterSelectedPlayer(e.target.value)}>
            <option value="">Selecione um jogador...</option>
            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {!isMaster && !playerName && (
        <p className="status-bars-hint">Defina seu nome de jogador na seção "Barras de Status" acima para habilitar sua ficha.</p>
      )}

      {isMaster && !masterSelectedPlayer && (
        <p className="status-bars-hint">
          {playerNames.length === 0 ? 'Nenhum jogador se identificou ainda.' : 'Escolha um jogador acima para ver a ficha completa dele.'}
        </p>
      )}

      {activePlayer && (
        <div className="sheet-fields-area">
          {sheetFields.length === 0 && extraFields.length === 0 ? (
            <div className="empty-state">
              <ScrollText size={64} />
              <h2>Ficha ainda não configurada</h2>
              <p>{isMaster ? 'Clique em "Configurar modelo base" para começar.' : 'Aguarde o Mestre configurar o modelo base, ou adicione seus próprios campos abaixo.'}</p>
            </div>
          ) : (() => {
            const allCombined = [...sheetFields, ...extraFields];
            const tabNames = Array.from(new Set(allCombined.map(f => f.tab || DEFAULT_TAB)));
            if (tabNames.length === 0) tabNames.push(DEFAULT_TAB);
            const currentTab = tabNames.includes(activeSheetTab) ? activeSheetTab : tabNames[0];
            const visibleBase = sheetFields.filter(f => (f.tab || DEFAULT_TAB) === currentTab);
            const visibleExtra = extraFields.filter(f => (f.tab || DEFAULT_TAB) === currentTab);
            return (
              <>
                {tabNames.length > 1 && (
                  <div className="sheet-subtab-nav">
                    {tabNames.map(t => (
                      <button
                        key={t}
                        className={`sheet-subtab-btn ${t === currentTab ? 'active' : ''}`}
                        onClick={() => setActiveSheetTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="sheet-fields-grid">
                  {visibleBase.map(f => renderField(f, { removable: false }))}
                  {visibleExtra.map(f => renderField(f, { removable: !isMaster }))}
                </div>
              </>
            );
          })()}

          {!isMaster && (
            <div className="extra-field-builder">
              <button className="sheet-tool-btn" onClick={() => setExtraBuilderOpen(o => !o)}>
                <Plus size={16} />
                {extraBuilderOpen ? 'Fechar' : 'Adicionar meu próprio campo'}
              </button>
              {extraBuilderOpen && (
                <div className="field-builder-panel">
                  <div className="field-type-grid">
                    {FIELD_TYPES.map(ft => {
                      const Icon = ft.icon;
                      return (
                        <button key={ft.id} className={`field-type-btn ${newExtraType === ft.id ? 'active' : ''}`} onClick={() => setNewExtraType(ft.id)}>
                          <Icon size={16} /> {ft.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="field-add-row">
                    <input
                      type="text"
                      placeholder="Nome do seu campo (ex: Talentos, Foto extra...)"
                      value={newExtraLabel}
                      onChange={e => setNewExtraLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addExtraField()}
                    />
                    {newExtraType === 'formula' && (
                      <input
                        type="text"
                        placeholder="Fórmula (ex: (Força-10)/2)"
                        value={newExtraFormula}
                        onChange={e => setNewExtraFormula(e.target.value)}
                        className="formula-input"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Aba (opcional)"
                      value={newExtraTab}
                      onChange={e => setNewExtraTab(e.target.value)}
                      list="sheet-tab-options"
                      className="field-tab-input"
                    />
                    <button className="field-add-btn" onClick={addExtraField} disabled={!newExtraLabel.trim()}>
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                  {newExtraType === 'formula' && (
                    <p className="status-bars-hint">Use os nomes de outros campos numéricos na fórmula, ex: (Força-10)/2</p>
                  )}
                  {extraFields.length > 0 && (
                    <div className="field-list">
                      {extraFields.map((f, i) => {
                        const ft = FIELD_TYPES.find(t => t.id === f.type) || FIELD_TYPES[0];
                        const Icon = ft.icon;
                        return (
                          <div key={f.id} className="field-list-row">
                            <Icon size={15} className="field-list-icon" />
                            <input type="text" value={f.label} onChange={e => renameExtraField(f.id, e.target.value)} className="field-list-label-input" />
                            <input
                              type="text"
                              value={f.tab || DEFAULT_TAB}
                              onChange={e => setExtraFieldTab(f.id, e.target.value)}
                              list="sheet-tab-options"
                              className="field-list-tab-input"
                              title="Aba desta ficha"
                            />
                            <button onClick={() => moveExtraField(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                            <button onClick={() => moveExtraField(i, 1)} disabled={i === extraFields.length - 1}><ArrowDown size={14} /></button>
                            <button onClick={() => removeExtraField(f.id)} className="field-remove-btn"><Trash2 size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente principal
const RPGMapExplorer = () => {
  const [mapImage, setMapImage] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [viewMode, setViewMode] = useState('player'); // 'player' ou 'master'
  const [activeTab, setActiveTab] = useState('mapa'); // 'mapa' ou 'ficha'
  const [showPointModal, setShowPointModal] = useState(false);
  const [newPoint, setNewPoint] = useState({ x: 0, y: 0, name: '', description: '', type: 'cidade' });
  const [show3DScene, setShow3DScene] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [users, setUsers] = useState([]);
  const [sheetFields, setSheetFields] = useState([]);
  const [sheetFont, setSheetFont] = useState('cinzel');
  const [playerSheets, setPlayerSheets] = useState({});
  const [playerName, setPlayerName] = useState('');
  const [statusBarsData, setStatusBarsData] = useState({});
  const canvasRef = useRef(null);
  const mapRef = useRef(null);

  const pointTypes = [
    { value: 'cidade', label: 'Cidade', icon: Castle, color: '#d4af37' },
    { value: 'dungeon', label: 'Dungeon', icon: Skull, color: '#8b0000' },
    { value: 'taverna', label: 'Taverna', icon: Scroll, color: '#cd853f' },
    { value: 'floresta', label: 'Floresta', icon: Grid, color: '#228b22' },
    { value: 'evento', label: 'Evento', icon: Sword, color: '#ff4500' },
  ];

  // Carregar dados do storage compartilhado
  useEffect(() => {
    loadSharedData();
    loadPersonalData(); // apenas uma vez: dados pessoais não sofrem alteração externa
    const interval = setInterval(loadSharedData, 2000); // Atualizar a cada 2 segundos
    return () => clearInterval(interval);
  }, []);

  const loadSharedData = async () => {
    try {
      const pointsData = await window.storage.get('rpg-map-points', true);
      if (pointsData) {
        setPoints(JSON.parse(pointsData.value));
      }

      const mapData = await window.storage.get('rpg-map-image', true);
      if (mapData) {
        setMapImage(mapData.value);
      }
    } catch (error) {
      console.log('Primeira vez carregando dados:', error);
    }

    try {
      const fieldsData = await window.storage.get('rpg-sheet-fields', true);
      if (fieldsData) {
        setSheetFields(JSON.parse(fieldsData.value));
      }
      const fontData = await window.storage.get('rpg-sheet-font', true);
      if (fontData) {
        setSheetFont(fontData.value);
      }
    } catch (error) {
      console.log('Primeira vez carregando estrutura da ficha:', error);
    }

    try {
      const barsData = await window.storage.get('rpg-status-bars', true);
      if (barsData) {
        setStatusBarsData(JSON.parse(barsData.value));
      }
    } catch (error) {
      console.log('Primeira vez carregando barras de status:', error);
    }

    try {
      const sheetsData = await window.storage.get('rpg-player-sheets', true);
      if (sheetsData) {
        setPlayerSheets(JSON.parse(sheetsData.value));
      }
    } catch (error) {
      console.log('Primeira vez carregando fichas dos jogadores:', error);
    }
  };

  // Apenas o nome do jogador é pessoal — carregado só uma vez
  const loadPersonalData = async () => {
    try {
      const nameData = await window.storage.get('rpg-player-name', false);
      if (nameData) {
        setPlayerName(nameData.value);
      }
    } catch (error) {
      console.log('Primeira vez carregando nome do jogador:', error);
    }
  };

  const saveSheetFields = async (newFields) => {
    setSheetFields(newFields);
    try {
      await window.storage.set('rpg-sheet-fields', JSON.stringify(newFields), true);
    } catch (error) {
      console.error('Erro ao salvar campos da ficha:', error);
    }
  };

  const saveSheetFont = async (fontId) => {
    setSheetFont(fontId);
    try {
      await window.storage.set('rpg-sheet-font', fontId, true);
    } catch (error) {
      console.error('Erro ao salvar fonte da ficha:', error);
    }
  };

  // Atualiza parcialmente a ficha de UM jogador (extraFields e/ou values) dentro do
  // objeto compartilhado, preservando o que não foi alterado
  const updatePlayerSheet = async (targetPlayerName, updates) => {
    if (!targetPlayerName) return;
    const prevEntry = playerSheets[targetPlayerName] || { extraFields: [], values: {} };
    const nextEntry = { ...prevEntry, ...updates };
    const next = { ...playerSheets, [targetPlayerName]: nextEntry };
    setPlayerSheets(next);
    try {
      await window.storage.set('rpg-player-sheets', JSON.stringify(next), true);
    } catch (error) {
      console.error('Erro ao salvar ficha do jogador:', error);
    }
  };

  const savePlayerName = async (name) => {
    setPlayerName(name);
    try {
      await window.storage.set('rpg-player-name', name, false);
    } catch (error) {
      console.error('Erro ao salvar nome do jogador:', error);
    }
  };

  // Atualiza as barras de UM jogador dentro do objeto compartilhado (todos os jogadores),
  // preservando o avatar já salvo
  const updatePlayerBars = async (targetPlayerName, newBars) => {
    const prevEntry = statusBarsData[targetPlayerName] || { avatar: null, bars: [] };
    const next = { ...statusBarsData, [targetPlayerName]: { ...prevEntry, bars: newBars } };
    setStatusBarsData(next);
    try {
      await window.storage.set('rpg-status-bars', JSON.stringify(next), true);
    } catch (error) {
      console.error('Erro ao salvar barras de status:', error);
    }
  };

  const updatePlayerAvatar = async (targetPlayerName, avatarDataUrl) => {
    const prevEntry = statusBarsData[targetPlayerName] || { avatar: null, bars: [] };
    const next = { ...statusBarsData, [targetPlayerName]: { ...prevEntry, avatar: avatarDataUrl } };
    setStatusBarsData(next);
    try {
      await window.storage.set('rpg-status-bars', JSON.stringify(next), true);
    } catch (error) {
      console.error('Erro ao salvar avatar do jogador:', error);
    }
  };


  const savePoints = async (newPoints) => {
    try {
      await window.storage.set('rpg-map-points', JSON.stringify(newPoints), true);
      setPoints(newPoints);
    } catch (error) {
      console.error('Erro ao salvar pontos:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target.result;
        setMapImage(imageData);
        try {
          await window.storage.set('rpg-map-image', imageData, true);
        } catch (error) {
          console.error('Erro ao salvar mapa:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (e) => {
    if (viewMode !== 'master' || dragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - position.x) / scale;
    const y = (e.clientY - rect.top - position.y) / scale;

    // Verificar se clicou em um ponto existente
    const clickedPoint = points.find(p => {
      const distance = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
      return distance < 15;
    });

    if (clickedPoint) {
      setShow3DScene(clickedPoint);
    } else {
      setNewPoint({ ...newPoint, x, y });
      setShowPointModal(true);
    }
  };

  const handlePointClick = (point) => {
    setShow3DScene(point);
  };

  const addPoint = async () => {
    if (!newPoint.name) return;
    
    const point = {
      ...newPoint,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    await savePoints([...points, point]);
    setShowPointModal(false);
    setNewPoint({ x: 0, y: 0, name: '', description: '', type: 'cidade' });
  };

  const deletePoint = async (pointId) => {
    await savePoints(points.filter(p => p.id !== pointId));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 3));
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (!canvasRef.current || !mapImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Desenhar pontos
      points.forEach(point => {
        const typeInfo = pointTypes.find(t => t.value === point.type);
        
        // Sombra
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Círculo
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = typeInfo?.color || '#d4af37';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // Nome
        ctx.font = 'bold 14px "Cinzel", serif';
        ctx.fillStyle = '#150f28';
        ctx.textAlign = 'center';
        ctx.fillText(point.name, point.x, point.y - 20);
      });
    };
    
    img.src = mapImage;
  }, [mapImage, points, scale, position]);

  return (
    <div className="rpg-container">
      <div className="parchment-bg"></div>
      
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Map size={32} />
            <h1>Grimório Cartográfico</h1>
          </div>
          <div className="header-controls">
            <button 
              className={`mode-btn ${viewMode === 'master' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'master' ? 'player' : 'master')}
            >
              {viewMode === 'master' ? <Edit3 size={20} /> : <Eye size={20} />}
              {viewMode === 'master' ? 'Modo Mestre' : 'Modo Jogador'}
            </button>
            <div className="user-indicator">
              <Users size={20} />
              <span>{points.length} pontos</span>
            </div>
          </div>
        </div>
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'mapa' ? 'active' : ''}`}
            onClick={() => setActiveTab('mapa')}
          >
            <Map size={18} />
            Mapa
          </button>
          <button
            className={`tab-btn ${activeTab === 'ficha' ? 'active' : ''}`}
            onClick={() => setActiveTab('ficha')}
          >
            <ScrollText size={18} />
            Ficha de Personagem
          </button>
          <button
            className={`tab-btn ${activeTab === 'grupo' ? 'active' : ''}`}
            onClick={() => setActiveTab('grupo')}
          >
            <Heart size={18} />
            Status do Grupo
          </button>
        </div>
      </header>

      <div className="main-content">
        {activeTab === 'mapa' ? (
          <>
            {/* Sidebar */}
            <aside className="sidebar">
              <div className="sidebar-section">
                <h3>
                  <Upload size={18} />
                  Mapa
                </h3>
                {viewMode === 'master' && (
                  <label className="upload-btn">
                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                    Upload de Mapa
                  </label>
                )}
              </div>

              <div className="sidebar-section">
                <h3>
                  <Grid size={18} />
                  Pontos de Interesse ({points.length})
                </h3>
                <div className="points-list">
                  {points.map(point => {
                    const typeInfo = pointTypes.find(t => t.value === point.type);
                    const Icon = typeInfo?.icon || Castle;
                    return (
                      <div key={point.id} className="point-item">
                        <div className="point-info" onClick={() => handlePointClick(point)}>
                          <Icon size={16} style={{ color: typeInfo?.color }} />
                          <div>
                            <strong>{point.name}</strong>
                            <small>{point.type}</small>
                          </div>
                        </div>
                        {viewMode === 'master' && (
                          <button 
                            className="delete-btn"
                            onClick={() => deletePoint(point.id)}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sidebar-section">
                <h3>Controles</h3>
                <div className="controls-info">
                  <p><strong>Scroll:</strong> Zoom</p>
                  <p><strong>Arrastar:</strong> Mover mapa</p>
                  <p><strong>Clique:</strong> {viewMode === 'master' ? 'Adicionar ponto' : 'Ver ponto'}</p>
                </div>
                <div className="zoom-indicator">
                  Zoom: {Math.round(scale * 100)}%
                </div>
              </div>
            </aside>

            {/* Canvas principal */}
            <main className="canvas-area">
              {!mapImage ? (
                <div className="empty-state">
                  <Map size={64} />
                  <h2>Nenhum mapa carregado</h2>
                  <p>Faça upload de uma imagem para começar a exploração</p>
                </div>
              ) : (
                <div 
                  className="canvas-wrapper"
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <canvas
                    ref={canvasRef}
                    className="map-canvas"
                    onClick={handleCanvasClick}
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                      cursor: dragging ? 'grabbing' : 'grab'
                    }}
                  />
                </div>
              )}
            </main>
          </>
        ) : activeTab === 'ficha' ? (
          <>
            {/* Área principal da Ficha de Personagem */}
            <main className="sheet-area">
              <StatusBars
                viewMode={viewMode}
                playerName={playerName}
                onPlayerNameChange={savePlayerName}
                allPlayersBars={statusBarsData}
                onUpdatePlayerBars={updatePlayerBars}
                onUpdatePlayerAvatar={updatePlayerAvatar}
              />
              <CharacterSheet
                viewMode={viewMode}
                sheetFields={sheetFields}
                onFieldsChange={saveSheetFields}
                sheetFont={sheetFont}
                onFontChange={saveSheetFont}
                playerName={playerName}
                onPlayerNameChange={savePlayerName}
                playerSheets={playerSheets}
                onUpdatePlayerSheet={updatePlayerSheet}
              />
            </main>

            {/* Painel lateral com o Dado */}
            <aside className="sheet-sidebar">
              <DiceRoller />
            </aside>
          </>
        ) : (
          <main className="group-status-area">
            <GroupStatus
              viewMode={viewMode}
              allPlayersBars={statusBarsData}
              onUpdatePlayerBars={updatePlayerBars}
            />
          </main>
        )}
      </div>

      {/* Modal de adicionar ponto */}
      {showPointModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Novo Ponto de Interesse</h2>
              <button onClick={() => setShowPointModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  value={newPoint.name}
                  onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                  placeholder="Ex: Cidade de Eldoria"
                />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={newPoint.description}
                  onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
                  placeholder="Descreva este local..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <div className="type-grid">
                  {pointTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        className={`type-btn ${newPoint.type === type.value ? 'active' : ''}`}
                        onClick={() => setNewPoint({ ...newPoint, type: type.value })}
                        style={{ '--type-color': type.color }}
                      >
                        <Icon size={20} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPointModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={addPoint}>
                <Plus size={18} />
                Adicionar Ponto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualização 3D */}
      {show3DScene && (
        <Scene3D 
          pointData={show3DScene} 
          onClose={() => setShow3DScene(null)} 
        />
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:wght@300;400;600&family=MedievalSharp&family=Uncial+Antiqua&family=IM+Fell+English:ital@0;1&family=Metamorphous&family=Grenze:wght@400;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .rpg-container {
          width: 100%;
          height: 100vh;
          font-family: 'Crimson Pro', serif;
          background: linear-gradient(135deg, #0c0918 0%, #241a42 100%);
          color: #e4dcf5;
          position: relative;
          overflow: hidden;
        }

        .parchment-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            repeating-linear-gradient(90deg, rgba(74, 58, 122, 0.05) 0px, transparent 1px, transparent 2px, rgba(74, 58, 122, 0.05) 3px),
            repeating-linear-gradient(0deg, rgba(74, 58, 122, 0.05) 0px, transparent 1px, transparent 2px, rgba(74, 58, 122, 0.05) 3px);
          opacity: 0.3;
          pointer-events: none;
        }

        .header {
          background: linear-gradient(180deg, rgba(21, 15, 40, 0.95) 0%, rgba(21, 15, 40, 0.85) 100%);
          border-bottom: 3px solid #d4af37;
          box-shadow: 0 4px 20px rgba(212, 175, 55, 0.2);
          position: relative;
          z-index: 10;
        }

        .header-content {
          max-width: 1800px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo svg {
          color: #d4af37;
          filter: drop-shadow(0 2px 4px rgba(212, 175, 55, 0.5));
        }

        .logo h1 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: #d4af37;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          letter-spacing: 1px;
        }

        .header-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(74, 58, 122, 0.3);
          border: 2px solid #4a3a7a;
          border-radius: 8px;
          color: #e4dcf5;
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mode-btn:hover {
          background: rgba(74, 58, 122, 0.5);
          border-color: #d4af37;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
        }

        .mode-btn.active {
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border-color: #d4af37;
          color: #150f28;
          box-shadow: 0 4px 16px rgba(212, 175, 55, 0.5);
        }

        .user-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.3);
        }

        .tab-nav {
          display: flex;
          gap: 0.5rem;
          max-width: 1800px;
          margin: 0 auto;
          padding: 0 2rem 0.75rem;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          background: rgba(0, 0, 0, 0.25);
          border: 2px solid rgba(74, 58, 122, 0.6);
          border-bottom: none;
          border-radius: 8px 8px 0 0;
          color: #9a8fc4;
          font-family: 'Cinzel', serif;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .tab-btn:hover {
          color: #e4dcf5;
          background: rgba(74, 58, 122, 0.3);
        }

        .tab-btn.active {
          color: #150f28;
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border-color: #d4af37;
          box-shadow: 0 -2px 12px rgba(212, 175, 55, 0.4);
        }

        .sheet-area {
          flex: 1;
          position: relative;
          overflow-y: auto;
          background: radial-gradient(circle at center, #150f28 0%, #0c0918 100%);
        }

        .sheet-sidebar {
          width: 320px;
          background: linear-gradient(180deg, rgba(21, 15, 40, 0.95) 0%, rgba(15, 10, 31, 0.95) 100%);
          border-left: 3px solid #4a3a7a;
          padding: 1.5rem;
          overflow-y: auto;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
        }

        .status-player-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .status-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .status-avatar-img,
        .status-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d4af37;
        }

        .status-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          color: #7a6ea3;
        }

        .status-avatar-upload-btn {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #d4af37;
          color: #150f28;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #0c0918;
        }

        .status-avatar-upload-btn input {
          display: none;
        }

        .group-status-area {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          background: radial-gradient(circle at center, #150f28 0%, #0c0918 100%);
        }

        .group-status-empty {
          height: 100%;
        }

        .group-status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .group-status-card {
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(212, 175, 55, 0.35);
          border-radius: 12px;
          padding: 1.1rem;
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          transform-style: preserve-3d;
        }

        .group-status-card:hover {
          transform: perspective(600px) rotateX(2deg) rotateY(-3deg) translateY(-3px);
          border-color: rgba(127, 212, 193, 0.5);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(127, 212, 193, 0.15);
        }

        .group-status-card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        }

        .group-status-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d4af37;
          flex-shrink: 0;
        }

        .group-status-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(74, 58, 122, 0.3);
          color: #7a6ea3;
        }

        .group-status-card-header h4 {
          font-family: 'Cinzel', serif;
          color: #e4dcf5;
          font-size: 1rem;
        }

        .group-status-bars {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* --- Animações de dano/cura no Status do Grupo --- */

        .bar-float-text {
          position: absolute;
          left: 50%;
          bottom: 100%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 1rem;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
          pointer-events: none;
          white-space: nowrap;
          animation: floatUpFade 1.6s ease-out forwards;
          z-index: 3;
        }

        .bar-float-damage {
          color: #ff4d4d;
        }

        .bar-float-heal {
          color: #4dff8f;
        }

        @keyframes floatUpFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.8); }
          15% { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.15); }
          70% { opacity: 1; transform: translateX(-50%) translateY(-22px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-34px) scale(0.95); }
        }

        .bar-flash-damage {
          animation: barFlashDamage 0.5s ease-out;
        }

        .bar-flash-heal {
          animation: barFlashHeal 0.5s ease-out;
        }

        @keyframes barFlashDamage {
          0%, 100% { box-shadow: none; }
          25% { box-shadow: 0 0 0 3px rgba(255, 60, 60, 0.7); }
        }

        @keyframes barFlashHeal {
          0%, 100% { box-shadow: none; }
          25% { box-shadow: 0 0 0 3px rgba(80, 255, 140, 0.7); }
        }

        .card-hit-shake {
          animation: cardHitShake 0.4s ease-in-out;
        }

        @keyframes cardHitShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        .bar-down-badge {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.7rem;
          filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
          z-index: 2;
        }

        .status-bars-panel {
          max-width: 1000px;
          margin: 0 auto 1.5rem;
          padding: 1.25rem 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(212, 175, 55, 0.35);
          border-radius: 12px;
        }

        .status-bars-panel h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: 'Cinzel', serif;
          color: #d4af37;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.75rem;
        }

        .status-bars-hint {
          color: #9a8fc4;
          font-size: 0.85rem;
          margin-bottom: 0.75rem;
        }

        .status-bars-hint strong {
          color: #d4af37;
        }

        .status-name-row,
        .status-master-select-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .status-name-row input,
        .status-master-select-row select {
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-size: 0.9rem;
        }

        .status-master-select-row {
          margin-bottom: 1rem;
          color: #9a8fc4;
          font-size: 0.85rem;
        }

        .status-master-select-row select {
          flex: 1;
          max-width: 260px;
        }

        .status-bar-list {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          margin-bottom: 1rem;
        }

        .status-bar-row {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .status-bar-top {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .status-bar-label {
          color: #e4dcf5;
          font-weight: 600;
        }

        .status-bar-numbers {
          color: #9a8fc4;
        }

        .status-bar-track {
          position: relative;
          width: 100%;
          height: 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 8px;
          overflow: visible;
        }

        .status-bar-fill {
          height: 100%;
          border-radius: 7px;
          transition: width 0.3s ease;
        }

        .status-bar-controls {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .status-bar-controls button {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(74, 58, 122, 0.3);
          border: 1px solid #4a3a7a;
          border-radius: 4px;
          color: #e4dcf5;
          cursor: pointer;
        }

        .status-bar-controls button:hover {
          background: rgba(74, 58, 122, 0.5);
          border-color: #d4af37;
        }

        .status-bar-controls input[type="number"] {
          width: 60px;
          padding: 0.3rem;
          text-align: center;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 4px;
          color: #e4dcf5;
          font-size: 0.85rem;
        }

        .status-bar-quick {
          width: auto !important;
          padding: 0 0.5rem;
          font-size: 0.7rem;
        }

        .status-bar-remove {
          margin-left: auto;
          background: rgba(139, 0, 0, 0.25) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .status-bar-remove:hover {
          background: rgba(139, 0, 0, 0.5) !important;
        }

        .status-bar-add-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(212, 175, 55, 0.2);
        }

        .status-bar-add-row input[type="text"] {
          flex: 1;
          min-width: 160px;
          padding: 0.5rem 0.7rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-size: 0.85rem;
        }

        .status-bar-add-row input[type="color"] {
          width: 40px;
          height: 36px;
          padding: 2px;
          background: transparent;
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          cursor: pointer;
        }

        .status-bar-max-input {
          width: 70px !important;
          flex: none !important;
        }


          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .sheet-master-toolbar {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .save-status {
          position: sticky;
          top: 0;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.75rem;
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          font-family: 'Crimson Pro', serif;
          font-size: 0.8rem;
          transition: opacity 0.3s ease;
          min-height: 1.6rem;
        }

        .save-status-idle {
          opacity: 0;
          pointer-events: none;
        }

        .save-status-saving {
          background: rgba(74, 58, 122, 0.3);
          color: #d4af37;
        }

        .save-status-saved {
          background: rgba(34, 139, 34, 0.2);
          color: #7ed17e;
        }

        .sheet-tool-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.1rem;
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border: 2px solid #d4af37;
          border-radius: 8px;
          color: #150f28;
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .sheet-tool-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(212, 175, 55, 0.4);
        }

        .font-picker-panel {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 10px;
        }

        .font-swatch-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.9rem 0.5rem;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          color: #e4dcf5;
          font-size: 1.3rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .font-swatch-btn:hover {
          background: rgba(74, 58, 122, 0.4);
          border-color: #d4af37;
        }

        .font-swatch-btn.active {
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.15);
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
        }

        .font-swatch-btn small {
          font-family: 'Crimson Pro', serif;
          font-size: 0.7rem;
          color: #9a8fc4;
        }

        .field-builder-panel {
          margin-bottom: 1.5rem;
          padding: 1.25rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 10px;
        }

        .field-builder-panel h4 {
          font-family: 'Cinzel', serif;
          color: #d4af37;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.85rem;
        }

        .field-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .field-type-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 0.7rem;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .field-type-btn:hover {
          background: rgba(74, 58, 122, 0.4);
        }

        .field-type-btn.active {
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border-color: #d4af37;
          color: #150f28;
        }

        .field-add-row {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }

        .field-add-row input {
          flex: 1;
          padding: 0.6rem 0.85rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-size: 0.9rem;
        }

        .field-add-row input:focus {
          outline: none;
          border-color: #d4af37;
        }

        .field-add-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1rem;
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border: none;
          border-radius: 6px;
          color: #150f28;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
        }

        .field-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .field-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .field-list-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.6rem;
          background: rgba(74, 58, 122, 0.15);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 6px;
        }

        .field-list-icon {
          color: #d4af37;
          flex-shrink: 0;
        }

        .field-list-label-input {
          flex: 1;
          padding: 0.35rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 4px;
          color: #e4dcf5;
          font-size: 0.85rem;
          min-width: 100px;
        }

        .field-list-label-input:focus {
          outline: none;
          border-color: #d4af37;
        }

        .field-list-type {
          font-size: 0.72rem;
          color: #7a6ea3;
          white-space: nowrap;
        }

        .field-list-row button {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #4a3a7a;
          border-radius: 4px;
          color: #e4dcf5;
          cursor: pointer;
          flex-shrink: 0;
        }

        .field-list-row button:hover:not(:disabled) {
          background: rgba(74, 58, 122, 0.5);
          border-color: #d4af37;
        }

        .field-list-row button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .field-remove-btn {
          background: rgba(139, 0, 0, 0.25) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .field-remove-btn:hover {
          background: rgba(139, 0, 0, 0.5) !important;
        }

        .field-tab-input {
          width: 130px !important;
          flex: none !important;
        }

        .field-list-tab-input {
          width: 100px;
          padding: 0.35rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 4px;
          color: #9a8fc4;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .field-list-tab-input:focus {
          outline: none;
          border-color: #d4af37;
          color: #e4dcf5;
        }

        .sheet-subtab-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid rgba(212, 175, 55, 0.25);
        }

        .sheet-subtab-btn {
          padding: 0.5rem 1.1rem;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 20px;
          color: #9a8fc4;
          font-family: 'Cinzel', serif;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .sheet-subtab-btn:hover {
          background: rgba(74, 58, 122, 0.4);
          color: #e4dcf5;
        }

        .sheet-subtab-btn.active {
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border-color: #d4af37;
          color: #150f28;
          font-weight: 700;
        }

        .sheet-fields-area {
          min-height: 200px;
        }

        .sheet-fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        .sheet-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(74, 58, 122, 0.5);
          border-radius: 10px;
        }

        .sheet-field-textarea,
        .sheet-field-image,
        .sheet-field-list,
        .sheet-field-attack,
        .sheet-field-checklist {
          grid-column: span 2;
        }

        .sheet-field label {
          color: #d4af37;
          font-size: 1rem;
          letter-spacing: 0.5px;
        }

        .sheet-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sheet-field-remove-mini {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 4px;
          color: #ff6b6b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .sheet-field-remove-mini:hover {
          background: rgba(139, 0, 0, 0.5);
        }

        .extra-field-builder {
          grid-column: 1 / -1;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px dashed rgba(212, 175, 55, 0.3);
        }

        .sheet-field input[type="text"],
        .sheet-field input[type="number"],
        .sheet-field textarea {
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-size: 0.95rem;
          font-family: 'Crimson Pro', serif;
          resize: vertical;
        }

        .sheet-field input:focus,
        .sheet-field textarea:focus {
          outline: none;
          border-color: #d4af37;
        }

        .sheet-field-image {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .sheet-field-image img {
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 8px;
          border: 2px solid #d4af37;
        }

        .sheet-field-image-placeholder {
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 2px dashed rgba(212, 175, 55, 0.4);
          border-radius: 8px;
          color: #7a6ea3;
        }

        .sheet-image-upload-btn {
          font-size: 0.8rem;
          padding: 0.5rem 1rem;
        }

        .sheet-field-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sheet-list-item {
          display: flex;
          gap: 0.5rem;
        }

        .sheet-list-item input {
          flex: 1;
          padding: 0.5rem 0.7rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
        }

        .sheet-list-item input:focus {
          outline: none;
          border-color: #d4af37;
        }

        .sheet-list-item button {
          width: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 6px;
          color: #ff6b6b;
          cursor: pointer;
        }

        .sheet-list-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.5rem;
          background: rgba(74, 58, 122, 0.2);
          border: 1px dashed rgba(212, 175, 55, 0.4);
          border-radius: 6px;
          color: #d4af37;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .sheet-list-add-btn:hover {
          background: rgba(74, 58, 122, 0.4);
        }

        .formula-input {
          min-width: 180px;
        }

        .sheet-field-formula {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
        }

        .formula-result {
          font-family: 'Cinzel', serif;
          font-size: 1.3rem;
          font-weight: 700;
          color: #d4af37;
        }

        .formula-expr {
          font-size: 0.75rem;
          color: #7a6ea3;
          font-family: 'Crimson Pro', serif;
        }

        .sheet-field-attack {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .attack-inputs-row {
          display: flex;
          gap: 1rem;
        }

        .attack-mini-label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.72rem;
          color: #9a8fc4;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .attack-mini-label input {
          padding: 0.45rem 0.6rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
          width: 90px;
        }

        .attack-roll-row {
          display: flex;
          gap: 0.6rem;
        }

        .attack-roll-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.8rem;
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border: none;
          border-radius: 6px;
          color: #150f28;
          font-weight: 700;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .attack-roll-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .attack-dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .attack-result-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8rem;
          color: #e4dcf5;
          padding-top: 0.4rem;
          border-top: 1px dashed rgba(212, 175, 55, 0.25);
        }

        .attack-result-row strong {
          color: #d4af37;
        }

        .sheet-field-checklist {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .checklist-item-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .checklist-item-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #d4af37;
          flex-shrink: 0;
        }

        .checklist-item-row input[type="text"] {
          flex: 1;
          padding: 0.45rem 0.65rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
        }

        .checklist-text-done {
          text-decoration: line-through;
          opacity: 0.55;
        }

        .checklist-item-row button {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 6px;
          color: #ff6b6b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .dice-roller h3 {
          font-family: 'Cinzel', serif;
          font-size: 1.1rem;
          color: #d4af37;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pouch-btn {
          margin-left: auto;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(74, 58, 122, 0.25);
          border: 2px solid rgba(212, 175, 55, 0.4);
          border-radius: 8px;
          color: #d4af37;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .pouch-btn:hover {
          background: rgba(74, 58, 122, 0.5);
          border-color: #d4af37;
          transform: scale(1.05);
        }

        .pouch-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 10px;
        }

        .pouch-skin-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.4rem;
          background: transparent;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pouch-skin-btn:hover:not(:disabled) {
          background: rgba(74, 58, 122, 0.25);
        }

        .pouch-skin-btn.active {
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.15);
        }

        .pouch-skin-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pouch-skin-btn img {
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(212, 175, 55, 0.4);
        }

        .pouch-skin-btn span {
          font-size: 0.68rem;
          color: #b3a8d6;
          text-align: center;
        }

        .pouch-check {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #d4af37;
          color: #150f28;
          border-radius: 50%;
          padding: 1px;
        }

        .dice-formula-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          min-height: 2.2rem;
        }

        .dice-formula-empty {
          font-size: 0.85rem;
          color: #7a6ea3;
          font-style: italic;
        }

        .dice-term-chip {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.4rem;
          background: rgba(74, 58, 122, 0.25);
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 20px;
        }

        .term-sign {
          color: #d4af37;
          font-weight: 700;
          font-size: 0.9rem;
          padding-left: 0.15rem;
        }

        .dice-term-chip button {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #4a3a7a;
          border-radius: 50%;
          color: #e4dcf5;
          font-weight: 700;
          font-size: 0.8rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }

        .dice-term-chip button:hover:not(:disabled) {
          background: rgba(74, 58, 122, 0.5);
          border-color: #d4af37;
        }

        .dice-term-chip button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .term-label {
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          font-weight: 600;
          color: #e4dcf5;
          min-width: 2.4rem;
          text-align: center;
        }

        .term-remove {
          background: rgba(139, 0, 0, 0.3) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .term-remove:hover:not(:disabled) {
          background: rgba(139, 0, 0, 0.6) !important;
        }

        .dice-op-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-size: 0.8rem;
          color: #9a8fc4;
        }

        .dice-op-toggle button {
          width: 28px;
          height: 28px;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .dice-op-toggle button:hover:not(:disabled) {
          background: rgba(74, 58, 122, 0.4);
          border-color: #d4af37;
        }

        .dice-op-toggle button.active {
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border-color: #d4af37;
          color: #150f28;
        }

        .dice-type-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .dice-type-btn {
          padding: 0.5rem 0.25rem;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-family: 'Cinzel', serif;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .dice-type-btn:hover:not(:disabled) {
          background: rgba(74, 58, 122, 0.4);
          border-color: #d4af37;
        }

        .dice-type-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dice-display-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.25rem;
        }

        .dice-multi-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: flex-start;
          gap: 0.6rem;
        }

        .dice-face-3d {
          position: relative;
          width: 150px;
          height: 150px;
          background: linear-gradient(135deg, #241a42 0%, #150f28 100%);
          border: 3px solid #d4af37;
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(212, 175, 55, 0.12);
          overflow: hidden;
        }

        .dice-face-3d-empty {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dice-face-3d-empty .dice-face-label {
          position: static;
          transform: none;
        }

        .dice-face-3d-mini {
          width: 84px;
          height: 84px;
          border-width: 2px;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .dice-mini-sign {
          position: absolute;
          top: -2px;
          left: -8px;
          z-index: 2;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #d4af37;
          color: #150f28;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .dice-3d-canvas {
          width: 100%;
          height: 100%;
        }

        .dice-3d-canvas canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
        }

        .dice-face-label {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-size: 0.75rem;
          color: #9a8fc4;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
          pointer-events: none;
        }

        .dice-face-3d-mini .dice-face-label {
          top: 4px;
          font-size: 0.55rem;
        }

        .dice-face-value {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #d4af37;
          text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.9);
          background: rgba(0, 0, 0, 0.4);
          padding: 0.1rem 0.7rem;
          border-radius: 6px;
          pointer-events: none;
          transition: color 0.1s ease;
        }

        .dice-face-value-mini {
          bottom: 3px;
          font-size: 0.75rem;
          padding: 0.05rem 0.4rem;
        }

        .dice-total-line {
          font-family: 'Cinzel', serif;
          font-size: 1rem;
          color: #9a8fc4;
        }

        .dice-total-line strong {
          color: #d4af37;
          font-size: 1.2rem;
        }

        .dice-face-value.flicker {
          color: #ff9d2e;
        }

        .dice-breakdown {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: #9a8fc4;
          text-align: center;
        }

        .dice-breakdown-part {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .breakdown-sign {
          color: #d4af37;
          font-weight: 700;
        }

        .roll-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.85rem;
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border: 2px solid #d4af37;
          border-radius: 8px;
          color: #150f28;
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .roll-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(212, 175, 55, 0.5);
        }

        .roll-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .roll-btn .spin {
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .dice-history {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(74, 58, 122, 0.3);
        }

        .dice-history h4 {
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          color: #9a8fc4;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.6rem;
        }

        .dice-history-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #e4dcf5;
          padding: 0.4rem 0;
          border-bottom: 1px dashed rgba(74, 58, 122, 0.3);
        }

        .dice-history-item strong {
          color: #d4af37;
        }

        .main-content {
          display: flex;
          height: calc(100vh - 80px);
          position: relative;
          z-index: 1;
        }

        .sidebar {
          width: 320px;
          background: linear-gradient(180deg, rgba(21, 15, 40, 0.95) 0%, rgba(15, 10, 31, 0.95) 100%);
          border-right: 3px solid #4a3a7a;
          padding: 1.5rem;
          overflow-y: auto;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
        }

        .sidebar-section {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(74, 58, 122, 0.3);
        }

        .sidebar-section:last-child {
          border-bottom: none;
        }

        .sidebar-section h3 {
          font-family: 'Cinzel', serif;
          font-size: 1.1rem;
          color: #d4af37;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          background: linear-gradient(135deg, #4a3a7a 0%, #2e2354 100%);
          border: 2px solid #d4af37;
          border-radius: 8px;
          color: #e4dcf5;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
        }

        .upload-btn:hover {
          background: linear-gradient(135deg, #6654a0 0%, #4a3a7a 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
        }

        .upload-btn input {
          display: none;
        }

        .points-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .point-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: rgba(74, 58, 122, 0.2);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          transition: all 0.3s ease;
        }

        .point-item:hover {
          background: rgba(74, 58, 122, 0.4);
          border-color: #d4af37;
          transform: translateX(4px);
        }

        .point-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          flex: 1;
        }

        .point-info div {
          display: flex;
          flex-direction: column;
        }

        .point-info strong {
          font-size: 0.95rem;
          color: #e4dcf5;
        }

        .point-info small {
          font-size: 0.8rem;
          color: #9a8fc4;
          text-transform: capitalize;
        }

        .delete-btn {
          background: rgba(139, 0, 0, 0.3);
          border: 1px solid #8b0000;
          border-radius: 4px;
          padding: 0.4rem;
          color: #ff6b6b;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .delete-btn:hover {
          background: rgba(139, 0, 0, 0.6);
          transform: scale(1.1);
        }

        .controls-info {
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .controls-info p {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .zoom-indicator {
          margin-top: 1rem;
          text-align: center;
          font-size: 1.1rem;
          font-weight: 600;
          color: #d4af37;
          padding: 0.5rem;
          background: rgba(212, 175, 55, 0.1);
          border-radius: 4px;
        }

        .canvas-area {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at center, #150f28 0%, #0c0918 100%);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: #7a6ea3;
        }

        .empty-state svg {
          opacity: 0.3;
        }

        .empty-state h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          color: #9a8fc4;
        }

        .canvas-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .map-canvas {
          transform-origin: center;
          transition: transform 0.1s ease-out;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
          border: 4px solid #4a3a7a;
          border-radius: 4px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal {
          background: linear-gradient(180deg, #150f28 0%, #0f0a1f 100%);
          border: 3px solid #d4af37;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { 
            transform: translateY(50px);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 2px solid #4a3a7a;
        }

        .modal-header h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.5rem;
          color: #d4af37;
        }

        .modal-header button {
          background: transparent;
          border: none;
          color: #e4dcf5;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-header button:hover {
          color: #d4af37;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #d4af37;
          font-family: 'Cinzel', serif;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #d4af37;
          background: rgba(74, 58, 122, 0.3);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .type-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(74, 58, 122, 0.2);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 6px;
          color: #e4dcf5;
          font-family: 'Crimson Pro', serif;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .type-btn:hover {
          background: rgba(74, 58, 122, 0.4);
          border-color: var(--type-color);
          transform: translateY(-2px);
        }

        .type-btn.active {
          background: var(--type-color);
          border-color: var(--type-color);
          color: #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 2px solid #4a3a7a;
        }

        .btn-secondary,
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-family: 'Crimson Pro', serif;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-secondary {
          background: rgba(74, 58, 122, 0.3);
          border: 2px solid #4a3a7a;
          color: #e4dcf5;
        }

        .btn-secondary:hover {
          background: rgba(74, 58, 122, 0.5);
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #d4af37 0%, #c9a961 100%);
          border: 2px solid #d4af37;
          color: #150f28;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #e0bf47 0%, #d4af37 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(212, 175, 55, 0.5);
        }

        .scene-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.3s ease;
        }

        .scene-container {
          width: 90%;
          height: 90%;
          max-width: 1200px;
          background: linear-gradient(180deg, #150f28 0%, #0f0a1f 100%);
          border: 4px solid #d4af37;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.9);
        }

        .scene-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: rgba(21, 15, 40, 0.8);
          border-bottom: 2px solid #4a3a7a;
        }

        .scene-header h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          color: #d4af37;
          margin-bottom: 0.5rem;
        }

        .scene-header p {
          color: #9a8fc4;
          font-size: 1rem;
        }

        .close-btn {
          background: rgba(139, 0, 0, 0.3);
          border: 2px solid #8b0000;
          border-radius: 6px;
          padding: 0.5rem;
          color: #ff6b6b;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .close-btn:hover {
          background: rgba(139, 0, 0, 0.6);
          transform: rotate(90deg);
        }

        .scene-canvas {
          flex: 1;
          background: radial-gradient(circle at center, #0c0918 0%, #000 100%);
        }

        .scene-footer {
          padding: 1rem 1.5rem;
          background: rgba(21, 15, 40, 0.8);
          border-top: 2px solid #4a3a7a;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .scene-type {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: rgba(212, 175, 55, 0.2);
          border: 1px solid #d4af37;
          border-radius: 20px;
          color: #d4af37;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.9rem;
          letter-spacing: 1px;
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(21, 15, 40, 0.3);
        }

        ::-webkit-scrollbar-thumb {
          background: #4a3a7a;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #d4af37;
        }
      `}</style>
    </div>
  );
};

export default RPGMapExplorer;
