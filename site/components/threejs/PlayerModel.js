"use client";
import { useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import createToonGradient from "../../utils/createToonGradient";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import { socketManager } from "../../utils/socketManager";
import { loadPlayerModel, getPlayerModelClone, getCachedAnimations, setCachedModel } from "../../utils/playerCloning";

// Debug helper for raycasting
const DebugRaycast = ({ start, end, color = 0xff0000, enabled = false }) => {
  if (!enabled) return null;
  
  // Create points for line
  const points = [start, end].map(p => new THREE.Vector3(p.x, p.y, p.z));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  // Return the debug line
  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} />
    </line>
  );
};

export default function PlayerModel({ 
  onLoad, 
  moveState, 
  containerRef, 
  hasEnteredNeighborhood,
  rotationRef,
  pitchRef
}) {
  const toonGradient = useMemo(() => createToonGradient(), []);
  const onLoadCalledRef = useRef(false);
  
  // Initialize socket connection as early as possible
  useEffect(() => {
    // Ensure socket is connected when the component mounts
    if (!socketManager.connected) {
      console.log('Initializing socket connection from PlayerModel');
      socketManager.connect();
    }
    
    return () => {
      // No need to disconnect on unmount - keep connection alive
    };
  }, []);
  
  // Load the model using useGLTF hook
  const { scene: rawModel, animations } = useGLTF('/models/player.glb');
  
  // Scene access for raycasting
  const { scene } = useThree();
  
  // Set the cached model on first load
  useEffect(() => {
    if (rawModel && animations) {
      setCachedModel(rawModel, animations);
    }
  }, [rawModel, animations]);
  
  // Memoize the player model to prevent recreation on every frame
  const playerModel = useMemo(() => {
    if (!rawModel) return null;
    return getPlayerModelClone(rawModel, toonGradient);
  }, [rawModel, toonGradient]);

  const { actions, mixer } = useAnimations(animations, playerModel);
  const currentAnimRef = useRef(null);
  const primitiveRef = useRef();
  const rigidBodyRef = useRef();
  const runningRef = useRef(false);
  const { rapier, world } = useRapier();
  const isGroundedRef = useRef(false);
  const jumpCooldownRef = useRef(0);
  const { camera, gl } = useThree();
  const debug = true;
  
  // Mouse control
  const canvasRef = useRef(null);
  
  // Performance optimization for physics
  const lastPhysicsUpdate = useRef(0);
  const lastNetworkUpdate = useRef(0);
  const PHYSICS_UPDATE_INTERVAL = 1000 / 60; // Target 60 fps for physics
  const NETWORK_UPDATE_INTERVAL = 1000 / 10; // Reduced from 20 to 10 fps for network updates
  
  // Cache vectors to prevent garbage collection
  const moveDir = useMemo(() => new THREE.Vector3(), []);
  const targetVelocity = useMemo(() => new THREE.Vector3(), []);
  const rayOrigin = useMemo(() => new THREE.Vector3(), []);
  const rayDir = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const sideDir = useMemo(() => new THREE.Vector3(), []);
  const cameraPos = useMemo(() => new THREE.Vector3(), []);
  const lookAtPos = useMemo(() => new THREE.Vector3(), []);
  
  // Movement constants
  const MOVE_SPEED = 12;
  const JUMP_FORCE = 12;
  const CHARACTER_HEIGHT = 0.6;
  const DAMPING = 0.85;
  const LERP_FACTOR = 0.2;
  const GROUND_CHECK_DISTANCE = 1.5;
  const JUMP_COOLDOWN = 800;
  const GROUND_THRESHOLD = 0.7;
  
  // Camera settings
  const CAMERA_DISTANCE = 12;  // Increased distance (was 7)
  const CAMERA_HEIGHT = 4;    // Moderate height
  const MOUSE_SENSITIVITY = 0.002;
  const PITCH_LIMIT = Math.PI/3; // Limit vertical rotation to 60 degrees
  const MIN_CAMERA_DISTANCE = 2.0; // Minimum distance to maintain from player
  
  // Camera collision prevention
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const idealCameraPosition = useMemo(() => new THREE.Vector3(), []);
  const raycastFilterRef = useRef(new Set());
  const lastCameraPos = useRef(new THREE.Vector3());
  const CAMERA_LERP_FACTOR = 0.2; // Smoothing factor
  
  // Debug state for camera collisions
  const [debugRaycast, setDebugRaycast] = useState({ 
    start: new THREE.Vector3(), 
    end: new THREE.Vector3(),
    hit: new THREE.Vector3()
  });
  const debugEnabled = false; // Set to true to enable visual debugging
  
  const log = (...args) => {
    if (debug) {
      console.log('[PlayerModel]', ...args);
    }
  };
  
  // Basic mouse movement handling without pointer lock dependencies
  useEffect(() => {
    canvasRef.current = gl.domElement;
    
    // Direct mouse movement handler
    const handleMouseMove = (e) => {
      // Only process mouse movement if hasEnteredNeighborhood is true
      if (hasEnteredNeighborhood && document.pointerLockElement === canvasRef.current) {
        // Pointer is locked - use movementX/Y directly
        const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
        
        // Apply horizontal rotation (yaw)
        rotationRef.current -= movementX * MOUSE_SENSITIVITY;
        
        // Apply vertical rotation (pitch) with limits
        pitchRef.current += movementY * MOUSE_SENSITIVITY;
        
        // Apply limits to prevent over-rotation
        pitchRef.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitchRef.current));
      }
    };
    
    // Capture click to make control more responsive
    const handleClick = (e) => {
      console.log('Click detected in PlayerModel', {
        target: e.target,
        isUIElement: !!e.target.closest('[data-ui-element="true"]'),
        pointerLocked: document.pointerLockElement === canvasRef.current,
        eventPhase: e.eventPhase
      });

      // Check if we clicked on a UI element
      const isUIElement = e.target.closest('[data-ui-element="true"]');
      
      if (isUIElement) {
        console.log('UI element clicked, releasing pointer lock');
        // If clicking UI, ensure pointer is unlocked
        if (document.pointerLockElement === canvasRef.current) {
          document.exitPointerLock();
          console.log('Pointer lock released');
        }
        return; // Let the click event propagate to the UI element
      }
      
      // Only request pointer lock if we're in the neighborhood and clicked outside UI
      if (canvasRef.current && hasEnteredNeighborhood && !isUIElement) {
        try {
          console.log('Requesting pointer lock');
          canvasRef.current.requestPointerLock();
        } catch (error) {
          console.error('Pointer lock request failed:', error);
        }
      }
    };

    // Handle pointer lock change
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === canvasRef.current;
      console.log('Pointer lock changed:', { isLocked });
      // You might want to update some state here if needed
      if (!isLocked) {
        // Reset any necessary state when pointer lock is released
      }
    };
    
    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true); // Use capture phase
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    
    // Initial request - but don't auto-lock if there's UI interaction
    setTimeout(() => {
      if (canvasRef.current && hasEnteredNeighborhood && !document.querySelector('[data-ui-element="true"]:hover')) {
        canvasRef.current.requestPointerLock();
      }
    }, 500);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gl, hasEnteredNeighborhood]);
  
  // Configure animations on first load
  useEffect(() => {
    if (!playerModel || !mixer || !actions || Object.keys(actions).length === 0) {
      log('Waiting for model/animations to be ready');
      return;
    }
    
    const idleAnimName = Object.keys(actions).find(name => 
      name.toLowerCase().includes('idle')
    );
    
    const runAnimName = Object.keys(actions).find(name => 
      name.toLowerCase().includes('run')
    );
    
    if (!idleAnimName || !runAnimName) {
      log('Could not find required animations');
      return;
    }
    
    // Only configure animations once
    if (!onLoadCalledRef.current) {
      [idleAnimName, runAnimName].forEach(name => {
        const action = actions[name];
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;
      });
      
      actions[idleAnimName].play();
      currentAnimRef.current = 'idle';
      
      // Call onLoad to signal component is ready
      onLoadCalledRef.current = true;
      onLoad?.();
    }
  }, [playerModel, actions, mixer, onLoad]);
  
  // Memoized animation name lookups for performance
  const animationNames = useMemo(() => {
    if (!actions) return { idle: null, run: null };
    
    const idleAnimName = Object.keys(actions).find(name => 
      name.toLowerCase().includes('idle')
    );
    
    const runAnimName = Object.keys(actions).find(name => 
      name.toLowerCase().includes('run')
    );
    
    return { idle: idleAnimName, run: runAnimName };
  }, [actions]);
  
  // Calculate perpendicular strafing direction
  const getStrafeDirection = (forward, side) => {
    const strafeDir = new THREE.Vector3(-forward.z, 0, forward.x);
    strafeDir.multiplyScalar(side);
    return strafeDir;
  };
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !containerRef.current) return;

    const now = performance.now();
    
    // Update jump cooldown
    if (jumpCooldownRef.current > 0) {
      jumpCooldownRef.current = Math.max(0, jumpCooldownRef.current - (now - lastPhysicsUpdate.current));
    }
    
    const shouldUpdatePhysics = now - lastPhysicsUpdate.current >= PHYSICS_UPDATE_INTERVAL;
    const shouldUpdateNetwork = now - lastNetworkUpdate.current >= NETWORK_UPDATE_INTERVAL;
    
    if (shouldUpdatePhysics) {
      lastPhysicsUpdate.current = now;
      
      const rigidBody = rigidBodyRef.current;
      const currentVel = rigidBody.linvel();
      const pos = rigidBody.translation();

      // Apply player rotation based on neighborhood state
      if (hasEnteredNeighborhood) {
        // Apply player rotation from mouse movement
        containerRef.current.rotation.y = rotationRef.current;
        
        if (primitiveRef.current) {
          primitiveRef.current.rotation.y = rotationRef.current - Math.PI/2;
        }
        
        // Camera positioning for gameplay
        const direction = new THREE.Vector3(
          -Math.sin(rotationRef.current),
          Math.sin(pitchRef.current),
          -Math.cos(rotationRef.current)
        );
        direction.normalize();
        
        // Calculate ideal camera position
        idealCameraPosition.set(
          pos.x + direction.x * CAMERA_DISTANCE * Math.cos(pitchRef.current),
          pos.y + CAMERA_HEIGHT + direction.y * CAMERA_DISTANCE,
          pos.z + direction.z * CAMERA_DISTANCE * Math.cos(pitchRef.current)
        );
        
        // Set up raycaster from player position to ideal camera position
        const playerPosition = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
        const cameraDirection = new THREE.Vector3().subVectors(idealCameraPosition, playerPosition).normalize();
        raycaster.set(playerPosition, cameraDirection);
        
        // Update debug raycast data if enabled
        if (debugEnabled) {
          setDebugRaycast({
            start: playerPosition.clone(),
            end: idealCameraPosition.clone(),
            hit: null
          });
        }
        
        // Perform raycast and get the real camera position
        raycaster.set(playerPosition, cameraDirection);
        let intersects = [];
        
        try {
          // Make sure scene is valid before attempting to raycast
          if (scene && Array.isArray(scene.children)) {
            intersects = raycaster.intersectObjects(scene.children, true)
              .filter(hit => {
                // Skip invalid hit objects
                if (!hit || !hit.object) return false;
                
                // Skip player model and other objects we want to ignore
                let obj = hit.object;
                while (obj) {
                  if (raycastFilterRef.current.has(obj)) return false;
                  obj = obj.parent;
                }
                
                // Skip objects with specific names or types we want to ignore
                // Such as clouds, invisible collision planes, etc.
                if (hit.object.name && (
                    hit.object.name.includes('cloud') || 
                    hit.object.name.includes('sky') ||
                    hit.object.userData?.ignoreRaycast)) {
                  return false;
                }
                
                return true;
              });
          }
        } catch (error) {
          console.error("Raycast error:", error);
        }
        
        // If there's an intersection between player and ideal camera position
        if (intersects && intersects.length > 0) {
          const firstHit = intersects[0];
          if (firstHit && typeof firstHit.distance === 'number') {
            const distanceToHit = firstHit.distance;
            
            // Update debug hit position if enabled
            if (debugEnabled && firstHit.point) {
              setDebugRaycast(prev => ({
                ...prev,
                hit: firstHit.point.clone()
              }));
            }
            
            // If hit distance is less than the ideal camera distance
            if (distanceToHit < playerPosition.distanceTo(idealCameraPosition)) {
              // Place camera slightly in front of the hit point (buffer of 0.5)
              const adjustedDistance = Math.max(distanceToHit - 0.5, MIN_CAMERA_DISTANCE);
              cameraPos.copy(playerPosition).add(cameraDirection.multiplyScalar(adjustedDistance));
            } else {
              // No obstruction, use ideal position
              cameraPos.copy(idealCameraPosition);
            }
          } else {
            // Invalid hit data, use ideal position
            cameraPos.copy(idealCameraPosition);
          }
        } else {
          // No obstruction, use ideal position
          cameraPos.copy(idealCameraPosition);
        }
        
        // Apply smoothing if we have a previous position
        if (lastCameraPos.current.lengthSq() > 0) {
          camera.position.lerpVectors(lastCameraPos.current, cameraPos, CAMERA_LERP_FACTOR);
        } else {
          camera.position.copy(cameraPos);
        }
        
        // Store current position for next frame
        lastCameraPos.current.copy(camera.position);
        
        lookAtPos.set(
          pos.x,
          pos.y + 1 + Math.sin(pitchRef.current) * 2,
          pos.z
        );
        
        camera.lookAt(lookAtPos);
      } else {
        // Make player face the camera when not in neighborhood
        const cameraPosition = camera.position;
        const directionToCamera = new THREE.Vector3(
          cameraPosition.x - pos.x,
          0,
          cameraPosition.z - pos.z
        ).normalize();
        
        const angleToCamera = Math.atan2(directionToCamera.x, directionToCamera.z);
        const rightwardOffset = -0.3;
        containerRef.current.rotation.y = angleToCamera + rightwardOffset;
        
        if (primitiveRef.current) {
          primitiveRef.current.rotation.y = angleToCamera - Math.PI/2 + rightwardOffset;
        }
      }
      
      // Calculate movement direction
      moveDir.set(0, 0, 0);
      
      if (moveState.w || moveState.s) {
        const angle = rotationRef.current;
        const moveZ = moveState.w ? 1 : -1;
        moveDir.x = Math.sin(angle) * moveZ;
        moveDir.z = Math.cos(angle) * moveZ;
      }
      
      if (moveState.a || moveState.d) {
        const angle = rotationRef.current;
        // D is right, A is left
        const moveSide = moveState.d ? -1 : 1;
        
        sideDir.set(
          Math.sin(angle + Math.PI/2) * moveSide,
          0,
          Math.cos(angle + Math.PI/2) * moveSide
        );
        
        moveDir.add(sideDir);
      }
      
      // Initialize new velocity with current values
      const newVelocity = { x: currentVel.x, y: currentVel.y, z: currentVel.z };
      
      // Apply horizontal movement or damping
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        const moveSpeed = MOVE_SPEED * (moveState.shift ? 1.5 : 1);
        targetVelocity.copy(moveDir).multiplyScalar(moveSpeed);
        
        newVelocity.x = currentVel.x + (targetVelocity.x - currentVel.x) * LERP_FACTOR;
        newVelocity.z = currentVel.z + (targetVelocity.z - currentVel.z) * LERP_FACTOR;
      } else {
        // Apply damping when not moving
        newVelocity.x = currentVel.x * DAMPING;
        newVelocity.z = currentVel.z * DAMPING;
      }

      // Ground detection
      rayOrigin.set(pos.x, pos.y, pos.z);
      const rayHit = world.castRay(
        new rapier.Ray(
          { x: pos.x, y: pos.y, z: pos.z },
          { x: 0, y: -1, z: 0 }
        ),
        GROUND_CHECK_DISTANCE,
        true
      );
      
      const rayDistance = rayHit ? rayHit.toi : GROUND_CHECK_DISTANCE;
      
      // Ground detection logic
      isGroundedRef.current = rayHit && rayHit.toi <= GROUND_THRESHOLD;
      
      // Also consider grounded if very close to zero velocity
      if (Math.abs(currentVel.y) < 0.1) {
        isGroundedRef.current = true;
      }
      
      // But never consider grounded when clearly moving upward
      if (currentVel.y > 1.0) {
        isGroundedRef.current = false;
      }
      
      // Jump handling
      if (moveState.space && jumpCooldownRef.current <= 0) {
        if (isGroundedRef.current) {
          // Apply jump force
          newVelocity.y = JUMP_FORCE;
          
          // Set cooldown
          jumpCooldownRef.current = JUMP_COOLDOWN;
          
          // Force not grounded immediately
          isGroundedRef.current = false;
        }
      }
      
      // Apply physics
      rigidBody.setLinvel(newVelocity, true);
      
      // Sync positions
      if (primitiveRef.current) {
        primitiveRef.current.position.set(pos.x, pos.y - CHARACTER_HEIGHT, pos.z);
      }
      
      if (containerRef.current) {
        containerRef.current.position.set(pos.x, pos.y, pos.z);
      }

      // Send position and movement state updates to server less frequently
      if (shouldUpdateNetwork && hasEnteredNeighborhood) {
        lastNetworkUpdate.current = now;
        
        const quaternion = new THREE.Quaternion();
        if (primitiveRef.current) {
          quaternion.setFromEuler(primitiveRef.current.rotation);
        }
        
        const position = { x: pos.x, y: pos.y, z: pos.z };
        const isMoving = moveState.w || moveState.s || moveState.a || moveState.d;
        
        // Only send updates if socket is connected and player is moving or position changed significantly
        const player = socketManager.players.get(socketManager.socket?.id);
        const hasPositionChanged = !player || 
          Math.abs(player.position.x - position.x) > 0.1 || 
          Math.abs(player.position.y - position.y) > 0.1 || 
          Math.abs(player.position.z - position.z) > 0.1;
          
        if (socketManager.connected && (isMoving || hasPositionChanged)) {
          socketManager.updateTransform(
            position,
            { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
            isMoving,
            moveState
          );
        }
      }
    }

    // Update animations
    if (!mixer || !actions) return;
    mixer.update(delta);
    
    const { idle: idleAnimName, run: runAnimName } = animationNames;
    if (!idleAnimName || !runAnimName) return;
    
    const isMoving = moveState.w || moveState.s || moveState.a || moveState.d;
    
    if (isMoving !== runningRef.current) {
      const runAction = actions[runAnimName];
      const idleAction = actions[idleAnimName];
      
      if (isMoving) {
        runAction.timeScale = moveState.shift ? 1.5 : 1.0;
        idleAction.fadeOut(0.2);
        runAction.reset().fadeIn(0.2).play();
        currentAnimRef.current = 'run';
      } else {
        runAction.fadeOut(0.2);
        idleAction.reset().fadeIn(0.2).play();
        currentAnimRef.current = 'idle';
      }
      
      runningRef.current = isMoving;
    } else if (isMoving) {
      actions[runAnimName].timeScale = moveState.shift ? 1.5 : 1.0;
    }
  });
  
  // Debug mount/unmount
  useEffect(() => {
    log('PlayerModel mounted');
    return () => {
      log('PlayerModel unmounted');
    };
  }, []);

  // Debug neighborhood state changes
  useEffect(() => {
    log('Neighborhood state changed:', hasEnteredNeighborhood);
  }, [hasEnteredNeighborhood]);
  
  // Configure player model
  useEffect(() => {
    if (!playerModel) return;
    
    // Add player model to raycast ignore list
    raycastFilterRef.current.add(playerModel);
    
    return () => {
      raycastFilterRef.current.delete(playerModel);
    };
  }, [playerModel]);
  
  return (
    <>
      <RigidBody 
        ref={rigidBodyRef}
        type="dynamic" 
        mass={1}
        lockRotations={true}
        enabledRotations={[false, false, false]}
        friction={0.2}
        restitution={0.0}
        linearDamping={0.1}
        angularDamping={0.2}
        position={[0, 5, 0]}
        gravityScale={1.0}
        ccd={true}
      >
        <CapsuleCollider args={[0.7, 0.5]} position={[0, CHARACTER_HEIGHT, 0]} />
      </RigidBody>
      
      <primitive 
        ref={primitiveRef} 
        object={playerModel} 
        scale={[0.027, 0.027, 0.027]}
        rotation={[0, -Math.PI/2, 0]}
      />
      
      {/* Debug visualization */}
      {debugEnabled && (
        <>
          <DebugRaycast 
            start={debugRaycast.start} 
            end={debugRaycast.end} 
            color={0x00ff00} 
            enabled={debugEnabled}
          />
          {debugRaycast.hit && (
            <mesh position={debugRaycast.hit}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial color={0xff0000} />
            </mesh>
          )}
        </>
      )}
    </>
  );
}