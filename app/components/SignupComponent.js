import React, { useState, useRef, useEffect } from 'react';
import ShaderBackground from './ShaderBackground';
import Soundfont from 'soundfont-player';
import { setToken } from '@/utils/storage';
import { updateSlackUserData } from '@/utils/slack';

export default function SignupComponent({ setHasSignedIn }) {
  const [email, setEmail] = useState('');
  const [otpPassword, setOtpPassword] = useState(['', '', '', '']);
  const [stage, setStage] = useState(-1); // Start at -1 for initial animation
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [piano, setPiano] = useState(null);
  const [playSuccess, setPlaySuccess] = useState(false);
  const [animatedInputs, setAnimatedInputs] = useState([false, false, false, false]);
  const [activeInputs, setActiveInputs] = useState(Array(4).fill(false));
  
  // Create refs for each OTP input
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  // Trigger animation after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setStage(0);
    }, 1000); // Wait 1 second before showing the input
    return () => clearTimeout(timer);
  }, []);

  // Initialize piano sounds
  useEffect(() => {
    const ac = new AudioContext();
    Soundfont.instrument(ac, 'acoustic_grand_piano').then((piano) => {
      setPiano(piano);
    });
  }, []);

  // Color mapping for each number
  const getNumberColor = (number) => {
    const colors = {
      '1': ['#FFF9E6', '#FFE5E5'], // Soft red
      '2': ['#FFF9E6', '#FFE8D6'], // Soft orange
      '3': ['#FFF9E6', '#FFF3D6'], // Soft yellow
      '4': ['#FFF9E6', '#E5FFE5'], // Soft green
      '5': ['#FFF9E6', '#E5F6FF'], // Soft blue
      '6': ['#FFF9E6', '#F0E5FF'], // Soft purple
      '7': ['#FFF9E6', '#FFE5F6'], // Soft pink
      '8': ['#FFF9E6', '#E5FFF1'], // Soft mint
      '9': ['#FFF9E6', '#FFE5E5']  // Soft coral
    };
    return colors[number] || ['#FFF9E6', '#FFF9E6'];
  };

  const playNote = (number, index) => {
    if (piano) {
      // Map numbers 1-9 to piano notes
      const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'];
      const noteIndex = (parseInt(number) - 1) % notes.length;
      if (noteIndex >= 0) {
        piano.play(notes[noteIndex]);
        // Trigger background animation with the number-specific color
        setActiveInputs(prev => {
          const newState = [...prev];
          newState[index] = number;
          return newState;
        });
        setTimeout(() => {
          setActiveInputs(prev => {
            const newState = [...prev];
            newState[index] = false;
            return newState;
          });
        }, 1000); // Reset after 1 second
      }
    }
  };

  const playSuccessSequence = () => {
    if (piano) {
      const notes = ['C4', 'E4', 'G4', 'C5'];
      const delays = [0, 100, 200, 300];
      notes.forEach((note, index) => {
        setTimeout(() => piano.play(note), delays[index]);
      });
    }
  };

  const playFailureSequence = () => {
    if (piano) {
      const notes = ['B3', 'Bb3', 'A3'];
      const delays = [0, 150, 300];
      notes.forEach((note, index) => {
        setTimeout(() => piano.play(note), delays[index]);
      });
    }
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailChange = (e) => {
    const formattedEmail = e.target.value.toLowerCase().trim();
    setEmail(formattedEmail);
  };

  const handleEmailSubmit = async (e) => {
    if (e.key === 'Enter' && email) {
      document.getElementById('email-input').disabled = true;
      const formattedEmail = email.toLowerCase().trim();
      
      if (!isValidEmail(formattedEmail)) {
        setError('Please enter a valid email address');
        document.getElementById('email-input').disabled = false;
        return;
      }

      try {
        const response = await fetch('https://neighborhood.hackclub.com/api/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: formattedEmail }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setEmail(formattedEmail); // Update state with formatted email
          setError('');
          setStage(1);
        } else {
          document.getElementById('email-input').disabled = false;
          setError(data.message || 'An error occurred');
        }
      } catch (err) {
        document.getElementById('email-input').disabled = false;
        setError('Failed to connect to the server');
        console.error('Error:', err);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedData.length > 0) {
      const newOTP = [...otpPassword];
      for (let i = 0; i < 4; i++) {
        if (pastedData[i]) {
          newOTP[i] = pastedData[i];
          setTimeout(() => {
            playNote(pastedData[i], i);
          }, i * 100); // Play notes in sequence with delay
        }
      }
      setOtpPassword(newOTP);
      
      // If we have all 4 digits, submit
      if (pastedData.length === 4) {
        handleOTPSubmit(pastedData);
      }
      // Focus last filled input or next empty input
      const lastIndex = Math.min(pastedData.length, 3);
      otpRefs[lastIndex].current.focus();
    }
  };

  const handleOTPChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOTP = [...otpPassword];
    newOTP[index] = value;
    setOtpPassword(newOTP);

    if (value !== '') {
      playNote(value, index); // Pass the index to playNote
      if (index < 3) {
        otpRefs[index + 1].current.focus();
      }
    }

    // If all digits are filled, submit automatically
    if (index === 3 && value !== '') {
      handleOTPSubmit(newOTP.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpPassword[index] && index > 0) {
      // Move to previous input on backspace if current input is empty
      otpRefs[index - 1].current.focus();
    }
  };

  const handleOTPSubmit = async (otp = otpPassword.join('')) => {
    if (otp.length !== 4) return;

    const formattedEmail = email.toLowerCase().trim();

    try {
      const response = await fetch('https://neighborhood.hackclub.com/api/verifyOTP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: formattedEmail,
          otp: otp
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setError('');
        setAuthToken(data.token);
        setToken(data.token);

        // Get Slack token from environment variable
        const slackToken = process.env.PUBLIC_SLACK_TOKEN;
        if (slackToken) {
          try {
            await updateSlackUserData(formattedEmail, slackToken);
          } catch (error) {
            console.error('Failed to update Slack data:', error);
            // Continue with login even if Slack update fails
          }
        }

        playSuccessSequence();
        setStage(2);
        // Reload the page after a short delay to show success state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setError('wrong email key. ');
        playFailureSequence();
      }
    } catch (err) {
      setError('Failed to verify OTP');
      playFailureSequence();
      console.error('Error:', err);
    }
  };

  // Focus first input when stage changes to OTP
  useEffect(() => {
    if (stage === 1) {
      otpRefs[0].current.focus();
      // Stagger the animations
      [0, 1, 2, 3].forEach((index) => {
        setTimeout(() => {
          setAnimatedInputs(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
        }, index * 100); // 500ms delay between each input
      });
    } else if (stage !== 1) {
      // Reset animations when leaving stage 1
      setAnimatedInputs([false, false, false, false]);
    }
  }, [stage]);

  return (
    <div style={{ 
      position: 'relative', 
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <div style={{position: "relative", justifyContent: "center", alignItems: "center", width: "100vw", height: "100vh", display: "flex"}}>
        <ShaderBackground />
      </div>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",          
        }}>
          <img 
            style={{
              width: stage === -1 ? 500 : 400, 
              marginBottom: stage === -1 ? 0 : 32,
              transition: "all 0.5s ease-out"
            }} 
            src="./neighborhoodLogo.png" 
            alt="Neighborhood Logo"
          />
          
          <div style={{
            opacity: stage >= 0 ? 1 : 0,
            transform: `translateY(${stage >= 0 ? '0' : '20px'})`,
            transition: "all 0.5s ease-out",
          }}>
            {stage === 0 && (
              <div style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"}}>
                <div style={{
                  position: 'relative',
                  width: '300px',
                  padding: '4px',
                  background: '#5C513E',
                  borderRadius: '12px',
                  boxShadow: '0 4px 0 #3D3629',
                }}>
                  <input
                    type="email"
                    id="email-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyPress={handleEmailSubmit}
                    autoFocus
                    style={{
                      fontSize: '1.2rem',
                      padding: '12px 16px',
                      width: '100%',
                      borderRadius: '8px',
                      backgroundColor: "#FFF9E6",
                      color: "#786A50",
                      border: 'none',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                
                <p style={{color: "#FFF9E6", fontWeight: 700, marginTop: '16px'}}><i>pssst... same email as earlier pls</i></p>
              </div>
            )}
            {stage === 1 && (
              <div style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"}}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index} style={{
                      position: 'relative',
                      padding: '4px',
                      background: '#5C513E',
                      borderRadius: '12px',
                      boxShadow: '0 4px 0 #3D3629',
                      opacity: animatedInputs[index] ? 1 : 0,
                      transform: `translateY(${animatedInputs[index] ? '0' : '20px'})`,
                      transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
                    }}>
                      <input
                        ref={otpRefs[index]}
                        type="text"
                        maxLength={1}
                        value={otpPassword[index]}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        style={{
                          width: '50px',
                          height: '50px',
                          fontSize: '24px',
                          fontWeight: 700,
                          textAlign: 'center',
                          border: 'none',
                          borderRadius: '8px',
                          color: "#786A50",
                          outline: 'none',
                          background: activeInputs[index] 
                            ? `linear-gradient(135deg, ${getNumberColor(activeInputs[index])[0]} 0%, ${getNumberColor(activeInputs[index])[1]} 100%)`
                            : '#FFF9E6',
                          transition: 'background 0.3s ease-in-out',
                        }}
                      />
                    </div>
                  ))}
                </div>
                {error ? <div style={{ 
                  color: '#ff3b30',
                  marginBottom: '20px',
                  fontSize: '0.9rem'
                }}><p style={{color: "#FFF9E6", cursor: "pointer", textDecoration: "underline"}} onClick={() => setStage(0)}><i style={{color: "#FFF9E6", textDecoration: "none", fontWeight: 700}}>{error}</i>{" try again"}</p></div> :
                <div style={{ 
                  color: '#FFF9E6',
                  marginBottom: '20px',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}>
                  <i>we sent a key to your email</i>
                </div>
                }
              </div>
            )}
            {stage === 2 && (
              <div>
                <p style={{color: "#fff", textAlign: "center", fontWeight: 700}}>Welcome back to Neighborhood {"<3"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}