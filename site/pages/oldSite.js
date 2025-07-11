import Head from "next/head";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import styles from "@/styles/Home.module.css";

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    birthday: ""
  });
  const [hasBirthdayFocus, setHasBirthdayFocus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSignedUp, setHasSignedUp] = useState(false);
  const [error, setError] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const [showLetter, setShowLetter] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showVideo) {
        setShowVideo(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showVideo]);

  const downloadApp = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    let downloadUrl = '';

    if (userAgent.includes('mac')) {
      downloadUrl = 'https://kodan-videos.s3.us-east-2.amazonaws.com/Neighborhood+1.0.0.dmg';
    } else if (userAgent.includes('win')) {
      downloadUrl = 'https://kodan-videos.s3.us-east-2.amazonaws.com/Neighborhood-win32-x64.zip';
    } else if (userAgent.includes('linux')) {
      downloadUrl = 'https://kodan-videos.s3.us-east-2.amazonaws.com/Neighborhood-linux-x64.tar.gz';
    } else {
      // Mobile device - no download, just show message
      return;
    }

    // Create a temporary link element to trigger the download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const bounceKeyframes = `
    @keyframes gentleBounce {
      0%, 100% {
        transform: translateY(0) rotate(0deg);
      }
      25% {
        transform: translateY(-6px) rotate(-2deg);
      }
      75% {
        transform: translateY(-6px) rotate(2deg);
      }
    }

    @keyframes fadeInScale {
      0% {
        opacity: 0;
        transform: translate(-50%, -10px) scale(0.95);
      }
      100% {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }
    }

    @keyframes alertPulse {
      0%, 100% {
        background-color: #786A50;
      }
      50% {
        background-color: #FF7C68;
      }
    }
  `;

  useEffect(() => {
    if (router.isReady) {
      const { name, email, birthday } = router.query;
      
      // Only update fields that are present in the URL
      const newFormData = { ...formData };
      if (name) newFormData.name = name.trim();
      if (email) newFormData.email = email.trim();
      if (birthday) {
        // Convert ISO date format to YYYY-MM-DD if needed
        newFormData.birthday = birthday.includes('T') ? 
          new Date(birthday).toISOString().split('T')[0] : 
          birthday;
        setHasBirthdayFocus(true);
      }
      
      setFormData(newFormData);
    }
  }, [router.isReady, router.query]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError("");

    // Calculate age from birthday
    const birthDate = new Date(formData.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age > 18) {
      setError("You're too old for Neighborhood. It's 18 & under");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/firstTimeNewUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          fullName: formData.name.trim(),
          birthday: formData.birthday
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
        return;
      }

      // Set signup success state
      setHasSignedUp(true);
      
      // Trigger app download for desktop users
      if (!navigator.userAgent.toLowerCase().includes('mobile')) {
        downloadApp();
      }
      
    } catch (err) {
      setError(err.message || 'Failed to register. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{bounceKeyframes}</style>
      <Head>
        <title>Neighborhood</title>
        <meta name="description" content="somewhere new" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={{
        display: 'flex', 
        height: "100vh", 
        flexDirection: "column", 
        justifyContent: "center", 
        alignItems: "center",
        fontFamily: "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        width: "100vw",
        position: "relative",
        overflow: "hidden"
      }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 1
          }}
          src="./background.mp4"
        />
        <img style={{maxWidth: "100%", marginBottom: 16, width: 400, zIndex: 3}} src="./neighborhoodLogo.png"/>
        <div style={{position: "relative", zIndex: 2, marginTop: 0,}}>
          <div style={{position: "relative", zIndex: 1}}>
            {!hasSignedUp ? (
              <>
                <div style={{
                  position: "absolute",
                  left: "50%",
                  top: 16,
                  transform: "translateX(-50%)",
                  width: 320,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}>
                  <p style={{
                    fontWeight: 600,
                    color: "#786A50",
                    textAlign: "left",
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    margin: 0
                  }}>howdy! If you spend 100 hours coding your own web/mobile app this May, you're guaranteed a spot in one of our houses and a flight to SF in June!</p>
                  <div>
               <input 
                  placeholder="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px 8px 0px 0px",
                    display: "flex",
                    width: "100%",
                    border: "2px solid #786A50",
                    backgroundColor: "#FFF9E6",
                    color: "#666666",
                    fontSize: "14px",
                    fontWeight: 500,
                    fontFamily: "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                  }}
                />
                <div style={{
                  display: "flex", 
                  border: "2px solid #786A50",
                  borderTop: "0px",
                  borderRadius: "0 0 8px 8px",
                  marginTop: 0, 
                  width: "100%", 
                  flexDirection: "row",
                  overflow: "hidden"
                }}>
                <input 
                  placeholder="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 0,
                    marginTop: 0,
                    display: "flex",
                    width: "100%",
                    border: "0px",
                    borderRight: "2px solid #786A50",
                    backgroundColor: "#FFF9E6",
                    color: "#666666",
                    fontSize: "14px",
                    fontWeight: 500,
                    fontFamily: "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                  }}
                />

                 <div style={{position: "relative", width: "100%"}}>
                   {!hasBirthdayFocus ? (
                     <div 
                       onClick={() => setHasBirthdayFocus(true)}
                       style={{
                         padding: "6px 12px",
                         display: "flex",
                         marginTop: 0,
                         width: "100%",
                         borderRadius: 0,
                         border: "0px",
                         borderLeft: "0px",
                         backgroundColor: "#FFF9E6",
                         color: "#666666",
                         fontSize: "14px",
                         fontWeight: 500,
                         cursor: "text",
                         fontFamily: "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                       }}
                     >
                       birthday
                     </div>
                   ) : (
                     <input 
                       type="date"
                       value={formData.birthday}
                       onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
                       onBlur={(e) => {
                         if (!e.target.value) {
                           setHasBirthdayFocus(false);
                         }
                       }}
                       style={{
                         padding: "6px 12px",
                         display: "flex",
                         marginTop: 0,
                         width: "100%",
                         borderRadius: 0,
                         border: "0px",
                         borderLeft: "0px",
                         backgroundColor: "#FFF9E6",
                         color: "#666666",
                         fontSize: "14px",
                         fontWeight: 500,
                         fontFamily: "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                       }}
                     />
                   )}
                 </div>
                 </div>
                 <div style={{display: "flex", height: 0, justifyContent: "space-between"}}>
                 <p style={{fontSize: 8, fontWeight: 800, color: "#786A50"}}>full name</p>
                 <p style={{fontSize: 8, fontWeight: 800, color: "#786A50"}}>birthday (18yr old & under only)</p>
                 </div>
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting || !formData.email || !formData.name || !formData.birthday}
                    style={{
                      marginTop: "12px",
                      padding: "12px 24px",
                      backgroundColor: isSubmitting ? "#18A69A" : "#F7D359",
                      color: isSubmitting ? "#FBFBE6" : "#786A50",
                      border: "2px solid #786A50",
                      borderRadius: 100,
                      fontSize: "14px",
                      fontWeight: 800,
                      fontFamily: "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      width: "100%"
                    }}
                  >
                   {isSubmitting ? 'Joining...' : 'Join Us In San Francisco'}
                  </button>
                  {error && (
                    <p style={{
                      color: "#ff4444",
                      fontSize: "12px",
                      marginTop: "8px",
                      textAlign: "center"
                    }}>
                      {error}
                    </p>
                  )}
                 </div>

               </div>
               <img src="textBubble.svg"/>
             </>
            ) : (
              <>
                <div style={{
                  position: "absolute",
                  left: "50%",
                  zIndex: 7,
                  top: 16,
                  transform: "translateX(-50%)",
                  width: 420,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  backgroundColor: "#3F586C",
                  padding: "32px",
                  borderRadius: "16px",
                  color: "white",
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: "18px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  animation: "fadeInScale 0.5s ease-out forwards",
                  marginBottom: "16px"
                }}>
                  <div>Welcome to the Neighborhood! Head over to the{" "}<a href="https://hackclub.slack.com/archives/C073L9LB4K1">#neighborhood</a>{" "}and meet your future roommates!</div>
                  {!navigator.userAgent.toLowerCase().includes('mobile') ? (
                    <div style={{
                      marginTop: "16px",
                      fontSize: "16px",
                      color: "#B8D4FF",
                      fontWeight: "500"
                    }}>
                      Downloading Neighborhood app...
                    </div>
                  ) : (
                    <div style={{
                      marginTop: "16px",
                      fontSize: "16px",
                      color: "#B8D4FF",
                      fontWeight: "500"
                    }}>
                      Check your email for the app download link for your computer :)
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
        
        <br/>
        {/* PLEASE UNIVERSE DO NOT DELETE THESE BUTTONS  */}
        {!hasSignedUp &&
        <div style={{
                display: "flex", 
                marginTop: 24,
                flexDirection: "row", 
                gap: 12, 
                zIndex: 2,
                alignItems: "center",
                width: "calc(100%)",
                justifyContent: "center"
              }}>
                    <button 
                        onClick={() => setShowLetter(true)}
                    style={{
                      backgroundColor: "#FFF9E6", 
                      display: "flex", 
                      flexDirection: "row", 
                      alignItems: "center", 
                      gap: 8, 
                      border: "1px solid #786A50", 
                      color: "#786A50", 
                      fontWeight: 800, 
                      cursor: "pointer",
                      borderRadius: 96, 
                      padding: "4px 16px 4px 4px",
                    }}>
                      <div style={{
                        height: 24, 
                        borderRadius: 16, 
                        width: 24, 
                        backgroundColor: "#786A50", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        animation: "alertPulse 3s ease-in-out infinite"
                      }}>
                        <img src="/mail.svg" style={{height: 16, width: 16}} />
                      </div>
                      Letter to You
                    </button>
                    <button 
                      onClick={() => setShowVideo(true)}
                      style={{
                        backgroundColor: "#18A69A", 
                        display: "flex", 
                        flexDirection: "row", 
                        alignItems: "center", 
                        gap: 8, 
                        border: "1px solid #7CC9C3", 
                        color: "#FFFBE7", 
                        fontWeight: 800, 
                        borderRadius: 96, 
                        padding: "4px 16px 4px 4px",
                        cursor: "pointer",
                        animation: "gentleBounce 2s infinite ease-in-out"
                      }}>
                      <div style={{height: 24, borderRadius: 16, width: 24, backgroundColor: "#FFFBE7", display: "flex", alignItems: "center", justifyContent: "center"}}>
                        <img src="/song.svg" style={{height: 16, width: 16}} />
                      </div>
                      Neighborhood Song
                    </button>
                  </div>}
      </div>
      {showLetter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setShowLetter(false)}>
          <div style={{
            width: '100%',
            maxWidth: '700px',
            backgroundColor: "#fff",
            height: "calc(100% - 32px)",
            maxHeight: "90vh",
            borderRadius: 8,
            gap: 16,
            display: "flex",
            flexDirection: "column",
            position: 'relative', 
            padding: 32,
            fontFamily: "'Caveat', cursive",
            fontSize: "20px",
            lineHeight: "1.8",
            letterSpacing: "0.5px",
            backgroundSize: "cover",
            backgroundColor: "#FFF9E6",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
              <p style={{fontSize: "24px", fontWeight: "700"}}>Thursday, May 1 10:46 AM EST - <b style={{color: "red"}}>Thomas</b></p>
              <p style={{transform: "rotate(-0.5deg)", fontSize: 32}}>
                Today (May 1st), we're launching Neighborhood, our first guaranteed housing program. If you ship an app with 100 hours of coding (& {"<3"}) put into it, this May, you're guaranteed a flight stipend, housing, and food for the Summer in San Francisco. 
              </p>
              {/* <p style={{transform: "rotate(0.5deg)"}}>
                We're renting a bunch of houses (as many as we need) in San Francisco for high school hackers to come and build apps together. So long as you code 40 hours per week on your own projects while you're living in SF, you're welcome to stay as long as you'd like!
              </p> */}
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/On9yuhuU40E?autoplay=1"
                title="Neighborhood Song"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{width: "100%", backgroundColor: "#000", maxWidth: "520px", aspectRatio: "16/9"}}
              />
              {/* <p style={{transform: "rotate(-0.3deg)"}}>
                I have an idea for an app that I have wanted to ship for the past 6 years, and maybe you're in a similar boat (if not, that's okay too). The first step (after signing up) is to share what app you'd like to create this month.
              </p> */}
              {/* <p style={{transform: "rotate(-0.4deg)", fontSize: "16px"}}><i>pssst... checkout <a style={{color: "#007C74", textDecoration: "underline"}} href="https://youtube.com/playlist?list=PLbNbddgD-XxH0TDS6qFynB6-YnWZU5Fhc&si=vMATC4c3VDzUuqwR">this documentary from Juice</a>, our popup game cafe in Shanghai, China</i></p> */}
          </div>
        </div>
      )}
      {showVideo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setShowVideo(false)}>
          <div style={{
            width: '90%',
            maxWidth: '1200px',
            aspectRatio: '16/9',
            position: 'relative'
          }}>
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/ehH_52fzStw?autoplay=1"
              title="Neighborhood Song"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}
