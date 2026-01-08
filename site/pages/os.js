import { useState, useEffect, useRef } from "react";
import { LoginComponentOS } from "@/components/os/loginComponentOS"
import { AppSelectionDropup } from "@/components/os/AppSelectionDropup"
import { BottomBar } from "@/components/os/BottomBar"
import MissionView from "@/components/os/MissionView"
import LowerHaightView from "@/components/os/LowerHaightView"
import SunsetView from "@/components/os/SunsetView"

export default function PostView() {

  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(true);
  const [weatherTexture, setWeatherTexture] = useState("sunny.svg");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [token, setToken] = useState("");
  const [neighborhoodToken, setNeighborhoodToken] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isAppDropupOpen, setIsAppDropupOpen] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [lineCoords, setLineCoords] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const [stonePath, setStonePath] = useState([]);
  const [visibleStones, setVisibleStones] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [stoneAnimations, setStoneAnimations] = useState({});
  const [currentView, setCurrentView] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const availableApps = ["Devlog", "Calendar", "Messages", "Settings"];
  
  const sunsetRef = useRef(null);
  const missionRef = useRef(null);
  const lowerHaightRef = useRef(null);
  const bottomBarRef = useRef(null);
  const animationRef = useRef(null);
  const audioRef = useRef(null);

  // Check for neighborhoodToken on component mount
  useEffect(() => {
    // Check if token exists in localStorage or other storage mechanism
    const storedToken = localStorage.getItem('neighborhoodToken');
    if (storedToken) {
      setNeighborhoodToken(storedToken);
      setIsLoginPopupOpen(false);
      
      // Fetch profile picture
      fetchProfilePicture(storedToken);
      
      // Fetch user's house
      fetchHouse(storedToken);
    } else {
      setIsLoginPopupOpen(true);
    }
  }, []);

  // Fetch profile picture when token changes
  useEffect(() => {
    if (neighborhoodToken) {
      fetchProfilePicture(neighborhoodToken);
      fetchHouse(neighborhoodToken);
    }
  }, [neighborhoodToken]);

  // Function to fetch profile picture
  const fetchProfilePicture = async (token) => {
    try {
      const response = await fetch(`/api/getMyPfp?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Profile data:', data);
        setProfilePicture(data.profilePicture);
        setIsAuthenticated(true);
        
        // Update user data if needed
        if (data.name && (!userData || !userData.name)) {
          setUserData(prev => ({
            ...prev,
            name: data.name,
            profilePicture: data.profilePicture,
            slackId: data.slackId
          }));
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
      setIsAuthenticated(false);
    }
  };

  // Function to fetch user's house
  const fetchHouse = async (token) => {
    try {
      const response = await fetch(`/api/getHouse?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        console.log('House data:', data);
        
        // Convert house name to lowercase to match our state format
        if (data.house) {
          const houseLower = data.house.toLowerCase().replace(' ', '');
          setSelectedHouse(houseLower);
        } else {
          setSelectedHouse(null);
        }
      }
    } catch (error) {
      console.error('Error fetching house information:', error);
    }
  };

  const handleJoinHouse = async (house) => {
    // Check if user has a neighborhoodToken
    if (!neighborhoodToken || !isAuthenticated) {
      setIsLoginPopupOpen(true);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Convert house format for API (capitalize first letter)
      let houseFormatted;
      if (house === 'sunset') {
        houseFormatted = 'Sunset';
      } else if (house === 'mission') {
        houseFormatted = 'Mission';
      } else if (house === 'lowerhaight') {
        houseFormatted = 'Lower Haight';
      }
      
      // Call API to select house
      const response = await fetch('/api/selectHouse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${neighborhoodToken}`
        },
        body: JSON.stringify({ house: houseFormatted })
      });
      
      if (response.ok) {
        setSelectedHouse(house);
        // Reset visible stones when a new house is selected
        setVisibleStones(0);
        setIsAnimating(true);
        setStoneAnimations({});
        
        // Play sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Audio play failed:", e));
        }
      } else {
        console.error('Failed to select house:', await response.json());
      }
    } catch (error) {
      console.error('Error selecting house:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveHouse = async () => {
    // Check if user has a neighborhoodToken
    if (!neighborhoodToken || !isAuthenticated) {
      setIsLoginPopupOpen(true);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call API to unselect house
      const response = await fetch('/api/unselectHouse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${neighborhoodToken}`
        }
      });
      
      if (response.ok) {
        setSelectedHouse(null);
        setStonePath([]);
        setVisibleStones(0);
        setIsAnimating(false);
        
        // Stop audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
      } else {
        console.error('Failed to unselect house:', await response.json());
      }
    } catch (error) {
      console.error('Error unselecting house:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle neighborhood clicks
  const handleNeighborhoodClick = (neighborhood) => {
    // Check if user has a neighborhoodToken
    if (!neighborhoodToken || !isAuthenticated) {
      setIsLoginPopupOpen(true);
      return;
    }
    
    setCurrentView(neighborhood);
  };

  // Function to go back from neighborhood view
  const handleBackFromView = () => {
    setCurrentView(null);
  };

  // Add keyboard event listener for Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && currentView) {
        handleBackFromView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentView]);

  // Generate random stones along the path
  const generateStonePath = (x1, y1, x2, y2) => {
    const stones = [];
    const numStones = Math.floor(Math.random() * 10) + 35; // 35-45 stones
    
    for (let i = 0; i < numStones; i++) {
      // Calculate position along the line
      const ratio = i / (numStones - 1);
      const x = x1 + (x2 - x1) * ratio;
      const y = y1 + (y2 - y1) * ratio;
      
      // Add some randomness to position
      const jitterX = (Math.random() - 0.5) * 7;
      const jitterY = (Math.random() - 0.5) * 5;
      
      // Random stone size
      const size = Math.random() * 0.2 + 0.1;
      
      stones.push({
        x: x + jitterX,
        y: y + jitterY,
        size: size,
        id: `stone-${i}`
      });
    }
    
    // Sort stones by y position (bottom to top)
    return stones.sort((a, b) => b.y - a.y);
  };

  // Ease-out function
  const easeOutQuad = (t) => {
    return 1 - (1 - t) * (1 - t);
  };

  // Handle stone scale animation
  useEffect(() => {
    if (visibleStones > 0 && stonePath.length > 0) {
      const lastStoneIndex = visibleStones - 1;
      if (lastStoneIndex < stonePath.length) {
        const stoneId = stonePath[lastStoneIndex].id;
        
        // Start animation for this stone
        setStoneAnimations(prev => ({
          ...prev,
          [stoneId]: {
            scale: 0,
            animating: true
          }
        }));
        
        // Animate scale from 0 to 1 over 300ms
        let startTime = null;
        const duration = 300;
        
        const animateScale = (timestamp) => {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const scale = easeOutQuad(progress);
          
          setStoneAnimations(prev => ({
            ...prev,
            [stoneId]: {
              scale: scale,
              animating: progress < 1
            }
          }));
          
          if (progress < 1) {
            requestAnimationFrame(animateScale);
          }
        };
        
        requestAnimationFrame(animateScale);
      }
    }
  }, [visibleStones, stonePath]);

  // Animate stones appearing
  useEffect(() => {
    if (stonePath.length > 0 && visibleStones < stonePath.length && isAnimating) {
      // Clear any existing animation
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      
      // Calculate total animation time and delays
      const totalAnimationTime = 3000; // 3 seconds in ms
      const avgDelayPerStone = totalAnimationTime / stonePath.length;
      
      // Calculate delay with ease-out effect
      // Start with short delays (fast) and gradually increase (slow down)
      const progress = visibleStones / stonePath.length;
      const easeOutProgress = easeOutQuad(progress);
      const minDelay = avgDelayPerStone * 0.5; // minimum delay
      const maxDelay = avgDelayPerStone * 1.5; // maximum delay
      const delay = minDelay + (easeOutProgress * (maxDelay - minDelay));
      
      // Set timeout for next stone
      animationRef.current = setTimeout(() => {
        setVisibleStones(prev => prev + 1);
      }, delay);
      
      // Cleanup
      return () => {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      };
    } else if (visibleStones >= stonePath.length && isAnimating) {
      // Animation complete
      setIsAnimating(false);
      
      // Stop audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [visibleStones, stonePath, isAnimating]);

  useEffect(() => {
    if (!selectedHouse) return;
    
    // Function to calculate line coordinates
    const calculateLineCoordinates = () => {
      let sourceElement;
      
      // Get the source element based on selected house
      if (selectedHouse === "sunset") {
        sourceElement = sunsetRef.current;
      } else if (selectedHouse === "mission") {
        sourceElement = missionRef.current;
      } else if (selectedHouse === "lowerhaight") {
        sourceElement = lowerHaightRef.current;
      }
      
      const targetElement = bottomBarRef.current;
      
      if (!sourceElement || !targetElement) return;
      
      // Get bounding rectangles
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      
      // Calculate positions
      const x1 = sourceRect.left + sourceRect.width / 2;
      const y1 = sourceRect.bottom + 10; // 10px below the text
      const x2 = targetRect.left + targetRect.width / 2;
      const y2 = targetRect.top;
      
      // Convert to percentages relative to the container
      const container = document.documentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      const coords = {
        x1: (x1 / containerWidth) * 100,
        y1: (y1 / containerHeight) * 100,
        x2: (x2 / containerWidth) * 100,
        y2: (y2 / containerHeight) * 100
      };
      
      setLineCoords(coords);
      
      // Generate new stone path
      setStonePath(generateStonePath(coords.x1, coords.y1, coords.x2, coords.y2));
      // Reset visible stones
      setVisibleStones(0);
      setIsAnimating(true);
      setStoneAnimations({});
      
      // Play sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
    };
    
    // Calculate initially
    calculateLineCoordinates();
    
    // Add resize event listener
    window.addEventListener('resize', calculateLineCoordinates);
    
    // Cleanup
    return () => window.removeEventListener('resize', calculateLineCoordinates);
  }, [selectedHouse]);

  // Button style
  const joinButtonStyle = {
    padding: "6px 16px",
    border: "1px solid black",
    borderRadius: "4px",
    backgroundColor: "white",
    cursor: isLoading ? "wait" : "pointer",
    marginBottom: "10px",
    fontWeight: "500",
    fontSize: "14px",
    opacity: isLoading ? 0.7 : 1
  };

  const leaveButtonStyle = {
    ...joinButtonStyle,
    backgroundColor: "#f0f0f0",
    borderColor: "#666"
  };

  // Render the appropriate view based on currentView state
  if (currentView === "mission") {
    return <MissionView onBack={handleBackFromView} />;
  }
  
  if (currentView === "lowerhaight") {
    return <LowerHaightView onBack={handleBackFromView} />;
  }
  
  if (currentView === "sunset") {
    return <SunsetView onBack={handleBackFromView} />;
  }

  return (
    <div>
      <div style={{display: 'flex', flexDirection: "column", justifyContent: "space-between", paddingTop: 32, paddingBottom: 32, height: "100vh", position: "relative"}}>
        {selectedHouse && (
          <svg 
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
              pointerEvents: "none"
            }}
          >
            {/* Stone path */}
            {stonePath.slice(0, visibleStones).map((stone, index) => {
              const animation = stoneAnimations[stone.id] || { scale: 1, animating: false };
              const currentSize = stone.size * animation.scale;
              
              return (
                <circle 
                  key={stone.id}
                  cx={`${stone.x}%`}
                  cy={`${stone.y}%`}
                  r={`${currentSize}%`}
                  fill="black"
                  opacity={0.8}
                />
              );
            })}
          </svg>
        )}
        
        {/* Audio element */}
        {isAnimating && (
          <audio 
            ref={audioRef}
            src="/stones.mp3" 
            loop={true}
          />
        )}
        
        <div
          style={{
            display: "flex",
            width: "calc(100vw)",
            justifyContent: "center",
            flexDirection: "row",
            gap: 96,
            paddingLeft: 32, 
            paddingRight: 32,
            position: "relative",
            zIndex: 1
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "33%" }}>
            {isAuthenticated && selectedHouse === null && (
              <button 
                style={joinButtonStyle}
                onClick={() => handleJoinHouse("sunset")}
                disabled={isLoading}
              >
                Join
              </button>
            )}
            {isAuthenticated && selectedHouse === "sunset" && (
              <button 
                style={leaveButtonStyle}
                onClick={handleLeaveHouse}
                disabled={isLoading}
              >
                Leave
              </button>
            )}
            <div
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 4,
                backgroundImage: "url('/sunset.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                cursor: "pointer"
              }}
              id="sunsetHouse"
              onClick={() => handleNeighborhoodClick("sunset")}
            />
            <p 
              ref={sunsetRef} 
              style={{ marginTop: 8, fontWeight: "500", cursor: "pointer" }}
              onClick={() => handleNeighborhoodClick("sunset")}
            >
              Sunset
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "33%" }}>
            {isAuthenticated && selectedHouse === null && (
              <button 
                style={joinButtonStyle}
                onClick={() => handleJoinHouse("mission")}
                disabled={isLoading}
              >
                Join
              </button>
            )}
            {isAuthenticated && selectedHouse === "mission" && (
              <button 
                style={leaveButtonStyle}
                onClick={handleLeaveHouse}
                disabled={isLoading}
              >
                Leave
              </button>
            )}
            <div
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 4,
                backgroundImage: "url('/mission.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                cursor: "pointer"
              }}
              id="missionHouse"
              onClick={() => handleNeighborhoodClick("mission")}
            />
            <p 
              ref={missionRef} 
              style={{ marginTop: 8, fontWeight: "500", cursor: "pointer" }}
              onClick={() => handleNeighborhoodClick("mission")}
            >
              Mission
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "33%" }}>
            {isAuthenticated && selectedHouse === null && (
              <button 
                style={joinButtonStyle}
                onClick={() => handleJoinHouse("lowerhaight")}
                disabled={isLoading}
              >
                Join
              </button>
            )}
            {isAuthenticated && selectedHouse === "lowerhaight" && (
              <button 
                style={leaveButtonStyle}
                onClick={handleLeaveHouse}
                disabled={isLoading}
              >
                Leave
              </button>
            )}
            <div
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 4,
                backgroundImage: "url('/lowerhaight.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                cursor: "pointer"
              }}
              id="lowerHaight"
              onClick={() => handleNeighborhoodClick("lowerhaight")}
            />
            <p 
              ref={lowerHaightRef} 
              style={{ marginTop: 8, fontWeight: "500", cursor: "pointer" }}
              onClick={() => handleNeighborhoodClick("lowerhaight")}
            >
              Lower Haight
            </p>
          </div>
        </div>
        
        <div
          ref={bottomBarRef}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            position: "relative",
            zIndex: 1,
            width: "100%",
            paddingLeft: 32,
            paddingRight: 32
          }}
        >
          {/* Mailbox icon on the left with white background and black border */}
          <div style={{
            width: "40px",
            height: "40px",
            backgroundColor: "#fff",
            borderRadius: "4px",
            border: "1px solid #000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer"
          }}>
            {/* Simple mailbox icon using SVG - now black */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 6L12 13L2 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          {/* Bottom bar in the middle */}
          <BottomBar
            availableApps={availableApps}
            selectedApp={selectedApp}
            setSelectedApp={setSelectedApp}
            isAppDropupOpen={isAppDropupOpen}
            setIsAppDropupOpen={setIsAppDropupOpen}
          />
          
          {/* Profile picture on the right */}
          <div style={{
            width: "40px",
            height: "40px",
            backgroundColor: "#fff",
            borderRadius: "4px",
            border: "1px solid #000",
            cursor: "pointer",
            backgroundImage: profilePicture ? `url(${profilePicture})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}>
            {!profilePicture && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" stroke="black" strokeWidth="2"/>
                <path d="M5 20C5 16.6863 7.68629 14 11 14H13C16.3137 14 19 16.6863 19 20" stroke="black" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </div>
        </div>
      </div>

      {isLoginPopupOpen && (
        <div style={{position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1}}>
          <LoginComponentOS
          setIsLoginPopupOpen={setIsLoginPopupOpen}
          setIsSignedIn={setIsSignedIn}
          setUserData={setUserData}
          setNeighborhoodToken={setNeighborhoodToken}
        />      
        </div>)}
    </div>
  );
}


