const COMMANDS = [
  { text: 'Move Forward', key: 'w' },
  { text: 'Move Backward', key: 's' },
  { text: 'Move Left', key: 'a' },
  { text: 'Move Right', key: 'd' },
  { text: 'Jump', key: 'space' },
];

class SimonSaysController {
  constructor() {
    this.currentCommand = null;
    this.gameActive = false;
    this.players = new Map();
    this.commandTimeout = null;
    this.commandDuration = 5000; // 5 seconds per command
  }

  startGame() {
    this.gameActive = true;
    this.players.clear();
    const command = this.issueNewCommand();
    return command; // Return the new command
  }

  stopGame() {
    this.gameActive = false;
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
    }
    this.currentCommand = null;
  }

  issueNewCommand() {
    if (!this.gameActive) {
      return null;
    }

    // Clear previous timeout
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
    }

    // Select random command
    const randomIndex = Math.floor(Math.random() * COMMANDS.length);
    this.currentCommand = {
      ...COMMANDS[randomIndex],
      timestamp: Date.now(),
      playersCompleted: new Set()
    };

    // Set timeout for next command
    this.commandTimeout = setTimeout(() => {
      this.issueNewCommand();
    }, this.commandDuration);

    return this.currentCommand;
  }

  validatePlayerMove(playerId, moveState) {
    if (!this.gameActive || !this.currentCommand) return null;

    const command = this.currentCommand;
    const key = command.key;
    
    // Initialize attempts tracking
    if (!command.playerAttempts) {
      command.playerAttempts = new Map();
    }
    
    // Get previous state for this player (or initialize)
    const prevState = command.playerAttempts.get(playerId) || {
      hasAttempted: false,
      lastResult: null,
      lastMoveState: { w: false, a: false, s: false, d: false, space: false }
    };
    
    // Skip if no keys are pressed and no keys were pressed before
    const anyKeyPressed = moveState.w || moveState.a || moveState.s || moveState.d || moveState.space;
    const anyKeyWasPressed = prevState.lastMoveState.w || prevState.lastMoveState.a || 
                            prevState.lastMoveState.s || prevState.lastMoveState.d || 
                            prevState.lastMoveState.space;
                            
    if (!anyKeyPressed && !anyKeyWasPressed) {
      return null;
    }
    
    // Check for key press changes
    const wJustPressed = moveState.w && !prevState.lastMoveState.w;
    const aJustPressed = moveState.a && !prevState.lastMoveState.a;
    const sJustPressed = moveState.s && !prevState.lastMoveState.s;
    const dJustPressed = moveState.d && !prevState.lastMoveState.d;
    const spaceJustPressed = moveState.space && !prevState.lastMoveState.space;
    
    // Determine if any key was just pressed
    const anyKeyJustPressed = wJustPressed || aJustPressed || sJustPressed || dJustPressed || spaceJustPressed;
    
    // Record the current move state for next comparison
    const newState = {
      hasAttempted: prevState.hasAttempted,
      lastResult: prevState.lastResult,
      lastMoveState: { ...moveState }
    };
    
    // If no new key was pressed, just update state and return
    if (!anyKeyJustPressed) {
      command.playerAttempts.set(playerId, newState);
      return null;
    }
    
    // A key was just pressed, determine if it's correct
    let isCorrect = false;
    
    switch (key) {
      case 'w':
        isCorrect = wJustPressed;
        break;
      case 's':
        isCorrect = sJustPressed;
        break;
      case 'a':
        isCorrect = aJustPressed;
        break;
      case 'd':
        isCorrect = dJustPressed;
        break;
      case 'space':
        isCorrect = spaceJustPressed;
        break;
    }
    
    // Mark that the player has attempted this command
    newState.hasAttempted = true;
    
    if (isCorrect) {
      // Success!
      newState.lastResult = true;
      command.playersCompleted.add(playerId);
      command.playerAttempts.set(playerId, newState);
      return true;
    } else {
      // Failure - wrong key pressed
      newState.lastResult = false;
      command.playerAttempts.set(playerId, newState);
      return false;
    }
  }

  getCurrentCommand() {
    return this.currentCommand;
  }

  isGameActive() {
    return this.gameActive;
  }
}

// Export singleton instance
const simonSaysController = new SimonSaysController();
export default simonSaysController; 