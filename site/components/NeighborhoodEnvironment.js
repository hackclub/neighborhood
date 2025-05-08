import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import Scene from "./threejs/Scene";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { socketManager } from "../utils/socketManager";
import { getToken } from "../utils/storage";
import { updatePlayerInfoFromSlack } from "../utils/slack";

function CameraController() {
  const { camera } = useThree();
  camera.rotation.order = 'YXZ'; // This helps prevent gimbal lock
  return null;
}

export default function NeighborhoodEnvironment({
  hasEnteredNeighborhood,
  setHasEnteredNeighborhood,
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState(new Map());
  const [simonSaysState, setSimonSaysState] = useState({
    active: false,
    command: null,
    success: null,
    playerId: null,
    lastCorrectPlayerId: null,
    currentPlayerState: null // New field to track current player's state (success/failure)
  });
  
  // Add a reference to track the success reset timeout
  const successTimeoutRef = useRef(null);
  const commandIdRef = useRef(0);

  // Effect for socket connection and cleanup
  useEffect(() => {
    if (hasEnteredNeighborhood) {
      console.log("[NeighborhoodEnvironment] Starting socket connection process...");
      
      // Register callback handlers
      socketManager.onPlayersUpdate = (players) => {
        console.log("[NeighborhoodEnvironment] Received players update, count:", players.size);
        if (players.size > 0) {
          // Debug log first player data
          const firstPlayer = Array.from(players.entries())[0];
          if (firstPlayer) {
            console.log("[NeighborhoodEnvironment] Sample player data:", {
              id: firstPlayer[0],
              name: firstPlayer[1].name,
              hasProfilePic: !!firstPlayer[1].profilePicture,
              profilePicLength: firstPlayer[1].profilePicture?.length
            });
          }
        }
        setOtherPlayers(new Map(players));
      };
      
      socketManager.onConnectionStatusChange = (connected) => {
        setConnectionStatus(connected);
        if (!connected) {
          setOtherPlayers(new Map());
        }
      };
      
      // Set up Simon Says callbacks
      socketManager.onSimonSaysStarted = (command) => {
        console.log("[NeighborhoodEnvironment] Simon Says started via callback:", command);
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = null;
        }
        
        // Increment command ID to track different commands
        commandIdRef.current++;
        
        setSimonSaysState(prev => {
          const newState = {
            ...prev,
            active: true,
            command: command,
            success: null,
            playerId: null,
            lastCorrectPlayerId: null,
            currentPlayerState: null,
            commandId: commandIdRef.current
          };
          console.log("[NeighborhoodEnvironment] Setting state for Simon Says start:", newState);
          return newState;
        });
      };
      
      socketManager.onSimonSaysStopped = () => {
        console.log("[NeighborhoodEnvironment] Simon Says stopped via callback");
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = null;
        }
        
        setSimonSaysState(prev => {
          const newState = {
            active: false,
            command: null,
            success: null,
            playerId: null,
            lastCorrectPlayerId: null,
            currentPlayerState: null,
            commandId: 0
          };
          console.log("[NeighborhoodEnvironment] Setting state for Simon Says stop:", newState);
          return newState;
        });
      };
      
      socketManager.onSimonSaysCommand = (command) => {
        console.log("[NeighborhoodEnvironment] New Simon Says command via callback:", command);
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = null;
        }
        
        // Increment command ID to track different commands
        commandIdRef.current++;
        
        // Reset player state for the new command
        setSimonSaysState(prev => {
          const newState = {
            ...prev,
            command: command,
            success: null,
            playerId: null,
            lastCorrectPlayerId: null,
            currentPlayerState: null,
            commandId: commandIdRef.current
          };
          console.log("[NeighborhoodEnvironment] Setting state for new command:", newState);
          return newState;
        });
      };
      
      socketManager.onSimonSaysUpdate = (data) => {
        console.log("[NeighborhoodEnvironment] Simon Says update via callback:", data);
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = null;
        }
        
        // Update state based on the received data
        setSimonSaysState(prev => {
          // If this is about the current player
          const isCurrentPlayer = data.playerId === socketManager.socket?.id;
          console.log("[NeighborhoodEnvironment] Update for current player?", isCurrentPlayer);
          
          let newState = prev;
          
          if (isCurrentPlayer) {
            // It's about us - update our state
            if (data.success === true) {
              // Success case - we got it right!
              // Only update if we haven't failed for this command
              if (prev.currentPlayerState !== 'failure') {
                newState = {
                  ...prev,
                  command: data.command,
                  success: true,
                  playerId: data.playerId,
                  lastCorrectPlayerId: data.playerId,
                  currentPlayerState: 'success'
                };
              }
            } else if (data.success === false) {
              // Failure case - we got it wrong
              // Always update to failure state regardless of previous state
              newState = {
                ...prev,
                command: data.command,
                success: false,
                playerId: data.playerId,
                currentPlayerState: 'failure'
              };
            }
          } else {
            // It's about another player - just update the command
            newState = {
              ...prev,
              command: data.command
            };
          }
          
          console.log("[NeighborhoodEnvironment] Setting state for update:", newState);
          return newState;
        });
        
        // Remove the timeout for clearing failure state - we want to keep it until next command
        // The failure state will be cleared when a new command is issued instead
      };
      
      // First get user data, then connect with that info
      const token = getToken();
      let cleanupTimer;
      
      if (token) {
        console.log("[NeighborhoodEnvironment] Auth token found, retrieving user data...");
        
        // Initial connection - try to get user data first
        (async () => {
          try {
            console.log('[NeighborhoodEnvironment] Attempting to get user data before connecting socket');
            const { updateSlackUserData } = await import('../utils/slack');
            const userData = await updateSlackUserData(token);
            
            // Extract name and profile image
            const { name, profilePicture, slackHandle } = userData;
            const displayName = slackHandle || name || 'Player';
            
            console.log(`[NeighborhoodEnvironment] User data retrieved, connecting with:`, {
              displayName, 
              hasProfilePic: !!profilePicture,
              profilePicUrl: profilePicture?.substring(0, 30) + '...'
            });
            
            // Connect with player info
            socketManager.connect({
              name: displayName,
              profilePicture
            });
            
            // Set up multiple update attempts to ensure profile data is propagated
            const updateSlackData = () => {
              console.log("[NeighborhoodEnvironment] Sending explicit player info update");
              import('../utils/slack').then(({ updatePlayerInfoFromSlack }) => {
                updatePlayerInfoFromSlack(socketManager, token)
                  .then(success => {
                    console.log("[NeighborhoodEnvironment] Player info update from Slack:", success ? "success" : "failed");
                  })
                  .catch(err => {
                    console.error("[NeighborhoodEnvironment] Error updating player info from Slack:", err);
                  });
              });
            };
            
            // Schedule multiple updates to ensure data gets propagated
            const updateTimers = [];
            updateTimers.push(setTimeout(updateSlackData, 2000));
            updateTimers.push(setTimeout(updateSlackData, 5000));
            updateTimers.push(setTimeout(updateSlackData, 10000));
            
            // Store all timers for cleanup
            cleanupTimer = updateTimers;
          } catch (error) {
            console.error('[NeighborhoodEnvironment] Failed to get user data before connecting:', error);
            // Connect without player info
            socketManager.connect();
          }
        })();
      } else {
        console.log("[NeighborhoodEnvironment] No auth token found, connecting with default player info");
        // No token, connect without player info
        socketManager.connect();
      }

      return () => {
        console.log("[NeighborhoodEnvironment] Cleaning up socket connection");
        // Clean up callbacks
        if (cleanupTimer) {
          if (Array.isArray(cleanupTimer)) {
            cleanupTimer.forEach(timer => clearTimeout(timer));
          } else {
            clearTimeout(cleanupTimer);
          }
        }
        socketManager.onPlayersUpdate = null;
        socketManager.onConnectionStatusChange = null;
        socketManager.onSimonSaysStarted = null;
        socketManager.onSimonSaysStopped = null;
        socketManager.onSimonSaysCommand = null;
        socketManager.onSimonSaysUpdate = null;
        
        // Disconnect from server
        socketManager.disconnect();
        setOtherPlayers(new Map());
      };
    }
  }, [hasEnteredNeighborhood]);

  return (
    <>
      {/* Main game container */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}>
        <Canvas
          camera={{
            fov: 45,
            near: 0.1,
            far: 1000,
            position: [2, 2.4, 1]
          }}
          gl={{
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true,
            powerPreference: "high-performance",
            physicallyCorrectLights: false,
          }}
          dpr={1}
          frameloop="always"
          performance={{ min: 0.5 }}
          shadows={false}
          style={{ 
            position: 'absolute',
            zIndex: 1,
            pointerEvents: hasEnteredNeighborhood ? 'auto' : 'none'
          }}
        >
          <Suspense>
            <Physics
              debug={false}
              gravity={[0, -30, 0]}
              maxStabilizationIterations={4}
              maxVelocityFriction={0.2}
              maxVelocityIterations={4}
            >
              <CameraController />
              <Scene 
                hasEnteredNeighborhood={hasEnteredNeighborhood}
                setHasEnteredNeighborhood={setHasEnteredNeighborhood}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                connectionStatus={connectionStatus}
                otherPlayers={otherPlayers}
                simonSaysState={simonSaysState}
              />
            </Physics>
          </Suspense>
        </Canvas>

        {isLoading && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              fontSize: "16px",
              textAlign: "center",
            }}
          ></div>
        )}
      </div>
      
      {/* Separate UI container - completely independent of any other elements */}
      {hasEnteredNeighborhood && !isLoading && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 999999
          }}
        >
          {/* Connection status */}
          <div 
            data-ui-element="true"
            style={{ 
              position: 'absolute', 
              top: '10px', 
              left: '10px', 
              color: 'white', 
              background: 'rgba(0,0,0,0.5)', 
              padding: '6px', 
              fontSize: '12px',
              borderRadius: '4px',
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
            <div>Connection: {connectionStatus ? '✅ Connected' : '❌ Disconnected'}</div>
            <div>Players: {otherPlayers.size}</div>
            {simonSaysState.active && (
              <div>Simon Says: {simonSaysState.currentPlayerState || 'waiting'}</div>
            )}
          </div>

          {/* Simon Says command */}
          {simonSaysState.active && simonSaysState.command && (
            <div 
              data-ui-element="true"
              style={{ 
                position: 'absolute', 
                top: '20%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)',
                padding: '20px',
                borderRadius: '10px',
                backgroundColor: 
                  simonSaysState.currentPlayerState === 'success'
                    ? 'rgba(0, 255, 0, 0.5)' 
                    : simonSaysState.currentPlayerState === 'failure'
                    ? 'rgba(255, 0, 0, 0.5)'
                    : 'rgba(255, 255, 255, 0.3)',
                color: 'white',
                fontSize: '24px',
                fontWeight: 'bold',
                textAlign: 'center',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                transition: 'all 0.3s ease',
                pointerEvents: 'auto',
                userSelect: 'none'
              }}>
              {simonSaysState.command.text}
            </div>
          )}

          {/* Game controls */}
          <div 
            data-ui-element="true"
            style={{ 
              position: 'absolute', 
              bottom: '20px', 
              left: '50%', 
              transform: 'translate(-50%, 0)',
              display: 'flex',
              gap: '10px',
              pointerEvents: 'auto'
            }}>
            <button 
              data-ui-element="true"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Start Simon Says button clicked');
                socketManager.startSimonSays();
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: simonSaysState.active ? '#666' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: simonSaysState.active ? 'default' : 'pointer',
                opacity: simonSaysState.active ? 0.7 : 1,
                pointerEvents: 'auto',
                userSelect: 'none'
              }}
              disabled={simonSaysState.active}
            >
              Start Simon Says
            </button>
            <button 
              data-ui-element="true"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Stop Simon Says button clicked');
                socketManager.stopSimonSays();
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: simonSaysState.active ? '#f44336' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: simonSaysState.active ? 'pointer' : 'default',
                opacity: simonSaysState.active ? 1 : 0.7,
                pointerEvents: 'auto',
                userSelect: 'none'
              }}
              disabled={!simonSaysState.active}
            >
              Stop Simon Says
            </button>
          </div>
        </div>
      )}
    </>
  );
}

