import React, { useState, useEffect } from 'react';
import { M_PLUS_Rounded_1c } from "next/font/google";
import Soundfont from 'soundfont-player';

const mPlusRounded = M_PLUS_Rounded_1c({
  weight: "400",
  variable: "--font-m-plus-rounded",
  subsets: ["latin"],
});

const PostsViewComponent = ({ isExiting, onClose, posts, userData }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [piano, setPiano] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localPosts, setLocalPosts] = useState([]);
  const [expandedPosts, setExpandedPosts] = useState({});

  // Initialize the local posts state from props
  useEffect(() => {
    if (posts && posts.length > 0) {
      setLocalPosts(posts);
    }
  }, [posts]);

  // Initialize piano sounds
  useEffect(() => {
    const ac = new AudioContext();
    setAudioContext(ac);
    Soundfont.instrument(ac, 'acoustic_grand_piano').then((piano) => {
      setPiano(piano);
    });
  }, []);

  const playNavigationSound = (direction) => {
    if (piano && audioContext) {
      // Use softer, shorter sequences for navigation
      const notes = direction === 'next' 
        ? ['E4', 'G4']  // Simple ascending interval
        : ['G4', 'E4']; // Simple descending interval

      // Shorter delays for a quicker sound
      const delays = [0, 100];

      // Play notes with reduced volume
      notes.forEach((note, index) => {
        setTimeout(() => {
          piano.play(note, audioContext.currentTime, {
            gain: 0.3 // Reduce volume to 30%
          });
        }, delays[index]);
      });
    }
  };

  const handlePrevious = () => {
    playNavigationSound('prev');
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : localPosts.length - 1));
  };

  const handleNext = () => {
    playNavigationSound('next');
    setCurrentIndex((prev) => (prev < localPosts.length - 1 ? prev + 1 : 0));
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Return time if today, otherwise date and time
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
             ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const currentPost = localPosts[currentIndex] || {};

  // Log the entire currentPost object to debug
  console.log('Current post object:', JSON.stringify(currentPost, null, 2));
  
  // Use airtableId for the Airtable record ID
  const postId = currentPost?.airtableId;

  // Truncate text and add "Read More" button
  const truncateText = (text, maxLength = 80) => {
    if (!text || text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength).trim();
    return truncated;
  };

  // Toggle expanded state for a post
  const toggleExpanded = () => {
    setExpandedPosts(prev => ({
      ...prev,
      [currentIndex]: !prev[currentIndex]
    }));
  };

  // Check if current post is expanded
  const isExpanded = expandedPosts[currentIndex];

  // Add this function to handle comment submission
  const handleSendComment = async () => {
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('neighborhoodToken');
      if (!token) throw new Error('Not signed in');
      
      // Check if we have a valid post ID
      if (!postId) {
        console.error("Missing Airtable record ID (airtableId) for comment submission", {
          currentPost,
          postId,
          hasAirtableId: !!currentPost?.airtableId,
        });
        throw new Error("Cannot find Airtable record ID");
      }
      
      console.log("Submitting comment with:", {
        content: comment,
        postId,
        isPostIdAirtableFormat: postId.startsWith('rec'), // Just for debugging
        neighborToken: token
      });
      
      const response = await fetch('/api/createComment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: comment,
          postId,
          neighborToken: token
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Error posting comment: ${result.message || 'Unknown error'}`);
      }
      
      console.log("Comment posted successfully:", result);
      
      // Add the new comment to the local state without reloading the page
      const newComment = {
        commentMessage: comment,
        commentSender: {
          name: userData?.handle || userData?.slackHandle || userData?.name,
          profilePicture: userData?.profilePicture,
          handle: userData?.handle || userData?.slackHandle,
          fullName: userData?.fullName || userData?.name
        },
        createTime: new Date().toISOString()
      };
      
      // Update the local posts array with the new comment
      const updatedPosts = [...localPosts];
      const postIndex = currentIndex;
      if (postIndex >= 0 && postIndex < updatedPosts.length) {
        if (!updatedPosts[postIndex].comments) {
          updatedPosts[postIndex].comments = [];
        }
        updatedPosts[postIndex].comments.push(newComment);
        setLocalPosts(updatedPosts);
      }
      
      setComment("");
    } catch (e) {
      console.error("Error posting comment:", e);
    } finally {
      setSubmitting(false);
    }
  };

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
        backgroundColor: "#ffe5c7",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(123, 91, 63, 0.1)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Top bar */}
      <div style={{
        display: "flex", 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center",
        padding: "8px 16px",
        borderBottom: "2px solid #B9A88F",
        backgroundColor: "#e8c9a5",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        zIndex: 2,
        height: "60px",
        minHeight: "60px",
        maxHeight: "60px",
        position: "relative"
      }}>
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
            ':hover': {
              transform: 'scale(1.1)'
            }
          }} 
        />
        <div style={{
          fontFamily: "var(--font-m-plus-rounded)",
          fontSize: "24px",
          fontWeight: "bold",
          color: "#644c36",
          textShadow: "none",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)"
        }}>
          Latest Posts
        </div>
      </div>

      {/* Content area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "#ffead1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        position: "relative"
      }}>
        {/* Current post */}
        <div style={{display: "flex", width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center"}}>
        <div 
          style={{
            width: "75%",
            maxWidth: "800px",
            backgroundColor: "#FFF9E6",
            borderRadius: "16px",
            marginTop: 0,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            animation: "fadeIn 0.3s ease-in-out",          }}
        >
          <div style={{
            display: "flex",
            gap: "16px",
            alignItems: "flex-start"
          }}>
            <video 
              controls
              playsInline
              style={{
                width: "300px",
                borderRadius: "12px",
                aspectRatio: "16/9",
                objectFit: "fit",
                backgroundColor: "#000"
              }}
              onMouseEnter={(e) => {
                e.target.play();
              }}
              onMouseLeave={(e) => {
                e.target.pause();
                e.target.currentTime = 0;
              }}
              src={currentPost.photoboothVideo}
            />
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
              <p style={{
                fontFamily: "var(--font-m-plus-rounded)",
                fontSize: "16px",
                color: "#644c36",
                margin: 0,
                lineHeight: "1.5"
              }}>
                {isExpanded 
                  ? currentPost.description 
                  : truncateText(currentPost.description)}
                {!isExpanded && currentPost.description && currentPost.description.length > 250 && (
                  <span 
                    onClick={toggleExpanded}
                    style={{
                      color: "#007C74",
                      fontWeight: "600",
                      marginLeft: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Read More
                  </span>
                )}
                {isExpanded && currentPost.description && currentPost.description.length > 250 && (
                  <span 
                    onClick={toggleExpanded}
                    style={{
                      color: "#007C74",
                      fontWeight: "600",
                      marginLeft: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Show Less
                  </span>
                )}
              </p>
              <div style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap"
              }}>
                {/*
                {post.app && (
                  <span style={{
                    backgroundColor: "#8b6b4a",
                    color: "#FFF9E6",
                    padding: "4px 12px",
                    borderRadius: "16px",
                    fontSize: "14px",
                    fontFamily: "var(--font-m-plus-rounded)"
                  }}>
                    {post.app}
                  </span>
                )}
                */}
                {currentPost.neighbor && (
                  <span style={{
                    color: "#000",
                    fontSize: "14px",
                    fontFamily: "var(--font-m-plus-rounded)"
                  }}>
                    {currentPost.neighbor}
                  </span>
                )}
              </div>
            </div>
          </div>
          {currentPost.demoVideo && (
            <video 
              controls
              playsInline
              style={{
                width: "100%",
                borderRadius: "12px",
                aspectRatio: "16/9",
                objectFit: "fit",
                backgroundColor: "#000"
              }}
              onMouseEnter={(e) => {
                e.target.play();
              }}
              onMouseLeave={(e) => {
                e.target.pause();
                e.target.currentTime = 0;
              }}
              src={currentPost.demoVideo}
            />
          )}
        </div>
        <div style={{width: "30%", display: "flex", flexDirection: 'column', height: "100%", padding: 16, backgroundColor: "#F8EEBB"}}>
        <p style={{fontSize: 18, color: "#786A50", fontWeight: 700}}>
          Comments ({currentPost?.comments?.length || 0})
        </p>

        <div style={{
          overflowY: "scroll", 
          display: "flex", 
          height: "100%",
          maxHeight: 500,
          flexDirection: "column", 
          gap: 12,
          paddingRight: 6
        }}>
          {/* Display comments */}
          {currentPost?.comments?.map((comment, index) => (
            <div key={index} style={{
              display: "flex",
              flexDirection: "column",
              padding: "8px 12px",
              backgroundColor: "#FFF9E6",
              borderRadius: 12,
              boxShadow: "0 1px 2px rgba(120,106,80,0.1)"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6
              }}>
                {comment.commentSender?.profilePicture && (
                  <img
                    src={comment.commentSender.profilePicture}
                    alt={comment.commentSender.name || "user"}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      objectFit: "cover",
                      border: "1.5px solid #786A50",
                      marginRight: 8
                    }}
                  />
                )}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1
                }}>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#644c36",
                    marginRight: 6,
                    lineHeight: 1.0
                  }}>
                    {comment.commentSender?.handle || comment.commentSender?.name || "Anonymous"}
                  </span>
                  <span style={{
                    fontSize: 8,
                    color: "#786A50",
                    opacity: 0.7
                  }}>
                    {formatDate(comment.createTime)}
                  </span>
                </div>
              </div>
              <p style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.4,
                color: "#644c36",
                wordBreak: "break-word"
              }}>
                {comment.commentMessage}
              </p>
            </div>
          ))}
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          background: "#FFF9E6",
          border: "2px solid #786A50",
          borderRadius: 20,
          paddingLeft: 8,
          paddingTop: 0,
          paddingRight: 8,
          paddingBottom: 8,
          color: "#786A50",
          fontFamily: "var(--font-m-plus-rounded)",
          boxShadow: "0 1px 4px rgba(120,106,80,0.04)",
          minHeight: 96,
          position: "relative",
          gap: 0,
        }}>
          {/* User Slack profile picture */}
          {userData?.profilePicture && (
            <div style={{height: "100%", paddingTop: 12}}>
            <img
              src={userData.profilePicture}
              alt="profile"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                objectFit: "cover",
                border: "1.5px solid #786A50",
                background: "#fff",
                marginRight: 0,
              }}
            />
            </div>
          )}
          <textarea
            placeholder="your comment"
            rows={1}
            value={comment}
            onChange={e => setComment(e.target.value)}
            style={{
              flex: 1,
              marginTop: 16,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "#786A50",
              fontSize: 15,
              fontFamily: "var(--font-m-plus-rounded)",
              padding: "8px",
              resize: "none",
              minHeight: 96,
              lineHeight: 1.4,
              overflow: "auto",
            }}
          />
          <button
            style={{
              background: "#FFF9E6",
              border: "2px solid #786A50",
              color: "#786A50",
              borderRadius: "50%",
              width: 24,
              height: 24,
              display: "flex",
              position: "absolute",
              bottom: 8, right: 8,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
              cursor: submitting || !comment.trim() ? "not-allowed" : "pointer",
              fontSize: 18,
              transition: "background 0.15s, color 0.15s",
              flexShrink: 0,
              boxSizing: "border-box",
              opacity: submitting || !comment.trim() ? 0.5 : 1,
            }}
            title="Send"
            disabled={submitting || !comment.trim()}
            onClick={handleSendComment}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 10h6" stroke="#786A50" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M11.5 7.5L14 10l-2.5 2.5" stroke="#786A50" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        </div>
        </div>

        {/* Navigation and pagination */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          marginTop: "20px",
          padding: "16px",
          marginBottom: "16px",
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          borderRadius: "12px",
          backdropFilter: "blur(4px)",
          width: "fit-content"
        }}>
          <div 
            onClick={handlePrevious}
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              border: "2px solid #B9A88F"
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18l-6-6 6-6" stroke="#644c36" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{
            fontFamily: "var(--font-m-plus-rounded)",
            fontSize: "18px",
            color: "#644c36",
            fontWeight: "bold"
          }}>
            {currentIndex + 1} / {localPosts.length}
          </div>

          <div 
            onClick={handleNext}
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              border: "2px solid #B9A88F"
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18l6-6-6-6" stroke="#644c36" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default PostsViewComponent; 