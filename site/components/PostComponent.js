import React, { useEffect, useRef, useCallback, useState } from 'react';
import { M_PLUS_Rounded_1c } from "next/font/google";
import { getToken } from "@/utils/storage";
import Soundfont from 'soundfont-player';

const mPlusRounded = M_PLUS_Rounded_1c({
  weight: "400",
  variable: "--font-m-plus-rounded",
  subsets: ["latin"],
});

const BOARD_BAR_HEIGHT = 145;

const PostComponent = ({ isExiting, onClose, userData }) => {
  const demoVideoInputRef = useRef(null);
  const [demoVideoUrl, setDemoVideoUrl] = useState(null);
  const demoVideoRef = useRef(null);
  const [photoboothVideoUrl, setPhotoboothVideoUrl] = useState(null);
  const photoboothInputRef = useRef(null);
  const photoboothVideoRef = useRef(null);
  const [description, setDescription] = useState("");
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [demoLink, setDemoLink] = useState("");
  const [photoboothLink, setPhotoboothLink] = useState("");
  const [demoUploading, setDemoUploading] = useState(false);
  const [photoboothUploading, setPhotoboothUploading] = useState(false);
  const [demoUploadProgress, setDemoUploadProgress] = useState(0);
  const [photoboothUploadProgress, setPhotoboothUploadProgress] = useState(0);
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [postError, setPostError] = useState("");
  const [piano, setPiano] = useState(null);
  const [audioCtx, setAudioCtx] = useState(null);
  const [descNoteIndex, setDescNoteIndex] = useState(0);
  const descNotes = ['C5', 'D5', 'E5', 'G5', 'A5', 'B5', 'C6'];

  useEffect(() => {
    const fetchApps = async () => {
      const token = getToken();
      if (!token) return;
      try {
        setLoadingApps(true);
        const res = await fetch("/api/getUserApps?token=" + token);
        const data = await res.json();
        if (data.apps) {
          setApps(data.apps);
        }
      } catch (e) {
        // handle error
      } finally {
        setLoadingApps(false);
      }
    };
    fetchApps();
  }, []);

  // Auto-select the app if there is only one
  useEffect(() => {
    if (apps.length === 1) {
      setSelectedApp(apps[0].id);
    }
  }, [apps]);

  // Initialize piano sounds
  useEffect(() => {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    setAudioCtx(ac);
    Soundfont.instrument(ac, 'acoustic_grand_piano').then((p) => {
      setPiano(p);
    });
    return () => ac && ac.close();
  }, []);

  // Play a single note (C4 to B4)
  const playNote = (note = 'C5', duration = 0.5) => {
    if (piano && audioCtx) {
      piano.play(note, audioCtx.currentTime, { duration });
    }
  };

  // Play a magical upload sound (arpeggio)
  const playUploadSound = () => {
    if (!piano || !audioCtx) return;
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((note, i) => {
      setTimeout(() => playNote(note, 0.2), i * 80);
    });
  };

  // Play a success sound
  const playSuccessSound = () => {
    if (!piano || !audioCtx) return;
    const notes = ['G5', 'C6'];
    notes.forEach((note, i) => {
      setTimeout(() => playNote(note, 0.3), i * 100);
    });
  };

  // Play a button press sound
  const playButtonSound = () => playNote('E5', 0.15);

  // Play a climbing scale based on percent (0-1)
  const playClimbingNote = (percent) => {
    if (!piano || !audioCtx) return;
    const notes = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'];
    const idx = Math.min(notes.length - 1, Math.floor(percent * (notes.length - 1)));
    playNote(notes[idx], 0.18);
  };

  // Helper to upload with progress
  const uploadWithProgress = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("token", getToken());
      formData.append("file", file);
      xhr.open("POST", "https://express.spectralo.hackclub.app/video/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(event.loaded / event.total);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("Failed to upload video"));
        }
      };
      xhr.onerror = () => reject(new Error("Failed to upload video"));
      xhr.send(formData);
    });
  };

  // Handle file selection or drop for demo video
  const onDemoVideoChange = useCallback(async (event) => {
    let file;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      file = event.dataTransfer.files[0];
    } else if (event.target && event.target.files.length > 0) {
      file = event.target.files[0];
    }
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setDemoVideoUrl(url);
      playUploadSound(); // Play sound on upload start
      setDemoUploading(true);
      let lastMilestone = -1;
      try {
        const responseData = await uploadWithProgress(file, (percent) => {
          // Play a climbing note at each 0%, 25%, 50%, 75%, 100%
          const milestones = [0, 0.25, 0.5, 0.75, 1];
          const milestoneIdx = milestones.findIndex(m => percent < m);
          const idx = milestoneIdx === -1 ? milestones.length - 1 : Math.max(0, milestoneIdx - 1);
          if (idx !== lastMilestone) {
            playClimbingNote(milestones[idx]);
            lastMilestone = idx;
          }
          setDemoUploadProgress(percent); // Update progress state
        });
        setDemoLink(responseData.url);
        playSuccessSound(); // Play sound on upload success
      } catch (e) {
        setDemoLink("");
      } finally {
        setDemoUploading(false);
        setDemoUploadProgress(0); // Reset progress state
      }
    }
  }, [piano, audioCtx]);

  // Handle file selection or drop for photobooth video
  const onPhotoboothVideoChange = useCallback(async (event) => {
    let file;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      file = event.dataTransfer.files[0];
    } else if (event.target && event.target.files.length > 0) {
      file = event.target.files[0];
    }
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setPhotoboothVideoUrl(url);
      playUploadSound(); // Play sound on upload start
      setPhotoboothUploading(true);
      let lastMilestone = -1;
      try {
        const responseData = await uploadWithProgress(file, (percent) => {
          // Play a climbing note at each 0%, 25%, 50%, 75%, 100%
          const milestones = [0, 0.25, 0.5, 0.75, 1];
          const milestoneIdx = milestones.findIndex(m => percent < m);
          const idx = milestoneIdx === -1 ? milestones.length - 1 : Math.max(0, milestoneIdx - 1);
          if (idx !== lastMilestone) {
            playClimbingNote(milestones[idx]);
            lastMilestone = idx;
          }
          setPhotoboothUploadProgress(percent); // Update progress state
        });
        setPhotoboothLink(responseData.url);
        playSuccessSound(); // Play sound on upload success
      } catch (e) {
        setPhotoboothLink("");
      } finally {
        setPhotoboothUploading(false);
        setPhotoboothUploadProgress(0); // Reset progress state
      }
    }
  }, [piano, audioCtx]);

  // Drag and drop events for demo video
  const onDemoVideoDrop = useCallback((e) => {
    e.preventDefault();
    onDemoVideoChange(e);
  }, [onDemoVideoChange]);

  const onDemoVideoDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Click to open file picker for demo video
  const onDemoVideoClick = useCallback(() => {
    if (demoVideoInputRef.current) demoVideoInputRef.current.click();
  }, []);

  // Drag and drop events for photobooth
  const onPhotoboothDrop = useCallback((e) => {
    e.preventDefault();
    onPhotoboothVideoChange(e);
  }, [onPhotoboothVideoChange]);

  const onPhotoboothDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Click to open file picker for photobooth
  const onPhotoboothClick = useCallback(() => {
    if (photoboothInputRef.current) photoboothInputRef.current.click();
  }, []);

  // Handler for posting the devlog
  const handlePostDevlog = async () => {
    playButtonSound();
    setPosting(true);
    setPostSuccess(false);
    setPostError("");
    try {
      const neighbor = getToken();
      const selectedAppObj = apps.find(app => app.id === selectedApp);
      const appName = selectedAppObj ? selectedAppObj.name : selectedApp;
      if (!demoLink || !photoboothLink || !description || !neighbor || !selectedApp) {
        setPostError("Please fill out all fields and upload both videos.");
        setPosting(false);
        return;
      }
      const res = await fetch("/api/postDevlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoVideo: demoLink,
          photoboothVideo: photoboothLink,
          description,
          neighbor,
          app: appName,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        let details = data.message || "Failed to post devlog";
        if (data.error) details += `\nError: ${data.error}`;
        if (data.stack) details += `\nStack: ${data.stack}`;
        if (data.airtableError) details += `\nAirtable: ${JSON.stringify(data.airtableError)}`;
        setPostError(details);
        setPosting(false);
        return;
      }
      setPostSuccess(true);
      playSuccessSound();
      // Close the UI after 5 seconds
      setTimeout(() => {
        if (onClose) onClose();
      }, 5000);
    } catch (e) {
      setPostError("Failed to post devlog: " + (e?.message || e));
    } finally {
      setPosting(false);
    }
  };

  // Button should be disabled if posting or if any required field is missing
  const isButtonDisabled =
    posting ||
    !demoLink ||
    !photoboothLink ||
    !description.trim() ||
    !selectedApp;

  return (
    <div className={`pop-in ${isExiting ? "hidden" : ""} ${mPlusRounded.variable}`} 
      style={{
        position: "absolute", 
        zIndex: 2, 
        width: "calc(100% - 16px)", 
        height: "calc(100% - 16px)", 
        borderRadius: 25, 
        marginLeft: 8, 
        marginTop: 8, 
        backgroundColor: "#FFF9E6",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(123, 91, 63, 0.1)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div 
        onClick={onClose}
        style={{
          width: 16, 
          cursor: "pointer", 
          height: 16, 
          borderRadius: '50%', 
          backgroundColor: "#FF5F56",
          border: '2px solid #E64940',
          transition: 'transform 0.2s',
          margin: "16px",
          ':hover': {
            transform: 'scale(1.1)'
          }
        }} 
      />
      <div style={{width: "100%", height: "100%", flexDirection: "column", display: "flex", justifyContent: "center", alignItems: "center"}}>
      <div
      style={{maxWidth: 700, height: "100%", width: "100%", display: 'flex', flexDirection: 'column', justifyContent: "center", alignItems: 'center'}}>
          <div style={{ width: "100%", display: "flex",justifyContent: "center", alignItems: "center", gap: 32 }}>
            {/* Left: Photobooth Video */}
            <div style={{ flex: 1, maxWidth: 600, aspectRatio: '16/9', border: "2px dashed #786A50", borderRadius: 20, background: "#fff7e6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: 'pointer', position: 'relative' }}
              onClick={onPhotoboothClick}
              onDrop={onPhotoboothDrop}
              onDragOver={onPhotoboothDragOver}
            >
              {photoboothVideoUrl ? (
                <video
                  ref={photoboothVideoRef}
                  src={photoboothVideoUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 20, background: '#000', cursor: 'pointer' }}
                  onMouseEnter={() => { photoboothVideoRef.current && photoboothVideoRef.current.play(); }}
                  onMouseLeave={() => { photoboothVideoRef.current && photoboothVideoRef.current.pause(); photoboothVideoRef.current.currentTime = 0; }}
                  tabIndex={0}
                  playsInline
                />
              ) : (
                <>
                  <span style={{ color: "#786A50", fontSize: 18, fontWeight: 500, marginBottom: 0}}>Photobooth Video</span>
                  <span style={{ color: "#786A50", fontSize: 14, opacity: 0.7 }}>select video</span>
                </>
              )}
              {photoboothUploading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 20, zIndex: 2 }}>
                  <span style={{ color: '#786A50', fontWeight: 600, fontSize: 18 }}>Uploading…</span>
                  <div style={{ marginTop: 12, width: '60%', height: 8, backgroundColor: 'rgba(120, 106, 80, 0.2)', borderRadius: 4 }}>
                    <div style={{ 
                      width: `${Math.round(photoboothUploadProgress * 100)}%`, 
                      height: '100%', 
                      backgroundColor: '#007A72', 
                      borderRadius: 4,
                      transition: 'width 0.3s ease-in-out'
                    }}></div>
                  </div>
                  <span style={{ color: '#786A50', fontSize: 14, marginTop: 8 }}>{Math.round(photoboothUploadProgress * 100)}%</span>
                </div>
              )}
              <input
                ref={photoboothInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={onPhotoboothVideoChange}
              />
            </div>
            {/* Right: Demo Video */}
            <div style={{ flex: 1, maxWidth: 600, aspectRatio: '16/9', border: "2px dashed #786A50", borderRadius: 20, background: "#fff7e6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: 'pointer', position: 'relative' }}
              onClick={onDemoVideoClick}
              onDrop={onDemoVideoDrop}
              onDragOver={onDemoVideoDragOver}
            >
                {demoVideoUrl ? (
                  <video
                    ref={demoVideoRef}
                    src={demoVideoUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 20, background: '#000', cursor: 'pointer' }}
                    onMouseEnter={() => { demoVideoRef.current && demoVideoRef.current.play(); }}
                    onMouseLeave={() => { demoVideoRef.current && demoVideoRef.current.pause(); demoVideoRef.current.currentTime = 0; }}
                    tabIndex={0}
                    playsInline
                  />
                ) : (
                  <>
                    <span style={{ color: "#786A50", fontSize: 18, fontWeight: 500, marginBottom: 0}}>Demo Video</span>
                    <span style={{ color: "#786A50", fontSize: 14, opacity: 0.7 }}>select video</span>
                  </>
                )}
                {demoUploading && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 20, zIndex: 2 }}>
                    <span style={{ color: '#786A50', fontWeight: 600, fontSize: 18 }}>Uploading…</span>
                    <div style={{ marginTop: 12, width: '60%', height: 8, backgroundColor: 'rgba(120, 106, 80, 0.2)', borderRadius: 4 }}>
                      <div style={{ 
                        width: `${Math.round(demoUploadProgress * 100)}%`, 
                        height: '100%', 
                        backgroundColor: '#007A72', 
                        borderRadius: 4,
                        transition: 'width 0.3s ease-in-out'
                      }}></div>
                    </div>
                    <span style={{ color: '#786A50', fontSize: 14, marginTop: 8 }}>{Math.round(demoUploadProgress * 100)}%</span>
                  </div>
                )}
                <input
                  ref={demoVideoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={onDemoVideoChange}
                />
            </div>
          </div>

                                {/* Description input below videos, always visible */}
                                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <textarea
              value={description}
              onChange={e => {
                // Only play a note if a space was just added
                const newValue = e.target.value;
                if (
                  piano && audioCtx &&
                  newValue.length > description.length &&
                  newValue[newValue.length - 1] === ' '
                ) {
                  playNote(descNotes[descNoteIndex % descNotes.length], 0.12);
                  setDescNoteIndex((prev) => prev + 1);
                }
                setDescription(newValue);
              }}
              placeholder="Describe what you did in this devlog"
              style={{
                width: "100%",
                minHeight: 80,
                borderRadius: 12,
                border: "1.5px solid #786A50",
                fontSize: 20,
                padding: 16,
                fontFamily: 'inherit',
                background: '#fff9e6',
                marginTop: 16,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            {/* Dropdown for selecting an app and commits area */}
            <div style={{ width: "100%", display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 16, marginTop: 16 }}>
              <select
                value={selectedApp}
                onChange={e => setSelectedApp(e.target.value)}
                style={{
                  width: "300px",
                  padding: 12,
                  borderRadius: 8,
                  border: "1.5px solid #786A50",
                  fontSize: 18,
                  background: '#fff9e6',
                  fontFamily: 'inherit',
                }}
                disabled={loadingApps}
              >
                {loadingApps ? (
                  <option>Loading...</option>
                ) : (
                  <>
                    <option value="" disabled>Select an app…</option>
                    {apps.map(app => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                  </>
                )}
              </select>
              {selectedApp && (
                <div style={{ flex: 1, marginBottom: 96, height: 96, background: 'transparent', border: '1px solid #786A50', borderRadius: 12, padding: 12 }}>
                  {/* Commits UI will go here */}
                </div>
              )}
            </div>
          </div>
          {/* Bottom bar with Post Devlog button */}
          <div style={{
            width: '100%',
            background: '#F7D359',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '16px 0 16px 0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderBottomLeftRadius: 25,
            borderBottomRightRadius: 25,
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <button
                style={{
                  background: '#007A72',
                  color: '#FFF9E6',
                  fontSize: 20,
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: 20,
                  padding: '16px 32px',
                  cursor: posting ? 'wait' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  transition: 'background 0.2s',
                  opacity: isButtonDisabled ? 0.7 : 1,
                }}
                disabled={isButtonDisabled}
                onClick={handlePostDevlog}
              >
                {posting ? 'Posting...' : 'Post Devlog'}
              </button>
              {postError && (
                <div style={{ color: '#b00', marginLeft: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>{postError}</div>
              )}
              {postSuccess && !postError && (
                <div style={{ color: '#007A72', marginLeft: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>Devlog posted successfully!</div>
              )}
            </div>
          </div>
      </div>
      </div>
    </div>
  );
};

export default PostComponent;