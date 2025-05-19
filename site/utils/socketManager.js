import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
    this.players = new Map();
    this.onPlayersUpdate = null;
    this.connected = false;
    this.onConnectionStatusChange = null;
    this.debug = true; // Enable debug logging
    this.onSimonSaysStarted = null;
    this.onSimonSaysStopped = null;
    this.onSimonSaysCommand = null;
    this.onSimonSaysUpdate = null;
    this.simonSaysActive = false;
    this._sentFirstUpdate = false;
    this._connectionAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._baseReconnectDelay = 1000;
    
    // Set up global error handler for debugging
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.log('Global error:', event.message);
        console.error('[SocketManager] Global error:', event);
      });
    }
  }

  log(...args) {
    if (this.debug) {
      console.log('[SocketManager]', ...args);
      
      // Also log to server if connected
      if (this.socket && this.connected) {
        try {
          this.socket.emit('clientLog', { 
            timestamp: Date.now(),
            message: args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ')
          });
        } catch (err) {
          console.error('[SocketManager] Failed to send log to server:', err);
        }
      }
    }
  }

  connect(playerInfo = {}) {
    if (this.socket) {
      this.log('Disconnecting previous socket before reconnecting');
      this.socket.disconnect();
      this.socket = null;
    }

    this.log('Connecting to server...');
    this._connectionAttempts++;
    
    // Use the Hack Club selfhosted URL
    // For development vs production
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://express.neighborhood.hackclub.com'
      : 'https://express.neighborhood.hackclub.com';
    
    this.log(`Using socket URL: ${socketUrl} (attempt ${this._connectionAttempts})`);
    
    try {
      // Check if browser supports WebSockets at all
      if (typeof WebSocket !== 'undefined') {
        this.log('Browser supports WebSocket API');
      } else {
        this.log('WARNING: Browser does not support WebSocket API!');
      }
      
      const { name, profilePicture } = playerInfo;
      
      // Use both transports with WebSocket preferred
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: true,
        path: '/socket.io',
        query: {
          clientId: `client_${Date.now()}`,
          name: name || '',
          profilePicture: profilePicture || ''
        }
      });
      
      // Save player info for later use - don't clear it until explicitly sent
      if (name || profilePicture) {
        this._updatePlayerInfoNextTransform = { name, profilePicture };
      }
      
      this.log('Socket.io instance created:', !!this.socket);
    } catch (err) {
      this.log('Error creating Socket.io instance:', err);
      console.error('[SocketManager] Socket creation error:', err);
      
      setTimeout(() => this.tryReconnect(), 3000);
      return;
    }

    // Set up a shorter connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!this.connected && this.socket) {
        this.log('Connection attempt timed out');
        this.socket.disconnect();
        this.tryReconnect();
      }
    }, 5000);

    this.setupEventHandlers(connectionTimeout);
    
    // Send a connection status update every 5 seconds while not connected
    if (!this._connectionStatusInterval) {
      this._connectionStatusInterval = setInterval(() => {
        if (!this.connected) {
          this.log('Still trying to connect...');
          this.onConnectionStatusChange?.(false);
        } else {
          clearInterval(this._connectionStatusInterval);
          this._connectionStatusInterval = null;
        }
      }, 5000);
    }
  }

  tryReconnect() {
    if (this._connectionAttempts >= this._maxReconnectAttempts) {
      this.log('Max reconnection attempts reached, giving up');
      this.onConnectionStatusChange?.(false);
      return;
    }

    // Use exponential backoff with jitter
    const delay = Math.min(30000, this._baseReconnectDelay * Math.pow(1.5, this._connectionAttempts)) * 
                  (0.5 + Math.random());
    
    this.log(`Scheduling reconnection attempt in ${Math.round(delay)}ms`);
    
    setTimeout(() => {
      this.log('Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  setupEventHandlers(connectionTimeout) {
    if (!this.socket) {
      this.log('Cannot set up event handlers - socket is null');
      return;
    }
    
    // Clear listeners from previous connections
    this.socket.removeAllListeners();
    
    // Log all socket events for debugging
    const originalOn = this.socket.on;
    this.socket.on = (event, handler) => {
      // Wrap handler to log events
      const wrappedHandler = (...args) => {
        this.log(`Event received: ${event} with ${args.length} args`);
        return handler(...args);
      };
      return originalOn.call(this.socket, event, wrappedHandler);
    };
    
    // Listen for connection errors and reconnection attempts
    this.socket.on('connect_error', (err) => {
      this.log('Connection error:', err.message);
      console.error('[SocketManager] Connection error details:', err);
      clearTimeout(connectionTimeout);
      this.onConnectionStatusChange?.(false);
      this.socket.disconnect();
      this.tryReconnect();
    });

    this.socket.on('error', (error) => {
      this.log('Socket error:', error);
      console.error('[SocketManager] Socket error:', error);
      this.onConnectionStatusChange?.(false);
    });
    
    // Listen for the debug message from server
    this.socket.on('debug', (data) => {
      this.log('Debug message from server:', data.message);
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this._connectionAttempts = 0; // Reset counter on successful connection
      clearTimeout(connectionTimeout);
      this.log('Connected to server with ID:', this.socket.id);
      this.onConnectionStatusChange?.(true);
      
      // Request initial players data immediately on connection
      this.socket.emit('requestPlayers');
      
      // Send initial transform to register immediately - no delay
      if (typeof window !== 'undefined') {
        // Send player info first if available
        if (this._updatePlayerInfoNextTransform) {
          this.socket.emit('updatePlayerInfo', {
            name: this._updatePlayerInfoNextTransform.name,
            profilePicture: this._updatePlayerInfoNextTransform.profilePicture
          });
        }
        
        // Then send position
        this._forceRegisterOnServer();
      }
      
      // Set up heartbeat for this connection
      this._setupHeartbeat();
    });
    
    this.socket.on('disconnect', (reason) => {
      this.log('Disconnected from server. Reason:', reason);
      this.connected = false;
      this.onConnectionStatusChange?.(false);
      this.players.clear();
      this.onPlayersUpdate?.(this.players);
      this.simonSaysActive = false;
      
      // Try to reconnect unless it was a manual disconnect
      if (reason !== 'io client disconnect') {
        this.tryReconnect();
      }
    });

    this.socket.on('playersUpdate', (players) => {
      this.log(`Received playersUpdate event with ${players.length} players`);
      
      try {
        this.players.clear(); // Clear existing players first
        
        if (Array.isArray(players)) {
          players.forEach(([id, player]) => {
            if (id !== this.socket.id) {
              this.players.set(id, player);
            }
          });
        } else {
          this.log('Warning: players is not an array:', players);
        }
        
        this.onPlayersUpdate?.(this.players);
        this.log(`Updated players map: ${this.players.size} players`);
      } catch (err) {
        this.log('Error processing players update:', err);
        console.error('[SocketManager] Error processing players:', err);
      }
    });
    
    // Handle heartbeat acknowledgement
    this.socket.on('heartbeatAck', (data) => {
      this.log(`Heartbeat acknowledged. Server has ${data.playerCount} players`);
      
      if (data.playerIds) {
        this.log(`Server player IDs: ${data.playerIds.join(', ')}`);
      }
      
      // If server reports players but our map is empty, request an update
      if (data.playerCount > 0 && this.players.size === 0) {
        this.log('Server reports players but our map is empty, requesting update');
        this.socket.emit('requestPlayers');
      }
    });
    
    // Simon Says event handlers
    this.socket.on('simonSaysStarted', (command) => {
      this.log('Received simonSaysStarted event:', command);
      this.simonSaysActive = true;
      if (this.onSimonSaysStarted) {
        this.onSimonSaysStarted(command);
      }
    });
    
    this.socket.on('simonSaysStopped', () => {
      this.log('Received simonSaysStopped event');
      this.simonSaysActive = false;
      if (this.onSimonSaysStopped) {
        this.onSimonSaysStopped();
      }
    });
    
    this.socket.on('simonSaysCommand', (command) => {
      this.log('Received simonSaysCommand event:', command);
      if (this.onSimonSaysCommand) {
        this.onSimonSaysCommand(command);
      }
    });
    
    this.socket.on('simonSaysUpdate', (data) => {
      this.log('Received simonSaysUpdate event:', data);
      if (this.onSimonSaysUpdate) {
        this.onSimonSaysUpdate(data);
      }
    });
  }
  
  _setupHeartbeat() {
    // Clear any existing heartbeat
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
    }
    
    // First heartbeat immediately to ensure quick registration
    if (this.socket && this.connected) {
      this.socket.emit('heartbeat');
    }
    
    // Set up a new heartbeat
    this._heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('heartbeat');
        // Only send position update every other heartbeat to reduce traffic
        if (Math.random() < 0.5) {
          this._forceRegisterOnServer();
        }
      } else {
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
      }
    }, 15000); // Increased interval to reduce network traffic
  }
  
  _forceRegisterOnServer() {
    if (!this.socket || !this.connected) {
      return;
    }
    
    try {
      // Always include player info in the initial transform
      const transformData = {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        isMoving: false,
        moveState: { w: false, a: false, s: false, d: false, space: false }
      };
      
      // Include player info if it's set
      if (this._updatePlayerInfoNextTransform) {
        transformData.name = this._updatePlayerInfoNextTransform.name;
        transformData.profilePicture = this._updatePlayerInfoNextTransform.profilePicture;
      }
      
      this.socket.emit('updateTransform', transformData);
    } catch (err) {
      this.log('Error during force register:', err);
    }
  }

  // Method to update player information
  updatePlayerInfo(name, profilePicture) {
    if (!this.socket || !this.connected) {
      this.log('Cannot update player info - not connected');
      return false;
    }
    
    try {
      this.log(`Updating player info: name=${name}, has profile pic=${!!profilePicture}`);
      this.socket.emit('updatePlayerInfo', {
        name,
        profilePicture
      });
      
      // Also update the next transform with this info to ensure it propagates
      this._updatePlayerInfoNextTransform = {
        name,
        profilePicture
      };
      
      // Send repeated updates for the player info to ensure it gets through
      setTimeout(() => {
        if (this.socket && this.connected) {
          this.log('Sending follow-up player info update');
          this.socket.emit('updatePlayerInfo', {
            name,
            profilePicture
          });
        }
      }, 1000);
      
      return true;
    } catch (err) {
      this.log('Error updating player info:', err);
      return false;
    }
  }

  updateTransform(position, quaternion, isMoving, moveState = {}) {
    if (!this.socket || !this.connected) {
      return false;
    }
    
    if (!this._sentFirstUpdate) {
      this.log('Sending first transform update');
      this._sentFirstUpdate = true;
    }
    
    try {
      // Create transform data
      const transformData = {
        position,
        quaternion,
        isMoving,
        moveState
      };
      
      // Include player info if it was recently updated or hasn't been sent yet
      if (this._updatePlayerInfoNextTransform) {
        transformData.name = this._updatePlayerInfoNextTransform.name;
        transformData.profilePicture = this._updatePlayerInfoNextTransform.profilePicture;
        
        // Keep sending player info in transforms for longer to ensure it propagates
        // Only clear after many updates and with low probability
        if (this._sentFirstUpdate && Math.random() < 0.05) { // Reduced from 0.2 to 0.05 (5% chance)
          this._updatePlayerInfoNextTransform = null;
        }
      }
      
      this.socket.emit('updateTransform', transformData);
      return true;
    } catch (err) {
      this.log('Error updating transform:', err);
      return false;
    }
  }

  startSimonSays() {
    if (this.socket && this.connected) {
      this.log('Requesting to start Simon Says');
      this.socket.emit('startSimonSays');
    }
  }
  
  stopSimonSays() {
    if (this.socket && this.connected) {
      this.log('Requesting to stop Simon Says');
      this.socket.emit('stopSimonSays');
    }
  }

  disconnect() {
    if (this.socket) {
      this.log('Disconnecting from server');
      
      // Clear intervals
      if (this._heartbeatInterval) {
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
      }
      
      if (this._connectionStatusInterval) {
        clearInterval(this._connectionStatusInterval);
        this._connectionStatusInterval = null;
      }
      
      this.socket.disconnect();
      this.socket = null;
      this.players.clear();
      this.simonSaysActive = false;
      this.connected = false;
    }
  }
}

export const socketManager = new SocketManager(); 