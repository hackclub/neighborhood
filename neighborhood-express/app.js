import createError from "http-errors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import simonSaysController from "./controllers/simonSaysController.js";

import videoRouter from "./routes/video.js";
import gameRouter from "./routes/game.js";
import { setClientsReference } from "./routes/game.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy headers from Coolify or other reverse proxies
app.set('trust proxy', true);

const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3002;

// Configure CORS to accept connections from any origin or specific origins
const CORS_ORIGINS = process.env.CORS_ORIGINS || "*";
const corsOrigins = CORS_ORIGINS === "*" ? "*" : CORS_ORIGINS.split(",");

const ioServer = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 20000,
  pingInterval: 10000,
  connectTimeout: 10000,
  path: '/socket.io',
  maxHttpBufferSize: 1e6,
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: {
      level: 1
    }
  }
});

// Track raw socket connections - minimal logging
ioServer.engine.on('connection', (rawSocket) => {
  rawSocket.on('close', () => {});
});

// Simplified logging function for player state
function logPlayersMap() {
  console.log(`[APP] Players: ${players.size}, Connections: ${ioServer.engine.clientsCount}`);
}

// Less frequent logging interval
const logInterval = setInterval(logPlayersMap, 300000); // Log every 5 minutes

// Track client versions and connection issues
const clientVersions = new Map();
const connectionIssues = new Map();

// Log middleware - no verbose logging
ioServer.use((socket, next) => {
  next();
});

const players = new Map();

ioServer.on('connection', (socket) => {
  // Create a placeholder entry for the player immediately
  const playerName = socket.handshake.query.name || "Player";
  const profilePicture = socket.handshake.query.profilePicture || "";
  
  // Track connection issues
  connectionIssues.set(socket.id, {
    connectTime: Date.now(),
    lastActivity: Date.now(),
    updateCount: 0,
    heartbeatCount: 0
  });
  
  // If player not already in map, add them
  if (!players.has(socket.id)) {
    players.set(socket.id, {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      isMoving: false,
      lastUpdate: Date.now(),
      name: playerName,
      profilePicture: profilePicture
    });
    
    // Send full player data to the new player first
    socket.emit('playersUpdate', Array.from(players.entries()));
    
    // Then broadcast the new player to others with complete information
    socket.broadcast.emit('playersUpdate', Array.from(players.entries()));
    
    // Send another update after a short delay to ensure everyone gets the latest info
    setTimeout(() => {
      ioServer.emit('playersUpdate', Array.from(players.entries()));
    }, 2000);
  }
  
  // Send debug message to confirm connection
  socket.emit('debug', { message: 'Server received your connection' });
  
  // Log all disconnection events
  socket.on('disconnecting', () => {});
  
  socket.on('disconnect', () => {
    // Check if the player was in the map before removing
    if (players.has(socket.id)) {
      players.delete(socket.id);
      
      // Broadcast to all remaining clients
      ioServer.emit('playersUpdate', Array.from(players.entries()));
    }
    
    // Cleanup connection issues
    connectionIssues.delete(socket.id);
  });
  
  // Send current Simon Says state to new players if a game is active
  if (simonSaysController.isGameActive()) {
    const currentCommand = simonSaysController.getCurrentCommand();
    if (currentCommand) {
      socket.emit('simonSaysStarted', currentCommand);
    }
  }
  
  // Handle heartbeat to keep connection alive
  socket.on('heartbeat', () => {
    const issues = connectionIssues.get(socket.id) || { 
      heartbeatCount: 0, 
      lastActivity: 0 
    };
    
    issues.lastActivity = Date.now();
    issues.heartbeatCount++;
    connectionIssues.set(socket.id, issues);
    
    // Respond with current player count
    socket.emit('heartbeatAck', { 
      playerCount: players.size,
      playerIds: Array.from(players.keys())
    });
    
    // Also send a full players update with each heartbeat to ensure data consistency
    socket.emit('playersUpdate', Array.from(players.entries()));
  });
  
  // Handle immediate player data requests with high priority
  socket.on('requestPlayers', () => {
    socket.emit('playersUpdate', Array.from(players.entries()));
    
    // Schedule another update shortly after to ensure data is received
    setTimeout(() => {
      if (socket.connected) {
        socket.emit('playersUpdate', Array.from(players.entries()));
      }
    }, 1000);
  });
  
  socket.on('updateTransform', (data) => {
    const wasNewPlayer = !players.has(socket.id);
    
    // Update connection issues tracking
    const issues = connectionIssues.get(socket.id) || { 
      updateCount: 0, 
      lastActivity: 0 
    };
    issues.lastActivity = Date.now();
    issues.updateCount++;
    connectionIssues.set(socket.id, issues);
    
    if (wasNewPlayer) {
      players.set(socket.id, {
        position: data.position,
        quaternion: data.quaternion,
        isMoving: data.isMoving,
        lastUpdate: Date.now(),
        name: data.name || socket.handshake.query.name || "Player",
        profilePicture: data.profilePicture || socket.handshake.query.profilePicture || ""
      });
      
      // When a new player joins, broadcast complete player data to everyone
      ioServer.emit('playersUpdate', Array.from(players.entries()));
    } else {
      const player = players.get(socket.id);
      player.position = data.position;
      player.quaternion = data.quaternion;
      player.isMoving = data.isMoving;
      player.lastUpdate = Date.now();
      
      // Important: Always update player info if provided
      if (data.name) player.name = data.name;
      if (data.profilePicture) player.profilePicture = data.profilePicture;
      
      // Broadcast to all clients except sender
      socket.broadcast.emit('playersUpdate', Array.from(players.entries()));
      
      // Every 5th update, also send a full sync to all clients including sender
      if (Math.random() < 0.2) { // Increased from 10% to 20% for better sync
        ioServer.emit('playersUpdate', Array.from(players.entries()));
      }
    }
  });

  socket.on('startSimonSays', () => {
    const firstCommand = simonSaysController.startGame();
    if (firstCommand) {
      ioServer.emit('simonSaysStarted', firstCommand);
    }
  });

  socket.on('stopSimonSays', () => {
    simonSaysController.stopGame();
    ioServer.emit('simonSaysStopped');
  });

  // Add endpoint to update player information
  socket.on('updatePlayerInfo', (data) => {
    if (players.has(socket.id)) {
      const player = players.get(socket.id);
      
      if (data.name) player.name = data.name;
      if (data.profilePicture) player.profilePicture = data.profilePicture;
      
      // Broadcast the updated player info
      ioServer.emit('playersUpdate', Array.from(players.entries()));
      
      // Send it again after a short delay to ensure everyone gets it
      setTimeout(() => {
        ioServer.emit('playersUpdate', Array.from(players.entries()));
      }, 2000);
    }
  });
});

