export const updateSlackUserData = async (token) => {
  try {
    console.log('Fetching user data from Slack API with token');
    
    // Use the absolute URL path to make sure it resolves correctly
    // Try both URLs to handle potential path differences in development vs production
    let response = null;
    let error = null;
    
    // First try absolute path
    try {
      response = await fetch('/api/get-user-data', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) {
      console.log('Error fetching from absolute path, trying relative path:', e);
      error = e;
    }
    
    // If first attempt failed, try relative path
    if (!response || !response.ok) {
      try {
        response = await fetch('./api/get-user-data', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) {
        console.log('Error fetching from relative path:', e);
        // If both attempts failed, throw the original error
        throw error || e;
      }
    }

    if (!response.ok) {
      const data = await response.json();
      console.error('Slack API error:', data);
      if (response.status === 403 && data.shouldLogout) {
        // Remove token and reload the page
        if (window.electronAPI?.isElectron) {
          window.electronAPI.removeToken();
        } else {
          localStorage.removeItem('neighborhoodToken');
        }
        window.location.reload();
      }
      throw new Error('Failed to update Slack user data: ' + (data.message || response.statusText));
    }

    const userData = await response.json();
    console.log('Successfully retrieved user data:', {
      name: userData.name,
      slackHandle: userData.slackHandle,
      hasProfilePic: !!userData.profilePicture
    });
    
    // Ensure profile picture URL is properly formatted
    if (userData.profilePicture) {
      // Make sure it starts with http:// or https://
      if (!userData.profilePicture.startsWith('http')) {
        userData.profilePicture = 'https:' + userData.profilePicture.replace(/^:?\/\//, '//');
        console.log('Fixed profile picture URL:', userData.profilePicture.substring(0, 50) + '...');
      }
    }
    
    return userData;
  } catch (error) {
    console.error('Error updating Slack user data:', error);
    throw error;
  }
}; 

// Function to update player info in the socketManager
export const updatePlayerInfoFromSlack = async (socketManager, token) => {
  try {
    console.log('Updating player info from Slack data...');
    // Get user data from Slack API
    const userData = await updateSlackUserData(token);
    
    // Extract relevant information
    const { name, profilePicture, slackHandle } = userData;
    
    // Use the slackHandle if available, otherwise fall back to name
    const displayName = slackHandle || name || "Player";
    
    console.log('Player info from Slack:', {
      displayName,
      hasProfilePic: !!profilePicture,
      profilePicUrl: profilePicture ? profilePicture.substring(0, 50) + '...' : null
    });
    
    // Update the socket with player information
    if (socketManager) {
      const success = socketManager.updatePlayerInfo(displayName, profilePicture);
      console.log('Updated player info with Slack data:', { 
        displayName, 
        hasProfilePic: !!profilePicture,
        success
      });
      return success;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating player info from Slack:', error);
    return false;
  }
}; 