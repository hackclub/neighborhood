export const updateSlackUserData = async (token) => {
  try {
    const response = await fetch('https://neighborhood.hackclub.com/api/get-user-data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 403 && data.shouldLogout) {
        // Remove token and reload the page
        if (window.electronAPI?.isElectron) {
          window.electronAPI.removeToken();
        } else {
          localStorage.removeItem('neighborhoodToken');
        }
        window.location.reload();
      }
      throw new Error('Failed to update Slack user data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating Slack user data:', error);
    throw error;
  }
};

// Function to update player info in the socketManager
export const updatePlayerInfoFromSlack = async (socketManager, token) => {
  try {
    // Get user data from Slack API
    const userData = await updateSlackUserData(token);
    
    // Extract relevant information
    const { name, profilePicture, slackHandle } = userData;
    
    // Use the slackHandle if available, otherwise fall back to name
    const displayName = slackHandle || name || "Player";
    
    // Update the socket with player information
    if (socketManager) {
      socketManager.updatePlayerInfo(displayName, profilePicture);
      console.log('Updated player info with Slack data:', { displayName, hasProfilePic: !!profilePicture });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating player info from Slack:', error);
    return false;
  }
}; 