// Create a custom event emitter for command changes
const origIssueNewCommand = simonSaysController.issueNewCommand;
simonSaysController.issueNewCommand = function() {
  const command = origIssueNewCommand.call(this);
  if (command) {
    ioServer.emit('simonSaysCommand', command);
  }
  return command;
};

// Add CORS middleware before other middlewares
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/video", videoRouter);
app.use("/game", gameRouter);

// Set up players map reference for the game router
setClientsReference(players);

app.get("/api/status", (req, res) => {
  res.json({
    status: "running",
    socketIO: "enabled",
    timestamp: Date.now()
  });
});

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {},
  });
});

// Periodically check for inactive players and clean them up
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedUp = 0;
  
  players.forEach((player, id) => {
    // If a player hasn't updated in 30 seconds, remove them
    if (now - player.lastUpdate > 30000) {
      players.delete(id);
      cleanedUp++;
    }
  });
  
  if (cleanedUp > 0) {
    console.log(`[APP] Cleaned up ${cleanedUp} inactive players. Remaining: ${players.size}`);
    // Broadcast updated player list to all clients
    ioServer.emit('playersUpdate', Array.from(players.entries()));
  }
}, 15000);

// Add cleanup for when the server shuts down
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  clearInterval(logInterval);
  clearInterval(cleanupInterval);
  process.exit(0);
});

// Add monitoring for server status - less frequent
setInterval(() => {
  const memory = process.memoryUsage();
  console.log(`[MONITOR] Memory: rss=${Math.round(memory.rss/1024/1024)}MB, heap=${Math.round(memory.heapUsed/1024/1024)}/${Math.round(memory.heapTotal/1024/1024)}MB`);
  console.log(`[MONITOR] Connections: socket.io=${ioServer.engine.clientsCount}, players=${players.size}`);
}, 300000); // Reduced to once every 5 minutes

// Simplified health check for sockets
setInterval(() => {
  // Only log issues if the player count and socket count mismatch significantly
  const socketCount = ioServer.sockets.sockets.size;
  if (Math.abs(socketCount - players.size) > 2) {
    console.log(`[HEALTH] Socket/player count mismatch: sockets=${socketCount}, players=${players.size}`);
  }
  
  // Look for disconnected sockets still in players map
  ioServer.sockets.sockets.forEach((socket, id) => {
    if (!socket.connected && players.has(id)) {
      console.log(`[HEALTH] Found disconnected socket still in players map: ${id}`);
      players.delete(id);
    }
  });
}, 60000); // Check every minute

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, ioServer };
