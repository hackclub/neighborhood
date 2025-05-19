import React, { useState, useEffect } from 'react';
import { M_PLUS_Rounded_1c } from "next/font/google";
import { getToken } from "@/utils/storage";

const mPlusRounded = M_PLUS_Rounded_1c({
  weight: "400",
  variable: "--font-m-plus-rounded",
  subsets: ["latin"],
});

const BOARD_BAR_HEIGHT = 145;

const ShipComponent = ({ isExiting, onClose, userData }) => {
  // State for selected app
  const [selectedApp, setSelectedApp] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState(() => {
    // Initialize with userData if available
    const initialData = {
      codeUrl: '',
      playableUrl: '',
      howDidYouHear: '',
      whatAreWeDoingWell: '',
      howCanWeImprove: '',
      firstName: '',
      lastName: '',
      email: '',
      screenshots: [],
      description: '',
      githubUsername: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      stateProvince: '',
      country: '',
      zipCode: '',
      birthday: ''
    };

    // If userData is available, use its values
    if (userData) {
      const [firstName = '', lastName = ''] = (userData.name || '').split(' ');
      return {
        ...initialData,
        firstName,
        lastName,
        email: userData.email || '',
        githubUsername: userData.githubUsername || '',
        birthday: userData.birthday || ''
      };
    }

    return initialData;
  });
  
  // Loading state for form submission
  const [submitting, setSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);

  // Function to handle input changes with validation
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    
    if (name === 'birthday') {
      console.log('Birthday input changed to:', value);
    }
    
    // Special handling for certain fields
    if (name === 'codeUrl' && value) {
      // Try to extract GitHub username from code URL
      const match = value.match(/github\.com\/([^\/]+)/);
      if (match) {
        const username = match[1];
        setFormData(prev => ({
          ...prev,
          [name]: value,
          githubUsername: username
        }));
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to handle screenshot upload
  const handleScreenshotUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      try {
        setSubmitting(true);
        
        // Use the upload-images endpoint which handles multiple files at once
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        formData.append('token', localStorage.getItem('neighborhoodToken') || getToken());
        
        const response = await fetch('https://express.neighborhood.hackclub.com/upload-images', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload screenshots');
        }
        
        const data = await response.json();
        if (data.urls && data.urls.length > 0) {
          setFormData(prev => ({
            ...prev,
            screenshots: [...prev.screenshots, ...data.urls]
          }));
        }
      } catch (error) {
        console.error('Error uploading screenshots:', error);
        alert('Failed to upload screenshots: ' + error.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Function to remove a screenshot
  const handleRemoveScreenshot = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      screenshots: prev.screenshots.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Fetch user's apps on component mount
  useEffect(() => {
    const fetchApps = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let token = localStorage.getItem('neighborhoodToken');
        if (!token) {
          token = getToken();
        }
        
        if (!token) {
          throw new Error("No token found");
        }
        
        console.log('Fetching apps with token:', token.substring(0, 5) + "..." + token.substring(token.length - 5));
        const response = await fetch(`/api/getUserApps?token=${token}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch apps");
        }
        
        console.log('Raw API response data:', data);
        
        // Sort apps by createdAt date (most recent first)
        const sortedApps = [...(data.apps || [])].sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        // Fetch additional details for each app including images
        const appsWithDetails = await Promise.all(sortedApps.map(async (app) => {
          try {
            const detailsResponse = await fetch(`/api/getAppDetails?token=${token}&appId=${app.id}`);
            if (detailsResponse.ok) {
              const details = await detailsResponse.json();
              return { ...app, ...details.app };
            }
          } catch (error) {
            console.error(`Failed to fetch details for app ${app.id}:`, error);
          }
          return app;
        }));
        
        console.log('Apps with full details:', appsWithDetails);
        setApps(appsWithDetails);
      } catch (err) {
        console.error("Error fetching apps:", err);
        setError(err.message || "Failed to fetch apps");
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  // Pre-populate form data when userData changes
  useEffect(() => {
    if (userData) {
      console.log('Received userData with birthday:', userData.birthday);
      // Split the name into first and last name
      const [firstName = '', lastName = ''] = (userData.name || '').split(' ');
      
      const userFormData = {
        firstName,
        lastName,
        email: userData.email || '',
        githubUsername: userData.githubUsername || '',
        // Try to get additional data from userData if available
        addressLine1: userData.addressLine1 || '',
        addressLine2: userData.addressLine2 || '',
        city: userData.city || '',
        stateProvince: userData.stateProvince || '',
        country: userData.country || '',
        zipCode: userData.zipCode || '',
        birthday: userData.birthday || ''  // Make sure we use the birthday from userData
      };
      
      console.log('Setting user form data with birthday:', userFormData.birthday);
      
      setFormData(prevData => {
        const newData = {
          ...prevData,
          ...userFormData
        };
        console.log('Final form data with birthday:', newData.birthday);
        return newData;
      });
    }
  }, [userData]);

  // Update form data when an app is selected
  useEffect(() => {
    if (selectedApp) {
      console.log('🔄 Selected app changed:', selectedApp);
      console.log('📱 App ID:', selectedApp.id);
      console.log('🖼️ App Images:', selectedApp.Images);
      console.log('📝 App Data:', {
        githubUrl: selectedApp.githubUrl,
        githubLink: selectedApp.githubLink,
        repoUrl: selectedApp.repoUrl,
        codeUrl: selectedApp.codeUrl,
        appUrl: selectedApp.appUrl,
        appLink: selectedApp.appLink,
        description: selectedApp.description
      });
      
      // Try to get GitHub username from various sources
      let githubUsername = selectedApp.githubUsername;
      if (!githubUsername) {
        const githubUrls = [
          selectedApp.githubUrl,
          selectedApp.githubLink,
          selectedApp["Github Link"],
          selectedApp.repoUrl,
          selectedApp.codeUrl
        ].filter(Boolean);
        
        console.log('🔍 Looking for GitHub username in URLs:', githubUrls);
        
        for (const url of githubUrls) {
          const match = url?.match(/github\.com\/([^\/]+)/);
          if (match) {
            githubUsername = match[1];
            console.log('✅ Found GitHub username:', githubUsername);
            break;
          }
        }
      }

      // Get images from the app data
      let appImages = [];
      
      // Add icon as the first image if it exists
      if (selectedApp.icon) {
        appImages.push(selectedApp.icon);
        console.log('➕ Added icon to images:', selectedApp.icon);
      }
      
      // Handle images from the app data
      if (selectedApp.images) {
        console.log('🖼️ Found images field:', selectedApp.images);
        if (Array.isArray(selectedApp.images)) {
          appImages = appImages.concat(selectedApp.images);
          console.log('➕ Added images array:', selectedApp.images);
        }
      }
      
      // Filter out any null, undefined, or empty strings
      appImages = appImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
      
      console.log('📸 Final collected app images:', appImages);

      // First update with app data
      setFormData(prevData => {
        console.log('🔄 Previous form data:', prevData);
        
        const newData = {
          ...prevData,
          codeUrl: selectedApp.githubUrl || selectedApp.githubLink || selectedApp["Github Link"] || selectedApp.repoUrl || selectedApp.codeUrl || '',
          playableUrl: selectedApp.appUrl || selectedApp.appLink || selectedApp["App Link"] || selectedApp.playableUrl || selectedApp.url || '',
          description: selectedApp.description || selectedApp.Description || selectedApp.about || selectedApp.name || '',
          screenshots: appImages,
          githubUsername: githubUsername || prevData.githubUsername,
          // Keep existing personal info if available
          firstName: prevData.firstName || '',
          lastName: prevData.lastName || '',
          email: prevData.email || '',
          birthday: prevData.birthday || '',
          // Initialize feedback fields
          howDidYouHear: prevData.howDidYouHear || '',
          whatAreWeDoingWell: prevData.whatAreWeDoingWell || '',
          howCanWeImprove: prevData.howCanWeImprove || '',
          // Keep existing address info if available
          addressLine1: prevData.addressLine1 || '',
          addressLine2: prevData.addressLine2 || '',
          city: prevData.city || '',
          stateProvince: prevData.stateProvince || '',
          country: prevData.country || '',
          zipCode: prevData.zipCode || ''
        };
        console.log('✨ Setting initial form data with app data:', newData);
        return newData;
      });

      // Then fetch and update with any existing submission data
      const fetchExistingSubmission = async () => {
        console.log('🔍 Fetching existing submission for app ID:', selectedApp.id);
        try {
          const token = localStorage.getItem('neighborhoodToken') || getToken();
          if (!token) {
            console.warn('⚠️ No token found for fetching submission');
            return;
          }
          console.log('🔑 Using token:', token.substring(0, 5) + '...' + token.substring(token.length - 5));

          const response = await fetch(`/api/getSubmission?appId=${selectedApp.id}&token=${token}`);
          console.log('📡 Submission API response status:', response.status);
          
          if (!response.ok) {
            if (response.status !== 404) {
              const errorText = await response.text();
              console.error('❌ Error fetching submission:', errorText);
            } else {
              console.log('ℹ️ No existing submission found (404)');
            }
            return;
          }

          const data = await response.json();
          console.log('📦 Received submission data:', data);
          
          if (data.submission) {
            console.log('✅ Found existing submission, fields:', data.submission.fields);
            setFormData(prev => {
              const updatedData = {
                ...prev,
                codeUrl: data.submission.fields['Code URL'] || prev.codeUrl,
                playableUrl: data.submission.fields['Playable URL'] || prev.playableUrl,
                howDidYouHear: data.submission.fields['How did you hear about this?'] || prev.howDidYouHear,
                whatAreWeDoingWell: data.submission.fields['What are we doing well?'] || prev.whatAreWeDoingWell,
                howCanWeImprove: data.submission.fields['How can we improve?'] || prev.howCanWeImprove,
                firstName: data.submission.fields['First Name'] || prev.firstName,
                lastName: data.submission.fields['Last Name'] || prev.lastName,
                email: data.submission.fields['Email'] || prev.email,
                screenshots: (data.submission.fields['Screenshot'] || []).map(s => s.url).length > 0 
                  ? (data.submission.fields['Screenshot'] || []).map(s => s.url)
                  : prev.screenshots,
                description: data.submission.fields['Description'] || prev.description,
                githubUsername: data.submission.fields['GitHub Username'] || prev.githubUsername,
                addressLine1: data.submission.fields['Address (Line 1)'] || prev.addressLine1,
                addressLine2: data.submission.fields['Address (Line 2)'] || prev.addressLine2,
                city: data.submission.fields['City'] || prev.city,
                stateProvince: data.submission.fields['State / Province'] || prev.stateProvince,
                country: data.submission.fields['Country'] || prev.country,
                zipCode: data.submission.fields['ZIP / Postal Code'] || prev.zipCode,
                birthday: data.submission.fields['Birthday'] || prev.birthday
              };
              console.log('✨ Updated form data with submission:', updatedData);
              return updatedData;
            });
          } else {
            console.log('ℹ️ No submission data in response');
          }
        } catch (error) {
          console.error('❌ Error fetching existing submission:', error);
        }
      };

      fetchExistingSubmission();
    }
  }, [selectedApp]);

  // Log whenever screenshots change
  useEffect(() => {
    console.log('Screenshots updated:', formData.screenshots);
  }, [formData.screenshots]);

  // Log whenever form data changes
  useEffect(() => {
    console.log('📝 Form data updated:', formData);
  }, [formData]);

  // Log form data changes
  useEffect(() => {
    console.log('Form data updated, birthday value:', formData.birthday);
  }, [formData]);

  // Fetch existing submission data when an app is selected
  useEffect(() => {
    const fetchExistingSubmission = async () => {
      if (!selectedApp || !selectedApp.id) return;

      try {
        const token = localStorage.getItem('neighborhoodToken') || getToken();
        if (!token) return;

        const response = await fetch(`/api/getSubmission?appId=${selectedApp.id}&token=${token}`);
        if (!response.ok) {
          if (response.status !== 404) { // 404 just means no submission yet
            console.error('Error fetching submission:', await response.text());
          }
          return;
        }

        const data = await response.json();
        if (data.submission) {
          setExistingSubmission(data.submission);
          // Update form data with existing submission
          setFormData(prev => ({
            ...prev,
            codeUrl: data.submission.fields['Code URL'] || '',
            playableUrl: data.submission.fields['Playable URL'] || '',
            howDidYouHear: data.submission.fields['How did you hear about this?'] || '',
            whatAreWeDoingWell: data.submission.fields['What are we doing well?'] || '',
            howCanWeImprove: data.submission.fields['How can we improve?'] || '',
            firstName: data.submission.fields['First Name'] || prev.firstName,
            lastName: data.submission.fields['Last Name'] || prev.lastName,
            email: data.submission.fields['Email'] || prev.email,
            screenshots: (data.submission.fields['Screenshot'] || []).map(s => s.url),
            description: data.submission.fields['Description'] || '',
            githubUsername: data.submission.fields['GitHub Username'] || prev.githubUsername,
            addressLine1: data.submission.fields['Address (Line 1)'] || '',
            addressLine2: data.submission.fields['Address (Line 2)'] || '',
            city: data.submission.fields['City'] || '',
            stateProvince: data.submission.fields['State / Province'] || '',
            country: data.submission.fields['Country'] || '',
            zipCode: data.submission.fields['ZIP / Postal Code'] || '',
            birthday: data.submission.fields['Birthday'] || prev.birthday
          }));
        }
      } catch (error) {
        console.error('Error fetching existing submission:', error);
      }
    };

    fetchExistingSubmission();
  }, [selectedApp]);

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApp) {
      alert("Please select an app to ship");
      return;
    }
    
    try {
      setSubmitting(true);
      console.log('🚀 Submitting form data:', formData);
      
      let token = localStorage.getItem('neighborhoodToken');
      if (!token) {
        token = getToken();
      }
      
      if (!token) {
        throw new Error("No token found");
      }
      console.log('🔑 Using token for submission:', token.substring(0, 5) + '...' + token.substring(token.length - 5));
      
      const response = await fetch('/api/shipApp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          appId: selectedApp.id,
          ...formData
        }),
      });
      
      console.log('📡 Ship API response status:', response.status);
      
      if (!response.ok) {
        const data = await response.json();
        console.error('❌ Ship API error:', data);
        if (data.error === 'SCREENSHOT_TOO_LARGE') {
          alert("One or more screenshots are too large. Please reduce their size and try again.");
        } else {
          throw new Error(data.message || "Failed to ship app");
        }
        return;
      }
      
      const data = await response.json();
      console.log('✅ Ship API success:', data);
      alert(data.wasUpdate ? "App shipping info updated successfully!" : "App shipped successfully!");
      onClose();
    } catch (err) {
      console.error('❌ Error shipping app:', err);
      alert(err.message || "Failed to ship app");
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
          Ship Your App
        </div>
      </div>

      {/* Content area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "#ffead1",
        padding: "30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        {loading ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
            width: "100%"
          }}>
            <p style={{
              fontFamily: "var(--font-m-plus-rounded)",
              fontSize: "18px",
              color: "#6c4a24"
            }}>Loading...</p>
          </div>
        ) : error ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
            width: "100%"
          }}>
            <p style={{
              fontFamily: "var(--font-m-plus-rounded)",
              fontSize: "18px",
              color: "#e74c3c"
            }}>{error}</p>
          </div>
        ) : (
          <div style={{
            width: "100%",
            maxWidth: "800px"
          }}>
            {/* App selection */}
            <div style={{
              marginBottom: selectedApp ? "30px" : "0"
            }}>
              <h3 style={{
                fontFamily: "var(--font-m-plus-rounded)",
                fontSize: "18px",
                color: "#6c4a24",
                marginBottom: "16px"
              }}>
                Select an App to Ship
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "16px"
              }}>
                {apps.map(app => (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    style={{
                      backgroundColor: selectedApp?.id === app.id ? "#8b6b4a" : "#fff",
                      borderRadius: "12px",
                      padding: "16px",
                      cursor: "pointer",
                      border: `2px solid ${selectedApp?.id === app.id ? "#8b6b4a" : "#B9A88F"}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      backgroundColor: "#f1f5f9",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      overflow: "hidden"
                    }}>
                      {app.icon ? (
                        <img
                          src={app.icon}
                          alt={app.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "32px",
                          height: "32px",
                          backgroundColor: "#8b6b4a",
                          borderRadius: "6px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          color: "#fff",
                          fontSize: "16px",
                          fontWeight: "bold"
                        }}>
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p style={{
                      margin: 0,
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "14px",
                      color: selectedApp?.id === app.id ? "#fff" : "#6c4a24",
                      textAlign: "center",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%"
                    }}>
                      {app.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Only show the form if an app is selected */}
            {selectedApp && (
              <form onSubmit={handleSubmit}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px"
                }}>
                  {/* URLs Section */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "2px solid #8b6b4a"
                  }}>
                    <h3 style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "18px",
                      color: "#6c4a24",
                      marginBottom: "16px"
                    }}>
                      App Details
                    </h3>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <div>
                        <label
                          htmlFor="codeUrl"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Code URL *
                        </label>
                        <input
                          type="url"
                          id="codeUrl"
                          name="codeUrl"
                          required
                          value={formData.codeUrl}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                          placeholder="https://github.com/username/repo"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="playableUrl"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          App URL *
                        </label>
                        <input
                          type="url"
                          id="playableUrl"
                          name="playableUrl"
                          required
                          value={formData.playableUrl}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                          placeholder="https://yourapp.com"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="githubUsername"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          GitHub Username *
                        </label>
                        <input
                          type="text"
                          id="githubUsername"
                          name="githubUsername"
                          required
                          value={formData.githubUsername}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="description"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Description *
                        </label>
                        <textarea
                          id="description"
                          name="description"
                          required
                          value={formData.description}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            minHeight: "100px",
                            resize: "vertical"
                          }}
                          placeholder="Describe your app and what makes it special..."
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Screenshots *
                        </label>
                        <div style={{
                          border: "2px dashed #8b6b4a",
                          borderRadius: "6px",
                          padding: "20px",
                          textAlign: "center",
                          cursor: "pointer",
                          position: "relative"
                        }}>
                          <input
                            type="file"
                            id="screenshot"
                            accept="image/*"
                            multiple
                            onChange={handleScreenshotUpload}
                            style={{
                              opacity: 0,
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              cursor: "pointer"
                            }}
                          />
                          {formData.screenshots.length > 0 ? (
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                              gap: "16px",
                              marginBottom: formData.screenshots.length > 0 ? "16px" : "0"
                            }}>
                              {formData.screenshots.map((url, index) => (
                                <div
                                  key={index}
                                  style={{
                                    position: "relative",
                                    width: "100%",
                                    aspectRatio: "16/9",
                                    borderRadius: "4px",
                                    overflow: "hidden"
                                  }}
                                >
                                  <img
                                    src={url}
                                    alt={`Screenshot ${index + 1}`}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover"
                                    }}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleRemoveScreenshot(index);
                                    }}
                                    style={{
                                      position: "absolute",
                                      top: "8px",
                                      right: "8px",
                                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: "24px",
                                      height: "24px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      padding: 0
                                    }}
                                  >
                                    <span style={{ fontSize: "16px" }}>×</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "8px"
                            }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20Z" stroke="#8b6b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span style={{
                                fontFamily: "var(--font-m-plus-rounded)",
                                fontSize: "14px",
                                color: "#8b6b4a"
                              }}>
                                Click or drag to upload screenshots
                              </span>
                            </div>
                          )}
                          <div style={{
                            marginTop: formData.screenshots.length > 0 ? "16px" : "0",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#8b6b4a"
                          }}>
                            Click or drag to add more screenshots
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information Section */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "2px solid #8b6b4a"
                  }}>
                    <h3 style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "18px",
                      color: "#6c4a24",
                      marginBottom: "16px"
                    }}>
                      Personal Information
                    </h3>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px"
                    }}>
                      <div>
                        <label
                          htmlFor="firstName"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          First Name *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          required
                          value={formData.firstName}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lastName"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Last Name *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          required
                          value={formData.lastName}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label
                          htmlFor="email"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Email *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label
                          htmlFor="birthday"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Birthday *
                        </label>
                        <input
                          type="date"
                          id="birthday"
                          name="birthday"
                          required
                          value={formData.birthday}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feedback Section */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "2px solid #8b6b4a"
                  }}>
                    <h3 style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "18px",
                      color: "#6c4a24",
                      marginBottom: "16px"
                    }}>
                      Your Feedback
                    </h3>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <div>
                        <label
                          htmlFor="howDidYouHear"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          How did you hear about this? *
                        </label>
                        <textarea
                          id="howDidYouHear"
                          name="howDidYouHear"
                          required
                          value={formData.howDidYouHear}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            minHeight: "80px",
                            resize: "vertical"
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="whatAreWeDoingWell"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          What are we doing well? *
                        </label>
                        <textarea
                          id="whatAreWeDoingWell"
                          name="whatAreWeDoingWell"
                          required
                          value={formData.whatAreWeDoingWell}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            minHeight: "80px",
                            resize: "vertical"
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="howCanWeImprove"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          How can we improve? *
                        </label>
                        <textarea
                          id="howCanWeImprove"
                          name="howCanWeImprove"
                          required
                          value={formData.howCanWeImprove}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            minHeight: "80px",
                            resize: "vertical"
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "2px solid #8b6b4a"
                  }}>
                    <h3 style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "18px",
                      color: "#6c4a24",
                      marginBottom: "16px"
                    }}>
                      Address
                    </h3>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <div>
                        <label
                          htmlFor="addressLine1"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Address Line 1 *
                        </label>
                        <input
                          type="text"
                          id="addressLine1"
                          name="addressLine1"
                          required
                          value={formData.addressLine1}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="addressLine2"
                          style={{
                            display: "block",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px",
                            color: "#6c4a24",
                            marginBottom: "8px"
                          }}
                        >
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          id="addressLine2"
                          name="addressLine2"
                          value={formData.addressLine2}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #8b6b4a",
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px"
                      }}>
                        <div>
                          <label
                            htmlFor="city"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "8px"
                            }}
                          >
                            City *
                          </label>
                          <input
                            type="text"
                            id="city"
                            name="city"
                            required
                            value={formData.city}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px"
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="stateProvince"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "8px"
                            }}
                          >
                            State / Province *
                          </label>
                          <input
                            type="text"
                            id="stateProvince"
                            name="stateProvince"
                            required
                            value={formData.stateProvince}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px"
                            }}
                          />
                        </div>
                      </div>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px"
                      }}>
                        <div>
                          <label
                            htmlFor="country"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "8px"
                            }}
                          >
                            Country *
                          </label>
                          <input
                            type="text"
                            id="country"
                            name="country"
                            required
                            value={formData.country}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px"
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="zipCode"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "8px"
                            }}
                          >
                            ZIP / Postal Code *
                          </label>
                          <input
                            type="text"
                            id="zipCode"
                            name="zipCode"
                            required
                            value={formData.zipCode}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px"
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "24px",
                    marginBottom: "40px"
                  }}>
                    <button
                      type="submit"
                      disabled={submitting || !selectedApp}
                      style={{
                        backgroundColor: submitting || !selectedApp ? "#b0987d" : "#8b6b4a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "16px 32px",
                        fontSize: "16px",
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontWeight: "bold",
                        cursor: submitting || !selectedApp ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      {submitting ? (
                        <>
                          <span style={{
                            display: "inline-block",
                            width: "20px",
                            height: "20px",
                            border: "3px solid #fff",
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite"
                          }}></span>
                          <span>Shipping...</span>
                        </>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>Ship App</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipComponent; 