import React, { useState, useRef, useEffect } from 'react';
import ShaderBackground from './ShaderBackground';
import Soundfont from 'soundfont-player';
import { setToken } from '@/utils/storage';
import { updateSlackUserData } from '@/utils/slack';

export default function SignupComponent({ setHasSignedIn }) {
  const [email, setEmail] = useState('');
  const [otpPassword, setOtpPassword] = useState(['', '', '', '', '', '']);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [piano, setPiano] = useState(null);
  const [playSuccess, setPlaySuccess] = useState(false);
  const [animatedInputs, setAnimatedInputs] = useState(Array(6).fill(false));
  const [activeInputs, setActiveInputs] = useState(Array(6).fill(false));

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const timer = setTimeout(() => {
      setStage(0);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const ac = new AudioContext();
    Soundfont.instrument(ac, 'acoustic_grand_piano').then((piano) => {
      setPiano(piano);
    });
  }, []);

  const getNumberColor = (char) => {
    const colors = {
      '1': ['#FFF9E6', '#FFE5E5'],
      '2': ['#FFF9E6', '#FFE8D6'],
      '3': ['#FFF9E6', '#FFF3D6'],
      '4': ['#FFF9E6', '#E5FFE5'],
      '5': ['#FFF9E6', '#E5F6FF'],
      '6': ['#FFF9E6', '#F0E5FF'],
      '7': ['#FFF9E6', '#FFE5F6'],
      '8': ['#FFF9E6', '#E5FFF1'],
      '9': ['#FFF9E6', '#FFE5E5'],
      'A': ['#FFF9E6', '#FFDADA'],
      'B': ['#FFF9E6', '#DADAFF'],
      'C': ['#FFF9E6', '#E6FFD6'],
      'D': ['#FFF9E6', '#FFEED6'],
      'E': ['#FFF9E6', '#E6E6FF'],
      'F': ['#FFF9E6', '#FFF9D6'],
    };
    return colors[char.toUpperCase()] || ['#FFF9E6', '#FFF9E6'];
  };

  const playNote = (char, index) => {
    if (piano) {
      const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'];
      const noteIndex = Math.abs(char.charCodeAt(0)) % notes.length;
      piano.play(notes[noteIndex]);
      setActiveInputs(prev => {
        const newState = [...prev];
        newState[index] = char;
        return newState;
      });
      setTimeout(() => {
        setActiveInputs(prev => {
          const newState = [...prev];
          newState[index] = false;
          return newState;
        });
      }, 1000);
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

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
        const response = await fetch('./api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formattedEmail }),
        });

        const data = await response.json();

        if (response.ok) {
          setEmail(formattedEmail);
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
    const pastedData = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newOTP = [...otpPassword];
      for (let i = 0; i < 6; i++) {
        if (pastedData[i]) {
          newOTP[i] = pastedData[i];
          setTimeout(() => playNote(pastedData[i], i), i * 100);
        }
      }
      setOtpPassword(newOTP);
      if (pastedData.length === 6) handleOTPSubmit(pastedData);
      const lastIndex = Math.min(pastedData.length, 5);
      otpRefs[lastIndex].current.focus();
    }
  };

  const handleOTPChange = (index, value) => {
    if (!/^[a-zA-Z0-9]?$/.test(value)) return;
    const newOTP = [...otpPassword];
    newOTP[index] = value;
    setOtpPassword(newOTP);
    if (value !== '') {
      playNote(value, index);
      if (index < 5) otpRefs[index + 1].current.focus();
    }
    if (index === 5 && value !== '') handleOTPSubmit(newOTP.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpPassword[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleOTPSubmit = async (otp = otpPassword.join('')) => {
    if (otp.length !== 6) return;
    const formattedEmail = email.toLowerCase().trim();
    try {
      const response = await fetch('./api/verifyOTP', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formattedEmail, otp }),
      });
      const data = await response.json();
      if (response.ok) {
        setError('');
        setAuthToken(data.token);
        setToken(data.token);
        const slackToken = process.env.NEXT_PUBLIC_SLACK_TOKEN;
        if (slackToken) {
          try {
            await updateSlackUserData(formattedEmail, slackToken);
          } catch (error) {
            console.error('Failed to update Slack data:', error);
          }
        }
        playSuccessSequence();
        setStage(2);
        setTimeout(() => window.location.reload(), 1000);
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

  useEffect(() => {
    if (stage === 1) {
      otpRefs[0].current.focus();
      [0, 1, 2, 3, 4, 5].forEach((index) => {
        setTimeout(() => {
          setAnimatedInputs(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
        }, index * 100);
      });
    } else if (stage !== 1) {
      setAnimatedInputs(Array(6).fill(false));
    }
  }, [stage]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ position: "relative", justifyContent: "center", alignItems: "center", width: "100vw", height: "100vh", display: "flex" }}>
        <ShaderBackground />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <img
            style={{ width: stage === -1 ? 500 : 400, marginBottom: stage === -1 ? 0 : 32, transition: "all 0.5s ease-out" }}
            src="./neighborhoodLogo.png"
            alt="Neighborhood Logo"
          />
          <div style={{ opacity: stage >= 0 ? 1 : 0, transform: `translateY(${stage >= 0 ? '0' : '20px'})`, transition: "all 0.5s ease-out" }}>
            {stage === 0 && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ position: 'relative', width: '300px', padding: '4px', background: '#5C513E', borderRadius: '12px', boxShadow: '0 4px 0 #3D3629' }}>
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
                <p style={{ color: "#FFF9E6", fontWeight: 700, marginTop: '16px', opacity: 0.5 }}><i>pssst... same email as earlier pls</i></p>
              </div>
            )}
            {stage === 1 && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
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
                {error ? (
                  <div style={{ color: '#ff3b30', marginBottom: '20px', fontSize: '0.9rem' }}>
                    <p style={{ color: "#FFF9E6", cursor: "pointer", textDecoration: "underline" }} onClick={() => setStage(0)}>
                      <i style={{ color: "#FFF9E6", textDecoration: "none", fontWeight: 700 }}>{error}</i> try again
                    </p>
                  </div>
                ) : (
                  <div style={{ color: '#FFF9E6', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 700 }}>
                    <i>we sent a key to your email</i>
                  </div>
                )}
              </div>
            )}
            {stage === 2 && (
              <div>
                <p style={{ color: "#fff", textAlign: "center", fontWeight: 700 }}>Welcome back to Neighborhood {"<3"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
