import { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import createToonGradient from '../../utils/createToonGradient';
import { loadPlayerModel, getPlayerModelClone, getCachedAnimations } from "../../utils/playerCloning";

// Add new imports for HTML elements and sprites
import { Html, Billboard, Plane } from '@react-three/drei';

// Validate if a URL is usable for an image
const isValidImageUrl = (url) => {
  if (!url) return false;
  if (url.length < 5) return false;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

// Default profile image URL
const DEFAULT_PROFILE_IMAGE = 'https://assets.hackclub.com/icon-rounded.png';
// Loading indicator gradient
const LOADING_COLORS = [
  '#ff416c', '#ff4b2b', // Red gradient
  '#4facfe', '#00f2fe', // Blue gradient
  '#43e97b', '#38f9d7', // Green gradient
  '#fa709a', '#fee140', // Pink-yellow gradient
  '#a18cd1', '#fbc2eb', // Purple-pink gradient
];

export default function OtherPlayers({ players }) {
  const modelsRef = useRef(new Map());
  const mixersRef = useRef(new Map());
  const toonGradient = useMemo(() => createToonGradient(), []);
  const debug = false;
  
  // Store loading state for each player
  const loadingStatusRef = useRef(new Map());
  // Store loading animation params
  const [loadingTick, setLoadingTick] = useState(0);

  // Store profile picture textures
  const profileTexturesRef = useRef(new Map());
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
  const defaultProfileTextureRef = useRef(null);

  // Setup loading animation ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingTick(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Load default profile image
  useEffect(() => {
    // Load default profile picture once
    if (!defaultProfileTextureRef.current) {
      textureLoader.load(
        DEFAULT_PROFILE_IMAGE,
        (texture) => {
          defaultProfileTextureRef.current = texture;
        },
        undefined,
        (error) => {
          // Silent fail for profile images
        }
      );
    }
  }, [textureLoader]);

  // Animation update loop
  useEffect(() => {
    let lastTime = 0;
    const animate = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Update all animation mixers
      mixersRef.current.forEach((mixer) => {
        if (mixer) {
          mixer.update(delta);
        }
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, []);

  // Update players when the players prop changes
  useEffect(() => {
    if (!players) return;

    // Update existing players and create new ones
    players.forEach((player, playerId) => {
      let model = modelsRef.current.get(playerId);
      let mixer = mixersRef.current.get(playerId);
      
      if (!model) {
        const { scene, animations } = loadPlayerModel();
        
        if (!scene || !animations) {
          return;
        }
        
        model = getPlayerModelClone(scene, toonGradient);
        model.scale.set(0.027, 0.027, 0.027);
        model.rotation.order = 'YXZ';
        modelsRef.current.set(playerId, model);

        // Initialize position tracking
        model.userData.lastPosition = new THREE.Vector3();
        if (player.position) {
          model.userData.lastPosition.set(
            player.position.x,
            player.position.y,
            player.position.z
          );
        }
        
        // Store player info in model userData
        model.userData.playerInfo = {
          id: playerId,
          name: player.name || "Player",
          profilePicture: player.profilePicture || "",
          isMoving: player.isMoving || false
        };

        // Set up animation mixer
        mixer = new THREE.AnimationMixer(model);
        mixersRef.current.set(playerId, mixer);

        // Store animations and state
        model.userData.animations = animations;
        model.userData.currentAnimation = null;
        model.userData.animationActions = {};
        
        // Find animations by closest match
        const findAnimation = (keywords) => {
          for (const keyword of keywords) {
            const anim = animations.find(a => 
              a.name.toLowerCase().includes(keyword)
            );
            if (anim) return anim;
          }
          return null;
        };
        
        // Cache animations by type
        const idleAnim = findAnimation(['idle', 'stand']);
        const walkAnim = findAnimation(['walk', 'run', 'move']);
        
        if (idleAnim) {
          const action = mixer.clipAction(idleAnim);
          action.loop = THREE.LoopRepeat;
          model.userData.animationActions.idle = action;
        }
        
        if (walkAnim) {
          const action = mixer.clipAction(walkAnim);
          action.loop = THREE.LoopRepeat;
          model.userData.animationActions.walk = action;
        }
        
        // Start with idle animation by default
        if (model.userData.animationActions.idle) {
          const action = model.userData.animationActions.idle;
          action.play();
          model.userData.currentAnimation = 'idle';
        }

        // Load profile picture if available
        if (player.profilePicture && isValidImageUrl(player.profilePicture)) {
          console.log("Loading profile picture for new player:", playerId, player.name);
          // Mark as loading
          loadingStatusRef.current.set(playerId, {
            state: 'loading',
            startTime: Date.now(),
            attempts: 1
          });
          
          textureLoader.load(
            player.profilePicture,
            (texture) => {
              profileTexturesRef.current.set(playerId, texture);
              // Mark as loaded
              loadingStatusRef.current.set(playerId, {
                state: 'loaded',
                loadTime: Date.now() - (loadingStatusRef.current.get(playerId)?.startTime || Date.now())
              });
            },
            undefined,
            (error) => {
              // Mark as failed
              loadingStatusRef.current.set(playerId, {
                state: 'failed',
                error: error.message,
                attempts: (loadingStatusRef.current.get(playerId)?.attempts || 0) + 1
              });
            }
          );
        }
      } else {
        // Update player info if changed
        if (player.name !== model.userData.playerInfo.name || 
            player.profilePicture !== model.userData.playerInfo.profilePicture) {
          
          console.log("Updating player info:", playerId, player.name);
          model.userData.playerInfo = {
            ...model.userData.playerInfo,
            name: player.name || model.userData.playerInfo.name,
            profilePicture: player.profilePicture || model.userData.playerInfo.profilePicture
          };
          
          // Load new profile picture if it changed
          if (player.profilePicture && 
              player.profilePicture !== model.userData.lastProfilePicture && 
              isValidImageUrl(player.profilePicture)) {
            
            console.log("Updating profile picture for player:", playerId, player.name);
            model.userData.lastProfilePicture = player.profilePicture;
            
            // Mark as loading again
            loadingStatusRef.current.set(playerId, {
              state: 'loading',
              startTime: Date.now(),
              attempts: 1
            });
            
            textureLoader.load(
              player.profilePicture,
              (texture) => {
                profileTexturesRef.current.set(playerId, texture);
                // Mark as loaded
                loadingStatusRef.current.set(playerId, {
                  state: 'loaded',
                  loadTime: Date.now() - (loadingStatusRef.current.get(playerId)?.startTime || Date.now())
                });
              },
              undefined,
              (error) => {
                // Mark as failed
                loadingStatusRef.current.set(playerId, {
                  state: 'failed',
                  error: error.message,
                  attempts: (loadingStatusRef.current.get(playerId)?.attempts || 0) + 1
                });
              }
            );
          }
        }
        
        // Always try to reload missing profile pictures
        if (player.profilePicture && 
            !profileTexturesRef.current.has(playerId) && 
            isValidImageUrl(player.profilePicture) &&
            (!loadingStatusRef.current.has(playerId) || 
             loadingStatusRef.current.get(playerId).state === 'failed')) {
          
          const attempts = (loadingStatusRef.current.get(playerId)?.attempts || 0) + 1;
          if (attempts <= 5) { // Limit retry attempts
            console.log("Re-attempting to load missing profile picture for player:", playerId, player.name, "attempt:", attempts);
            
            // Mark as loading again
            loadingStatusRef.current.set(playerId, {
              state: 'loading',
              startTime: Date.now(),
              attempts
            });
            
            textureLoader.load(
              player.profilePicture,
              (texture) => {
                profileTexturesRef.current.set(playerId, texture);
                // Mark as loaded
                loadingStatusRef.current.set(playerId, {
                  state: 'loaded',
                  loadTime: Date.now() - (loadingStatusRef.current.get(playerId)?.startTime || Date.now())
                });
              },
              undefined,
              (error) => {
                // Mark as failed
                loadingStatusRef.current.set(playerId, {
                  state: 'failed',
                  error: error.message,
                  attempts
                });
              }
            );
          }
        }
        
        // Update animation based on movement
        const isMoving = player.isMoving || false;
        if (isMoving !== model.userData.playerInfo.isMoving) {
          model.userData.playerInfo.isMoving = isMoving;
          
          // Switch between walk and idle animations
          if (isMoving) {
            if (model.userData.animationActions.walk && model.userData.currentAnimation !== 'walk') {
              if (model.userData.animationActions.idle) {
                model.userData.animationActions.idle.fadeOut(0.2);
              }
              model.userData.animationActions.walk.reset().fadeIn(0.2).play();
              model.userData.currentAnimation = 'walk';
            }
          } else {
            if (model.userData.animationActions.idle && model.userData.currentAnimation !== 'idle') {
              if (model.userData.animationActions.walk) {
                model.userData.animationActions.walk.fadeOut(0.2);
              }
              model.userData.animationActions.idle.reset().fadeIn(0.2).play();
              model.userData.currentAnimation = 'idle';
            }
          }
        }
      }

      // Update model position
      if (player.position) {
        model.position.set(
          player.position.x,
          player.position.y - 0.6, // Adjust for character height
          player.position.z
        );
      }

      // Update rotation
      if (player.quaternion) {
        model.quaternion.set(
          player.quaternion.x,
          player.quaternion.y,
          player.quaternion.z,
          player.quaternion.w
        );
      }
    });

    // Remove players that are no longer in the list
    modelsRef.current.forEach((model, playerId) => {
      if (!players.has(playerId)) {
        model.removeFromParent();
        modelsRef.current.delete(playerId);
        mixersRef.current.delete(playerId);
        profileTexturesRef.current.delete(playerId);
        loadingStatusRef.current.delete(playerId);
      }
    });
  }, [players, toonGradient, textureLoader]);
  
  // Add an effect to periodically check for missing player profile images and reload them
  useEffect(() => {
    const reloadInterval = setInterval(() => {
      if (!players || players.size === 0) return;
      
      players.forEach((player, playerId) => {
        const model = modelsRef.current.get(playerId);
        if (!model) return;
        
        // If we have a valid profile picture URL but no texture loaded, and not already loading, try again
        if (player.profilePicture && 
            isValidImageUrl(player.profilePicture) && 
            !profileTexturesRef.current.has(playerId) &&
            (!loadingStatusRef.current.has(playerId) || 
             loadingStatusRef.current.get(playerId).state === 'failed')) {
          
          const attempts = (loadingStatusRef.current.get(playerId)?.attempts || 0) + 1;
          if (attempts <= 5) { // Limit retry attempts
            console.log("Scheduled reload of missing profile picture for player:", playerId, player.name, "attempt:", attempts);
            
            // Mark as loading
            loadingStatusRef.current.set(playerId, {
              state: 'loading',
              startTime: Date.now(),
              attempts
            });
            
            textureLoader.load(
              player.profilePicture,
              (texture) => {
                profileTexturesRef.current.set(playerId, texture);
                // Mark as loaded
                loadingStatusRef.current.set(playerId, {
                  state: 'loaded',
                  loadTime: Date.now() - (loadingStatusRef.current.get(playerId)?.startTime || Date.now())
                });
              },
              undefined,
              (error) => {
                // Mark as failed
                loadingStatusRef.current.set(playerId, {
                  state: 'failed',
                  error: error.message,
                  attempts
                });
              }
            );
          }
        }
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(reloadInterval);
  }, [players, textureLoader]);

  // Helper to get a color based on loading animation
  const getLoadingColor = (playerId) => {
    // Get a consistent color for each player based on their ID
    const colorIndex = playerId.charCodeAt(0) % LOADING_COLORS.length;
    const startColor = LOADING_COLORS[colorIndex];
    const endColor = LOADING_COLORS[colorIndex + 1] || LOADING_COLORS[0];
    
    // Return the start color
    return startColor;
  };

  return (
    <>
      {Array.from(modelsRef.current.entries()).map(([playerId, model]) => {
        // Get player profile texture
        const playerInfo = model.userData.playerInfo || {};
        const profileTexture = profileTexturesRef.current.get(playerId);
        const isLoading = loadingStatusRef.current.get(playerId)?.state === 'loading';
        const loadingColor = getLoadingColor(playerId);
        
        return (
          <group key={playerId}>
            <primitive object={model} />
            <group position={[model.position.x, model.position.y + 2.7, model.position.z]}>
              <Billboard follow={true}>
                {/* Loading Indicator or Profile Picture */}
                {isLoading ? (
                  // Loading indicator
                  <Plane args={[0.7, 0.7]} position={[0, 0.5, 0]}>
                    <meshBasicMaterial color={loadingColor} transparent={true} opacity={0.8 + 0.2 * Math.sin(loadingTick / 10)} />
                  </Plane>
                ) : profileTexture ? (
                  // Profile Picture
                  <Plane args={[0.7, 0.7]} position={[0, 0.5, 0]}>
                    <meshBasicMaterial 
                      map={profileTexture} 
                      transparent={true} 
                      side={THREE.DoubleSide}
                    />
                  </Plane>
                ) : defaultProfileTextureRef.current ? (
                  // Default profile
                  <Plane args={[0.7, 0.7]} position={[0, 0.5, 0]}>
                    <meshBasicMaterial 
                      map={defaultProfileTextureRef.current} 
                      transparent={true} 
                      side={THREE.DoubleSide}
                    />
                  </Plane>
                ) : null}
                
                {/* Player Name */}
                <Html
                  position={[0, 0, 0]}
                  center
                  distanceFactor={8}
                  sprite
                  transform
                >
                  <div style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    textShadow: '1px 1px 1px black'
                  }}>
                    {isLoading ? `${playerInfo.name || "Player"} (loading...)` : playerInfo.name || "Player"}
                  </div>
                </Html>
              </Billboard>
            </group>
          </group>
        );
      })}
    </>
  );
} 