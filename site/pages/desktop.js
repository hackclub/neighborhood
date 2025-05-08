import Head from "next/head";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "@/styles/Home.module.css";
import dynamic from "next/dynamic";
import SignupComponent from "@/components/SignupComponent";
import RewardsComponent from "@/components/RewardsComponent";
import JournalComponent from "@/components/JournalComponent";
import BulletinComponent from "@/components/BulletinComponent";
import HackTimeComponent from "@/components/HackTimeComponent";
import NeighborhoodPopup from "@/components/NeighborhoodPopup";
import ChallengesComponent from "@/components/ChallengesComponent";
import { useState, useEffect, useRef } from "react";
import { getToken, removeToken } from "@/utils/storage";
import { updateSlackUserData } from "@/utils/slack";

const NeighborhoodEnvironment = dynamic(
  () => import("@/components/NeighborhoodEnvironment"),
  { ssr: false },
);

export default function Home() {
  const funFacts = [
    "🌉 The Golden Gate Bridge isn’t actually golden—it's international orange!",
    "💡 Alcatraz was the first US lighthouse on the West Coast.",
    "⛰️ SF is built on more than 50 hills!",
    "🥠 Fortune cookies were invented here, not China.",
    "🧧 SF has the second largest Chinatown outside of Asia.",
    "🌳 There are more than 200 parks in San Francisco.",
    "🚋 SF is home to the oldest cable car system in the world.",
    "🐟 It’s illegal to own a pet goldfish in San Francisco.",
    "🏘️ SF has the largest collection of Victorian houses in the world.",
    "🌫️ There are more than 300 days of fog in SF each year.",
    "🎨 SF is home to the famous Painted Ladies, a row of colorful Victorian houses.",
    "🍞 SF is known for its sourdough bread, which has a unique flavor due to the local wild yeast.",
  ];
  const [sfFact, setSfFact] = useState(funFacts[Math.floor(Math.random() * funFacts.length)]);
  const getNextFact = () => {
    let newFact;
    do {
      newFact = funFacts[Math.floor(Math.random() * funFacts.length)];
    } while (newFact === sfFact);
    setSfFact(newFact);
  };
  const [UIPage, setUIPage] = useState("");
  const [hasEnteredNeighborhood, setHasEnteredNeighborhood] = useState(false);
  const [selectedItem, setSelectedItem] = useState("start");
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [userData, setUserData] = useState();
  const [token, setToken] = useState("");
  const [showNeighborhoodPopup, setShowNeighborhoodPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [weatherTexture, setWeatherTexture] = useState("sunny.svg");
  const [currentTime, setCurrentTime] = useState("");
  const [isAM, setIsAM] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [connectingSlack, setConnectingSlack] = useState(false);
  const [slackUsers, setSlackUsers] = useState([]);
  const [searchSlack, setSearchSlack] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // Handle clicks outside profile dropdown
  useEffect(() => {
    setHasEnteredNeighborhood(false);
    const handleClickOutside = (event) => {
      const dropdown = document.getElementById("profile-dropdown");
      const profileImage = document.getElementById("profile-image");

      if (
        dropdown &&
        profileImage &&
        !dropdown.contains(event.target) &&
        !profileImage.contains(event.target)
      ) {
        setProfileDropdown(false);
        setConnectingSlack(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update time in Animal Crossing format
  useEffect(() => {
    const updateACTime = () => {
      const now = new Date();
      // Get time in Los Angeles (Animal Crossing-style uses 12-hour format)
      const options = {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      };

      const timeString = new Intl.DateTimeFormat("en-US", options).format(now);

      // Split into time and AM/PM
      const [time, period] = timeString.split(" ");

      // Set states
      setCurrentTime(time);
      setIsAM(period === "AM");
    };

    // Update immediately and then every minute
    updateACTime();
    const intervalId = setInterval(updateACTime, 60000);

    return () => clearInterval(intervalId);
  }, []);
  const fetchWeather = async () => {
    const response = await fetch("https://wttr.in/SFO?format=%C&lang=en");
    const data = await response.text();
    console.log(data);
    console.log(classifyWeather(data));
    setWeatherTexture(`./${classifyWeather(data)}.svg`);
  };
  fetchWeather();

  const banjoSound = useRef(null);
  const backgroundMusic = useRef(null);

  function classifyWeather(condition) {
    const c = condition.toLowerCase();

    // Sunny or clear conditions
    if (
      c.includes("sun") ||
      c.includes("clear") ||
      c.includes("blazing") ||
      c.includes("bright")
    ) {
      return "sunny";
    }

    // Rainy or thunderstorm conditions
    if (
      c.includes("rain") ||
      c.includes("showers") ||
      c.includes("thunder") ||
      c.includes("drizzle") ||
      c.includes("sleet") ||
      c.includes("blizzard") ||
      c.includes("torrential")
    ) {
      return "rain";
    }

    // Cloudy or overcast conditions
    if (
      c.includes("cloud") ||
      c.includes("overcast") ||
      c.includes("mist") ||
      c.includes("fog") ||
      c.includes("haze") ||
      c.includes("freezing fog") ||
      c.includes("patchy snow") ||
      c.includes("blowing snow")
    ) {
      return "cloud";
    }

    // Default to "cloud" if not specifically categorized
    return "cloud";
  }

  useEffect(() => {
    const token = getToken();
    console.log(token);
    setIsSignedIn(!!token);

    // If user is signed in, update their Slack data
    if (token) {
      setIsLoading(true);
      updateSlackUserData(token)
        .then((data) => {
          setUserData(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to update user data:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    // Initialize audio
    banjoSound.current = new Audio("/banjo.mp3");
    backgroundMusic.current = new Audio("/littlething.mp3");
    backgroundMusic.current.loop = true;
  }, [hasEnteredNeighborhood]);

  useEffect(() => {
    if (isSignedIn && !UIPage && backgroundMusic.current) {
      if (!isMuted) {
        backgroundMusic.current.play();
      }
    } else if (backgroundMusic.current) {
      backgroundMusic.current.pause();
      backgroundMusic.current.currentTime = 0;
    }
  }, [UIPage, isSignedIn, isMuted]);

  const playBanjoSound = () => {
    if (banjoSound.current) {
      banjoSound.current.currentTime = 0;
      banjoSound.current.play();
    }
  };

  const handleLogout = () => {
    removeToken();
    window.location.reload();
  };

  const handleCloseComponent = () => {
    setIsExiting(true);
    setTimeout(() => {
      setUIPage("");
      setIsExiting(false);
    }, 300); // Match animation duration
  };

  const handleMenuItemClick = (itemId) => {
    playBanjoSound();
    setUIPage(itemId);
  };

  const menuItems = [
    { id: "start", text: "Start Hacking" },
    { id: "challenges", text: "Challenges" },
    { id: "bulletin", text: "Bulletin" },
    // { id: "sf_facts", text: "SF Fun Facts" }, // removed from menu
    // { id: 'journal', text: 'Journal' },
    // { id: 'rewards', text: 'Rewards' }
  ];

  // Fetch Slack users when connectingSlack becomes true
  useEffect(() => {
    if (connectingSlack) {
      fetch("/api/getSlackUsers")
        .then((res) => res.json())
        .then((data) => setSlackUsers(data.users || []))
        .catch(() => setSlackUsers([]));
    }
  }, [connectingSlack]);

  // Deduplicate Slack users by Slack ID
  const uniqueSlackUsers = [];
  const seenSlackIds = new Set();
  for (const user of slackUsers) {
    if (user.slackId && !seenSlackIds.has(user.slackId)) {
      uniqueSlackUsers.push(user);
      seenSlackIds.add(user.slackId);
    }
  }

  const toggleMute = () => {
    if (backgroundMusic.current) {
      if (isMuted) {
        backgroundMusic.current.play();
      } else {
        backgroundMusic.current.pause();
      }
      setIsMuted(!isMuted);
    }
  };

  return (
    <>
      <Head>
        <title>Neighborhood</title>
        <meta name="description" content="a place we gather" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {isSignedIn ? (
        <>
          <div
            style={{
              position: "absolute",
              top: "40px",
              left: "40px",
              right: "40px",
              bottom: "40px",
              zIndex: 10,
              pointerEvents: UIPage || showNeighborhoodPopup ? "auto" : "none",
            }}
          >
            {showNeighborhoodPopup && (
              <NeighborhoodPopup
                onClose={() => setShowNeighborhoodPopup(false)}
              />
            )}
            {(UIPage == "rewards" || (isExiting && UIPage === "rewards")) && (
              <RewardsComponent
                isExiting={isExiting}
                onClose={handleCloseComponent}
                setUIPage={setUIPage}
              />
            )}
            {(UIPage == "journal" || (isExiting && UIPage === "journal")) && (
              <JournalComponent
                isExiting={isExiting}
                token={token}
                onClose={handleCloseComponent}
              />
            )}
            {(UIPage == "bulletin" || (isExiting && UIPage === "bulletin")) && (
              <BulletinComponent
                isExiting={isExiting}
                onClose={handleCloseComponent}
              />
            )}
            {(UIPage == "challenges" ||
              (isExiting && UIPage === "challenges")) && (
              <ChallengesComponent
                isExiting={isExiting}
                onClose={handleCloseComponent}
              />
            )}
            {(UIPage == "start" || (isExiting && UIPage === "start")) && (
              <HackTimeComponent
                isExiting={isExiting}
                onClose={handleCloseComponent}
                userData={userData}
                setUserData={setUserData}
                slackUsers={slackUsers}
                setSlackUsers={setSlackUsers}
                connectingSlack={connectingSlack}
                setConnectingSlack={setConnectingSlack}
                searchSlack={searchSlack}
                setSearchSlack={setSearchSlack}
                setUIPage={setUIPage}
                isMuted={isMuted}
              />
            )}
            {(UIPage == "sf_facts" || (isExiting && UIPage === "sf_facts")) && (
              <div
                style={{
                  backgroundColor: "#F5F7E1",
                  padding: 32,
                  borderRadius: 12,
                  maxWidth: 600,
                  margin: "auto",
                  marginTop: 100,
                  fontFamily: "M PLUS Rounded 1c",
                  color: "#222",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <h2
                  style={{
                    fontFamily: "M PLUS Rounded 1c",
                    fontWeight: "bold",
                    fontSize: 32,
                    marginBottom: 24,
                  }}
                >
                  Did you know?
                </h2>
                <p
                  style={{
                    fontSize: 22,
                    lineHeight: "1.6",
                    marginBottom: 24,
                    minHeight: 64,
                  }}
                >
                  {sfFact}
                </p>
                <div style={{ display: "flex", gap: 16 }}>
                  <button
                    onClick={getNextFact}
                    style={{
                      backgroundColor: "#007C74",
                      color: "#FFF9E6",
                      padding: "8px 16px",
                      border: "1px solid #FFF9E6",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "M PLUS Rounded 1c",
                      fontSize: 18,
                      fontWeight: "bold",
                    }}
                  >
                    Next
                  </button>
                  <button
                    onClick={handleCloseComponent}
                    style={{
                      backgroundColor: "#000",
                      color: "#FFF9E6",
                      padding: "8px 16px",
                      border: "1px solid #FFF9E6",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "M PLUS Rounded 1c",
                      fontSize: 18,
                      fontWeight: "bold",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
          {!hasEnteredNeighborhood && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                height: "100vh",
                width: "100vw",
                zIndex: 0,
                overflow: "hidden",
              }}
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  position: "absolute",
                  zIndex: 0,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <source src="video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {hasEnteredNeighborhood && (
            <NeighborhoodEnvironment
              hasEnteredNeighborhood={hasEnteredNeighborhood}
              setHasEnteredNeighborhood={setHasEnteredNeighborhood}
            />
          )}

          <div style={{ position: "relative", zIndex: 5 }}>
            <div
              style={{
                height: "100vh",
                width: "100%",
                gap: 32,
                justifyContent: "space-between",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: 16,
                  display: "flex",
                  gap: 8,
                }}
              >
                {!hasEnteredNeighborhood && (
                  <>
                    <div
                      onClick={toggleMute}
                      style={{
                        width: 42,
                        height: 42,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #B5B5B5",
                        transition:
                          "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        transform: "scale(1)",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        ":hover": {
                          transform: "scale(1.05)",
                          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                        },
                        ":active": {
                          transform: "scale(0.95)",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        },
                      }}
                    >
                      <img
                        src={isMuted ? "/volume_off.svg" : "/volume.svg"}
                        style={{
                          width: 24,
                          height: 24,
                          opacity: 0.8,
                          transition: "all 0.2s ease",
                          transform: isMuted ? "scale(0.9)" : "scale(1)",
                        }}
                        alt={isMuted ? "Unmute" : "Mute"}
                      />
                    </div>
                    <div>
                      <img
                        id="profile-image"
                        style={{
                          width: 42,
                          border: "1px solid #B5B5B5",
                          backgroundColor: "#B5B5B5",
                          borderRadius: 8,
                          height: 42,
                          cursor: "pointer",
                        }}
                        src={userData?.profilePicture}
                        onClick={() => setProfileDropdown(true)}
                      />
                      {profileDropdown && (
                        <div
                          id="profile-dropdown"
                          style={{
                            position: "absolute",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            width: 240,
                            top: 48,
                            right: 0,
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: "#fff",
                            zIndex: 2,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              border: "1px solid #B5B5B5",
                              borderRadius: 8,
                              alignItems: "center",
                              flexDirection: "row",
                              gap: 8,
                              padding: 8,
                              minHeight: 40,
                            }}
                          >
                            {userData?.slackHandle ? (
                              <>
                                <img
                                  style={{
                                    width: 24,
                                    border: "1px solid #B5B5B5",
                                    backgroundColor: "#B5B5B5",
                                    borderRadius: 8,
                                    height: 24,
                                    cursor: "pointer",
                                  }}
                                  src={userData?.profilePicture}
                                  onClick={() => setProfileDropdown(true)}
                                />
                                <div>
                                  <p style={{ fontSize: 14 }}>
                                    @{userData?.slackHandle}
                                  </p>
                                  <p style={{ fontSize: 8 }}>
                                    Slack ID: {userData?.slackId}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: 14,
                                  color: "#b77",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span role="img" aria-label="warning">
                                  ⚠️
                                </span>
                                We're not finding a slack profile attached to
                                your account. Make sure you're using the same
                                email as your slack account
                              </span>
                            )}
                          </div>
                          {/* {!connectingSlack ?
                        <button
                         style={{backgroundColor: "#fff", cursor: "pointer", border: "1px solid #000", padding: 6, borderRadius: 6}}
                         onClick={() => setConnectingSlack(true)}
                        >Connect Slack</button> :
                        <div style={{width: '100%', marginBottom: 8}}>
                          <input
                            type="text"
                            value={searchSlack}
                            onChange={e => setSearchSlack(e.target.value.replace(/@/g, ""))}
                            placeholder="Search Slack handle"
                            style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 8, fontSize: 14}}
                          />
                          {searchSlack.length > 0 && (
                            <div style={{maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, background: '#fafafa'}}>
                              {uniqueSlackUsers.length === 0 ? (
                                <div style={{padding: 12, textAlign: 'center', color: '#888'}}>Loading Slack users...</div>
                              ) : (
                                uniqueSlackUsers
                                  .filter(user => {
                                    if (!user.slackHandle || user.slackHandle.trim() === "") return false;
                                    const handle = (user.slackHandle || '').toLowerCase();
                                    const name = (user.fullName || '').toLowerCase();
                                    const search = (searchSlack || '').toLowerCase();
                                    return handle.includes(search) || name.includes(search);
                                  })
                                  .sort((a, b) => {
                                    const handleA = (a.slackHandle || '').toLowerCase();
                                    const nameA = (a.fullName || '').toLowerCase();
                                    const handleB = (b.slackHandle || '').toLowerCase();
                                    const nameB = (b.fullName || '').toLowerCase();
                                    const search = (searchSlack || '').toLowerCase();
                                    // Prioritize startsWith, then includes
                                    const aStarts = handleA.startsWith(search) || nameA.startsWith(search);
                                    const bStarts = handleB.startsWith(search) || nameB.startsWith(search);
                                    if (aStarts && !bStarts) return -1;
                                    if (!aStarts && bStarts) return 1;
                                    // If both or neither start, sort alphabetically by handle
                                    return handleA.localeCompare(handleB);
                                  })
                                  .slice(0, 10)
                                  .map(user => {
                                    const displayHandle = user.slackHandle?.startsWith('@') ? user.slackHandle.slice(1) : user.slackHandle;
                                    return (
                                      <div
                                        key={user.slackId}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          padding: 8,
                                          cursor: 'pointer',
                                          borderBottom: '1px solid #eee'
                                        }}
                                        onClick={async () => {
                                          // Get token from localStorage if not already in state
                                          const token = window.localStorage.getItem('neighborhoodToken');
                                          const res = await fetch('/api/connectSlack', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              token,
                                              slackId: user.slackId,
                                              slackHandle: user.slackHandle,
                                              fullName: user.fullName,
                                              pfp: user.pfp
                                            })
                                          });
                                          if (res.ok) {
                                            // Update UI: set userData, close dropdown, etc.
                                            setUserData(prev => ({
                                              ...prev,
                                              slackHandle: user.slackHandle,
                                              profilePicture: user.pfp,
                                              fullName: user.fullName,
                                              slackId: user.slackId
                                            }));
                                            setConnectingSlack(false);
                                            setProfileDropdown(false);
                                          } else {
                                            // Optionally handle error
                                            alert('Failed to link Slack account');
                                          }
                                        }}
                                      >
                                        {user.pfp ? (
                                          <img src={user.pfp} alt={user.slackHandle} style={{width: 28, height: 28, borderRadius: 6, border: '1px solid #ccc', background: '#eee'}} />
                                        ) : (
                                          <div style={{width: 28, height: 28, borderRadius: 6, background: '#000', border: '1px solid #ccc'}} />
                                        )}
                                        <div>
                                          <div style={{fontWeight: 'bold', fontSize: 14}}>@{displayHandle}</div>
                                          <div style={{fontSize: 12, color: '#666'}}>{user.fullName}</div>
                                        </div>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          )}
                        </div>
                        } */}

                          {userData?.slackHandle && (
                            <button
                              style={{
                                backgroundColor: "#fff",
                                cursor: "pointer",
                                color: "#000",
                                border: "1px solid #000",
                                padding: 6,
                                borderRadius: 6,
                                marginBottom: 8,
                              }}
                              onClick={async () => {
                                try {
                                  let token =
                                    localStorage.getItem("neighborhoodToken");
                                  if (!token) {
                                    token = getToken();
                                  }
                                  if (!token) {
                                    throw new Error(
                                      "No authentication token found",
                                    );
                                  }

                                  const response = await fetch(
                                    "/api/deleteSlackMember",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ token }),
                                    },
                                  );

                                  const data = await response.json();

                                  if (!response.ok) {
                                    throw new Error(
                                      data.error ||
                                        "Failed to disconnect Slack account",
                                    );
                                  }

                                  // Update UI to remove Slack data
                                  setUserData((prev) => ({
                                    ...prev,
                                    slackHandle: null,
                                    profilePicture: null,
                                    fullName: null,
                                    slackId: null,
                                  }));

                                  setProfileDropdown(false);
                                } catch (error) {
                                  console.error(
                                    "Error disconnecting Slack:",
                                    error,
                                  );
                                  alert(
                                    error.message ||
                                      "Failed to disconnect Slack account",
                                  );
                                }
                              }}
                            >
                              Disconnect Slack Account
                            </button>
                          )}

                          <button
                            style={{
                              backgroundColor: "#000",
                              cursor: "pointer",
                              color: "#fff",
                              border: "1px solid #000",
                              padding: 6,
                              borderRadius: 6,
                            }}
                            onClick={() => {
                              setProfileDropdown(false);
                              handleLogout();
                            }}
                          >
                            Logout
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div style={{ position: "absolute", right: 16, bottom: 32 }}>
                {!hasEnteredNeighborhood && (
                  <button
                    onClick={() => setShowNeighborhoodPopup(true)}
                    style={{
                      padding: "8px 16px",
                      opacity: 0.3,
                      fontFamily: "M PLUS Rounded 1c",
                      fontSize: "24px",
                      border: "1px solid #FFF9E6",
                      background: "none",
                      cursor: "pointer",
                      backgroundColor: "#007C74",
                      backgroundColor: "#007C74",
                      color: "#FFF9E6",
                      fontWeight: "bold",
                      borderRadius: "8px",
                    }}
                  >
                    Explore Neighborhood
                  </button>
                )}
              </div>

              {!hasEnteredNeighborhood && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    paddingLeft: 32,
                    paddingTop: 32,
                    paddingRight: 32,
                    paddingBottom: 32,
                    height: "100%",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <img
                      style={{ width: 250, imageRendering: "pixelated" }}
                      src="./neighborhoodLogo.png"
                    />
                    {menuItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: isLoading ? "wait" : "pointer",
                          opacity: isLoading ? 0.5 : 1,
                        }}
                        onMouseEnter={() =>
                          !isLoading && setSelectedItem(item.id)
                        }
                        onMouseLeave={() => {}}
                        onClick={() =>
                          !isLoading && handleMenuItemClick(item.id)
                        }
                      >
                        <span
                          style={{
                            fontFamily: "M PLUS Rounded 1c",
                            fontSize: "24px",
                            color: "#FFF9E6",
                            visibility:
                              selectedItem === item.id ? "visible" : "hidden",
                            animation:
                              selectedItem === item.id
                                ? "blink 1s steps(1) infinite"
                                : "none",
                            fontWeight: "bold",
                          }}
                        >
                          {"●"}
                        </span>
                        <p
                          style={{
                            fontFamily: "M PLUS Rounded 1c",
                            fontSize: "32px",
                            color: "#F5F7E1",
                            fontWeight: "bold",
                          }}
                        >
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "8px 16px",
                      fontFamily: "M PLUS Rounded 1c",
                      fontSize: "24px",
                      background: "none",
                      display: "flex",
                      flexDirection: "row",
                      color: "#FFF9E6",
                      fontWeight: "bold",
                      borderRadius: "8px",
                      width: "fit-content",
                    }}
                  >
                    {/* Time Display */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "M PLUS Rounded 1c",
                          fontSize: "24px",
                          color: "#FFF9E6",
                          fontWeight: "bold",
                          margin: 0,
                          alignSelf: "flex-end",
                          justifySelf: "flex-end",
                        }}
                      >
                        {currentTime}
                      </p>
                      <span
                        style={{
                          fontFamily: "M PLUS Rounded 1c",
                          fontSize: "16px",
                          marginLeft: "4px",
                          fontWeight: "bold",
                          justifySelf: "flex-end",
                          alignSelf: "flex-end",
                          paddingBottom: 4,
                        }}
                      >
                        {isAM ? "am" : "pm"}
                      </span>
                    </div>

                    {/* Weather Icon and SF Fun Facts Button */}
                    <div
                      className="weathericon"
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <img
                        style={{
                          height: "100%",
                          paddingLeft: 8,
                        }}
                        src={weatherTexture}
                      />
                      <button
                        onClick={() => setUIPage("sf_facts")}
                        style={{
                          padding: "8px 16px",
                          fontFamily: "M PLUS Rounded 1c",
                          fontSize: "24px",
                          border: "1px solid #FFF9E6",
                          background: "none",
                          cursor: "pointer",
                          backgroundColor: "#007C74",
                          color: "#FFF9E6",
                          fontWeight: "bold",
                          borderRadius: "8px",
                          marginLeft: 16,
                        }}
                      >
                        SF Fun Facts
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <style jsx global>{`
              @keyframes blink {
                0% {
                  visibility: visible;
                }
                50% {
                  visibility: hidden;
                }
                100% {
                  visibility: visible;
                }
              }

              @keyframes popIn {
                0% {
                  opacity: 0;
                  transform: scale(0.95);
                }
                100% {
                  opacity: 1;
                  transform: scale(1);
                }
              }

              @keyframes popOut {
                0% {
                  opacity: 1;
                  transform: scale(1);
                }
                100% {
                  opacity: 0;
                  transform: scale(0.95);
                }
              }

              .pop-in {
                animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
              }

              .pop-in.hidden {
                animation: popOut 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                opacity: 0;
                transform: scale(0.95);
              }
            `}</style>
          </div>
        </>
      ) : (
        <SignupComponent />
      )}
    </>
  );
}
