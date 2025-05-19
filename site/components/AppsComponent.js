import React, { useState, useEffect } from 'react';
import { M_PLUS_Rounded_1c } from "next/font/google";
import { getToken } from "@/utils/storage";
import DisconnectedHackatime from "./DisconnectedHackatime";

const mPlusRounded = M_PLUS_Rounded_1c({
  weight: "400",
  variable: "--font-m-plus-rounded",
  subsets: ["latin"],
});

const BOARD_BAR_HEIGHT = 145;

const AppsComponent = ({ isExiting, onClose, userData, setUserData, slackUsers, setSlackUsers, connectingSlack, setConnectingSlack, searchSlack, setSearchSlack, setUIPage }) => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleApps, setVisibleApps] = useState(5); // Number of apps to show initially
  const [showCreateForm, setShowCreateForm] = useState(false); // Whether to show the create app form
  const [showJoinForm, setShowJoinForm] = useState(false); // Whether to show the join app form
  const [availableApps, setAvailableApps] = useState([]); // Apps available to join
  const [joiningApp, setJoiningApp] = useState(false); // Loading state for joining an app
  const [leavingApp, setLeavingApp] = useState(false); // Loading state for leaving an app
  const [searchQuery, setSearchQuery] = useState(''); // Search query for filtering available apps
  const [isEditing, setIsEditing] = useState(false); // Whether form is in edit mode
  const [currentAppId, setCurrentAppId] = useState(null); // ID of the app being edited
  const [hackatimeProjects, setHackatimeProjects] = useState([]); // Add state for Hackatime projects
  const [loadingHackatime, setLoadingHackatime] = useState(false); // Add loading state for Hackatime
  const [hackatimeSearch, setHackatimeSearch] = useState(''); // Add search state
  const [showAllProjects, setShowAllProjects] = useState(false); // Add state for showing all projects
  const [projectLoadingStates, setProjectLoadingStates] = useState({}); // Add loading state for individual projects
  const [projectErrors, setProjectErrors] = useState({}); // Add error state for individual projects
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    icon: null,
    appLink: '',
    githubLink: '',
    description: '',
    images: [],
    hackatimeProjects: [], // Add hackatime projects array
    hackatimeProjectGithubLinks: {} // Add object to store GitHub links for each project
  });

  // Add a state for form submission loading
  const [submitting, setSubmitting] = useState(false);

  // Function to handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to handle icon upload
  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setSubmitting(true); // Show loading state
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('token', localStorage.getItem('neighborhoodToken') || getToken());
        
        // Upload to S3 via neighborhood-express
        const response = await fetch('https://express.neighborhood.hackclub.com/upload-icon', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload icon');
        }
        
        const data = await response.json();
        
        // Update form with the S3 URL
        setFormData(prev => ({
          ...prev,
          icon: data.url
        }));
      } catch (error) {
        console.error('Error uploading icon:', error);
        alert('Failed to upload icon: ' + error.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Function to handle image uploads
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      try {
        setSubmitting(true); // Show loading state
        
        // Create form data with multiple files
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file); // Use 'files' to match the backend expectation
        });
        formData.append('token', localStorage.getItem('neighborhoodToken') || getToken());
        
        // Upload to S3 via neighborhood-express
        const response = await fetch('https://express.neighborhood.hackclub.com/upload-images', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload images');
        }
        
        const data = await response.json();
        
        // Update form with the comma-separated S3 URLs
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...data.urls]
        }));
      } catch (error) {
        console.error('Error uploading images:', error);
        alert('Failed to upload images: ' + error.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Function to remove an uploaded image
  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Function to handle GitHub URL input for a Hackatime project
  const handleHackatimeProjectGithubLink = (projectName, githubUrl) => {
    setFormData(prev => ({
      ...prev,
      hackatimeProjectGithubLinks: {
        ...prev.hackatimeProjectGithubLinks,
        [projectName]: githubUrl
      }
    }));
  };

  // Function to reset form state
  const resetForm = () => {
    setFormData({
      name: '',
      icon: null,
      appLink: '',
      githubLink: '',
      description: '',
      images: [],
      hackatimeProjects: [], // Reset hackatime projects array
      hackatimeProjectGithubLinks: {} // Reset GitHub links
    });
    setIsEditing(false);
    setCurrentAppId(null);
  };

  // Function to load an app into the form for editing
  const editApp = (app) => {
    console.log("\n=== EDIT APP FUNCTION ===");
    console.log("Full app data:", app);
    console.log("App's hackatime projects:", app.hackatimeProjects);
    console.log("App's hackatime project GitHub links:", app.hackatimeProjectGithubLinks);
    console.log("Available hackatime projects:", hackatimeProjects.map(p => ({
      name: p.name,
      isAttributed: p.isAttributed,
      attributedToAppId: p.attributedToAppId,
      isUserProject: p.isUserProject
    })));

    // Set form data from app details
    const selectedProjects = app.hackatimeProjects || [];
    let githubLinks = app.hackatimeProjectGithubLinks || {};

    // If we have a main githubLink and a project but no specific project GitHub link,
    // initialize the project's GitHub link with the main one
    if (app.githubLink && selectedProjects.length > 0) {
      selectedProjects.forEach(projectName => {
        if (!githubLinks[projectName]) {
          githubLinks[projectName] = app.githubLink;
        }
      });
    }
    
    console.log("[DEBUG] Initial selected projects:", selectedProjects);

    // Filter out any projects that are not owned by the user
    const validSelectedProjects = selectedProjects.filter(projectName => {
      const project = hackatimeProjects.find(p => p.name === projectName);
      const isValid = project && project.isUserProject;
      
      console.log(`[DEBUG] Validating project "${projectName}":`, {
        found: !!project,
        isUserProject: project?.isUserProject,
        isValid
      });
      return isValid;
    });

    console.log("[DEBUG] Final selected projects:", validSelectedProjects);
    console.log("[DEBUG] GitHub links to set:", githubLinks);

    const newFormData = {
      name: app.name || '',
      icon: app.icon || null,
      appLink: app.appLink || '',
      githubLink: app.githubLink || '',
      description: app.description || '',
      images: app.images || [],
      hackatimeProjects: validSelectedProjects,
      hackatimeProjectGithubLinks: githubLinks
    };

    console.log("[DEBUG] Setting form data to:", newFormData);
    setFormData(newFormData);
    
    setIsEditing(true);
    setCurrentAppId(app.id);
    setShowCreateForm(true);
  };

  // Function to submit the form (create or update)
  const submitForm = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert("App name is required");
      return;
    }
    
    setSubmitting(true);
    
    try {
      let token = localStorage.getItem('neighborhoodToken');
      if (!token) {
        token = getToken();
      }
      
      if (!token) {
        throw new Error("No token found");
      }
      
      if (isEditing && currentAppId) {
        const response = await fetch('/api/updateApp', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            appId: currentAppId,
            name: formData.name,
            icon: formData.icon,
            appLink: formData.appLink,
            githubLink: formData.githubLink,
            description: formData.description,
            images: formData.images,
            hackatimeProjects: formData.hackatimeProjects,
            hackatimeProjectGithubLinks: formData.hackatimeProjectGithubLinks
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          // Check if the error is related to hackatime project attribution
          if (data.type === "project_already_attributed") {
            alert(`Cannot update app: The project "${data.projectName}" is already attributed to another app.`);
            // Remove the project from selection
            setFormData(prev => ({
              ...prev,
              hackatimeProjects: prev.hackatimeProjects.filter(name => name !== data.projectName),
              hackatimeProjectGithubLinks: {
                ...prev.hackatimeProjectGithubLinks,
                [data.projectName]: undefined // Remove the GitHub link for this project
              }
            }));
            return;
          }
          throw new Error(data.message || "Failed to update app");
        }
        
        // Update the app in the apps state
        setApps(prevApps => 
          prevApps.map(app => 
            app.id === currentAppId ? {
              ...data.app,
              hackatimeProjectGithubLinks: data.app.hackatimeProjectGithubLinks || {}
            } : app
          )
        );
        
        // Show success message
        alert("App updated successfully!");
      } else {
        // Create new app
        const response = await fetch('/api/createApp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            name: formData.name,
            icon: formData.icon,
            appLink: formData.appLink,
            githubLink: formData.githubLink,
            description: formData.description,
            images: formData.images,
            hackatimeProjects: formData.hackatimeProjects,
            hackatimeProjectGithubLinks: formData.hackatimeProjectGithubLinks
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          // Check if the error is related to hackatime project attribution
          if (data.type === "project_already_attributed") {
            alert(`Cannot create app: The project "${data.projectName}" is already attributed to another app.`);
            // Remove the project from selection
            setFormData(prev => ({
              ...prev,
              hackatimeProjects: prev.hackatimeProjects.filter(name => name !== data.projectName),
              hackatimeProjectGithubLinks: {
                ...prev.hackatimeProjectGithubLinks,
                [data.projectName]: undefined // Remove the GitHub link for this project
              }
            }));
            return;
          }
          throw new Error(data.message || "Failed to create app");
        }
        
        // Add the new app to the apps state
        setApps(prevApps => [{
          ...data.app,
          hackatimeProjectGithubLinks: data.app.hackatimeProjectGithubLinks || {}
        }, ...prevApps]);
        
        // Show success message
        alert("App created successfully!");
      }
      
      // Reset form
      resetForm();
      
      // Return to apps list view
      setShowCreateForm(false);
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} app:`, err);
      alert(err.message || `Failed to ${isEditing ? 'update' : 'create'} app`);
    } finally {
      setSubmitting(false);
    }
  };

  // Function to fetch full app details for editing
  const fetchAppDetails = async (appId) => {
    try {
      console.log("\n=== FETCHING APP DETAILS ===");
      console.log("Fetching details for app ID:", appId);
      
      setLoading(true);
      let token = localStorage.getItem('neighborhoodToken');
      if (!token) {
        token = getToken();
      }
      
      if (!token) {
        throw new Error("No token found");
      }

      const response = await fetch(`/api/getAppDetails?token=${token}&appId=${appId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch app details");
      }
      
      const data = await response.json();
      console.log("Raw API response:", data);
      console.log("App details:", data.app);
      console.log("GitHub links in response:", data.app.hackatimeProjectGithubLinks);
      
      return data.app;
    } catch (err) {
      console.error("Error fetching app details:", err);
      alert(err.message || "Failed to fetch app details");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to handle clicking on an app
  const handleAppClick = async (app) => {
    try {
      console.log("=== HANDLE APP CLICK ===");
      console.log("Initial app data:", app);
      
      // First fetch full app details since the list view might not have all the data
      const appDetails = await fetchAppDetails(app.id);
      console.log("Fetched app details:", appDetails);
      console.log("GitHub links in app details:", appDetails?.hackatimeProjectGithubLinks);
      
      if (appDetails) {
        editApp(appDetails);
      }
    } catch (err) {
      console.error("Error preparing app for edit:", err);
      alert("Could not load app details for editing");
    }
  };

  // Function to show more apps
  const loadMoreApps = () => {
    setVisibleApps(prev => prev + 5);
  };

  // Function to fetch available apps for joining
  const fetchAvailableApps = async () => {
    try {
      setLoading(true);
      let token = localStorage.getItem('neighborhoodToken');
      if (!token) {
        token = getToken();
      }
      
      if (!token) {
        throw new Error("No token found");
      }

      const response = await fetch(`/api/getAvailableApps?token=${token}`);
      if (!response.ok) {
        throw new Error("Failed to fetch available apps");
      }
      
      const data = await response.json();
      setAvailableApps(data.apps || []);
    } catch (err) {
      console.error("Error fetching available apps:", err);
      setError(err.message || "Failed to fetch available apps");
    } finally {
      setLoading(false);
    }
  };

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

        console.log("Fetching apps using token:", token.substring(0, 5) + "..." + token.substring(token.length - 5));
        
        const response = await fetch(`/api/getUserApps?token=${token}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch apps");
        }
        
        console.log(`Fetched ${data.apps ? data.apps.length : 0} apps`);
        
        // Sort apps by createdAt date (most recent first)
        const sortedApps = [...(data.apps || [])].sort((a, b) => {
          // If createdAt is missing, put at the end
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          // Otherwise sort by date, newest first
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        if (sortedApps.length === 0) {
          console.log("No apps found for user");
        } else {
          console.log("Apps found:", sortedApps.map(app => app.name).join(", "));
        }
        
        setApps(sortedApps);
      } catch (err) {
        console.error("Error fetching apps:", err);
        setError(err.message || "Failed to fetch apps");
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [userData]);

  useEffect(() => {
    const fetchHackatimeProjects = async () => {
      try {
        setLoadingHackatime(true);
        
        if (!userData?.slackId) {
          console.log('No Slack ID available');
          return;
        }

        console.log("[DEBUG] Fetching Hackatime projects for user:", {
          slackId: userData.slackId,
          userId: userData.id,
          currentAppId: currentAppId
        });

        const response = await fetch(`/api/getHackatimeProjects?slackId=${userData.slackId}&userId=${userData.id}`);
        if (!response.ok) {
          console.log('No Hackatime projects found or error fetching them');
          setHackatimeProjects([]); // Set empty array instead of throwing
          return;
        }
        
        const data = await response.json();
        console.log("[DEBUG] Received Hackatime projects:", data.projects?.map(p => ({
          name: p.name,
          isAttributed: p.isAttributed,
          attributedToAppId: p.attributedToAppId,
          totalSeconds: p.total_seconds
        })));
        setHackatimeProjects(data.projects || []);
      } catch (err) {
        console.error("Error fetching Hackatime projects:", err);
        setHackatimeProjects([]); // Set empty array on error
      } finally {
        setLoadingHackatime(false);
      }
    };

    if (userData?.slackId) {
      fetchHackatimeProjects();
    }
  }, [userData?.slackId]);

  // Function to handle creating a new app
  const handleCreateApp = () => {
    resetForm(); // Ensure the form is clean for new app
    setShowCreateForm(true);
  };

  // Function to handle joining an existing app
  const handleJoinApp = () => {
    setShowJoinForm(true);
    fetchAvailableApps();
  };
  
  // Function to join a specific app
  const joinApp = async (appId) => {
    try {
      setJoiningApp(true);
      let token = localStorage.getItem('neighborhoodToken');
      if (!token) {
        token = getToken();
      }
      
      if (!token) {
        throw new Error("No token found");
      }
      
      const response = await fetch('/api/joinApp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          appId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to join app");
      }
      
      const data = await response.json();
      
      // Add the joined app to the user's apps
      // The app data from the response now includes all necessary fields
      setApps(prevApps => [data.app, ...prevApps]);
      
      // Return to apps list view
      setShowJoinForm(false);
      
      // Show success message
      alert("Successfully joined app!");
    } catch (err) {
      console.error("Error joining app:", err);
      alert(err.message || "Failed to join app");
    } finally {
      setJoiningApp(false);
    }
  };

  const getSuggestedAppIcon = (projectName) => {
    // Generate a consistent variation based on the project name
    const hash = projectName.split('').reduce((hash, char) => {
      return char.charCodeAt(0) + ((hash << 5) - hash);
    }, 0);
    
    // Use varying shades of brown
    const lightness = 25 + (Math.abs(hash) % 20); // Between 25-45% lightness for darker browns
    const saturation = 40 + (Math.abs(hash) % 30); // Between 40-70% saturation
    const color = `hsl(30, ${saturation}%, ${lightness}%)`;
    
    return color;
  };
  
  // Function to filter available apps based on search query
  const getFilteredApps = () => {
    if (!searchQuery.trim()) return availableApps;
    
    return availableApps.filter(app => 
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  // Function to handle Hackatime project selection
  const handleHackatimeProjectSelect = async (project) => {
    // If the project comes from Hackatime data, we should always allow selection
    // The backend will create a new project record if needed
    console.log('[DEBUG] Handling project selection:', {
      projectName: project.name,
      isAttributed: project.isAttributed,
      isUserProject: project.isUserProject,
      currentAppId,
      totalSeconds: project.total_seconds // This indicates it's from Hackatime data
    });

    // If we're deselecting the project
    if (formData.hackatimeProjects.includes(project.name)) {
      console.log('Deselecting project:', project.name);
      // Remove project from form data
      setFormData(prev => ({
        ...prev,
        hackatimeProjects: prev.hackatimeProjects.filter(p => p !== project.name),
        hackatimeProjectGithubLinks: {
          ...prev.hackatimeProjectGithubLinks,
          [project.name]: undefined // Remove the GitHub link for this project
        }
      }));
    } else {
      // We're selecting the project
      console.log('Selecting project:', project.name);
      setFormData(prev => ({
        ...prev,
        hackatimeProjects: [...prev.hackatimeProjects, project.name],
        hackatimeProjectGithubLinks: {
          ...prev.hackatimeProjectGithubLinks,
          [project.name]: prev.githubLink || '' // Initialize with main GitHub link if available
        }
      }));
    }
  };

  // Function to handle leaving an app
  const leaveApp = async (appId, e) => {
    try {
      e.stopPropagation(); // Prevent triggering the parent click handler
      
      if (!confirm("Are you sure you want to leave this app?")) {
        return;
      }

      setLeavingApp(true);
      let token = localStorage.getItem('neighborhoodToken');
      if (!token) {
        token = getToken();
      }
      
      if (!token) {
        throw new Error("No token found");
      }

      const response = await fetch('/api/leaveApp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          appId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to leave app");
      }

      // Remove the app from the local state
      setApps(prevApps => prevApps.filter(app => app.id !== appId));
      alert("Successfully left the app");
    } catch (err) {
      console.error("Error leaving app:", err);
      alert(err.message || "Failed to leave app");
    } finally {
      setLeavingApp(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes hackatimeLoadingSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div
        className={`pop-in ${isExiting ? "hidden" : ""}`}
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
            onClick={showCreateForm ? () => {
              setShowCreateForm(false);
              resetForm();
            } : showJoinForm ? () => setShowJoinForm(false) : onClose}
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
            {showCreateForm ? (isEditing ? "Edit App" : "Create New App") : showJoinForm ? "Join App" : "My Apps"}
          </div>
          {!showCreateForm && !showJoinForm && (
            <div style={{
              display: "flex",
              gap: "10px",
              marginLeft: "auto"
            }}>
              <button
                onClick={handleCreateApp}
                style={{
                  backgroundColor: "#8b6b4a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontFamily: "var(--font-m-plus-rounded)",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Create App
              </button>
              <button
                onClick={handleJoinApp}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#8b6b4a",
                  border: "2px solid #8b6b4a",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontFamily: "var(--font-m-plus-rounded)",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="#8b6b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Join App
              </button>
            </div>
          )}
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
          ) : showCreateForm ? (
            <div style={{
              width: "100%",
              maxWidth: "1200px",
              marginTop: "10px"
            }}>
              <form onSubmit={submitForm}>
                {/* Form container with 3-part layout */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  width: "100%"
                }}>
                  {/* Top section: Split into left and right */}
                  <div style={{
                    display: "flex",
                    gap: "24px",
                    width: "100%",
                    minHeight: "300px"
                  }}>
                    {/* Top Left: Image Upload Area */}
                    <div style={{
                      flex: 1,
                      backgroundColor: "#fff",
                      borderRadius: "12px",
                      padding: "20px",
                      border: "2px solid #8b6b4a",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <h3 style={{
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontSize: "18px",
                        color: "#6c4a24",
                        margin: 0
                      }}>
                        App Images
                      </h3>
                      <p style={{
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontSize: "14px",
                        color: "#8b6b4a",
                        margin: 0
                      }}>
                        Drop screenshots or images of your app here
                      </p>
                      
                      <div style={{
                        flex: 1,
                        border: "2px dashed #8b6b4a",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        position: "relative",
                        overflow: "hidden"
                      }}>
                        <input 
                          type="file" 
                          id="images" 
                          name="images"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
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
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20Z" stroke="#8b6b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <p style={{
                          fontFamily: "var(--font-m-plus-rounded)",
                          fontSize: "14px",
                          color: "#8b6b4a",
                          marginTop: "10px"
                        }}>
                          Click or drag images here
                        </p>
                      </div>
                      
                      {formData.images.length > 0 && (
                        <div style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px"
                        }}>
                          {formData.images.map((img, index) => (
                            <div 
                              key={index}
                              style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "6px",
                                overflow: "hidden",
                                position: "relative"
                              }}
                            >
                              <img 
                                src={img} 
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover"
                                }}
                                alt={`App image ${index + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                style={{
                                  position: "absolute",
                                  top: "2px",
                                  right: "2px",
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  backgroundColor: "rgba(255, 0, 0, 0.7)",
                                  border: "none",
                                  color: "white",
                                  fontSize: "12px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer"
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Top Right: App Details Form */}
                    <div style={{
                      flex: 1,
                      backgroundColor: "#fff",
                      borderRadius: "12px",
                      padding: "20px",
                      border: "2px solid #8b6b4a",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <h3 style={{
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontSize: "18px",
                        color: "#6c4a24",
                        margin: 0
                      }}>
                        App Details
                      </h3>
                      
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px"
                      }}>
                        {/* Icon upload */}
                        <div>
                          <label 
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "5px"
                            }}
                          >
                            App Icon
                          </label>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px"
                          }}>
                            <div style={{
                              width: "60px",
                              height: "60px",
                              borderRadius: "8px",
                              border: "2px dashed #8b6b4a",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                              backgroundColor: formData.icon ? "transparent" : "#f8f2e9"
                            }}>
                              {formData.icon ? (
                                <img 
                                  src={formData.icon} 
                                  alt="App Icon" 
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover"
                                  }}
                                />
                              ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 5V19M5 12H19" stroke="#8b6b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              <input 
                                type="file" 
                                id="icon" 
                                name="icon"
                                accept="image/*"
                                onChange={handleIconUpload}
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
                            </div>
                            <span style={{
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "13px",
                              color: "#8b6b4a"
                            }}>
                              Click to upload icon
                            </span>
                          </div>
                        </div>
                        
                        {/* App Name */}
                        <div>
                          <label 
                            htmlFor="name"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "5px"
                            }}
                          >
                            App Name *
                          </label>
                          <input 
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              backgroundColor: "#fff"
                            }}
                            placeholder="Enter your app name"
                          />
                        </div>
                        
                        {/* App Link */}
                        <div>
                          <label 
                            htmlFor="appLink"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "5px"
                            }}
                          >
                            Link to App
                          </label>
                          <input 
                            type="url"
                            id="appLink"
                            name="appLink"
                            value={formData.appLink}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              backgroundColor: "#fff"
                            }}
                            placeholder="https://yourapp.com"
                          />
                        </div>
                        
                        {/* GitHub Link */}
                        <div>
                          <label 
                            htmlFor="githubLink"
                            style={{
                              display: "block",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              marginBottom: "5px"
                            }}
                          >
                            Link to GitHub Repo
                          </label>
                          <input 
                            type="url"
                            id="githubLink"
                            name="githubLink"
                            value={formData.githubLink}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #8b6b4a",
                              fontFamily: "var(--font-m-plus-rounded)",
                              fontSize: "14px",
                              color: "#6c4a24",
                              backgroundColor: "#fff"
                            }}
                            placeholder="https://github.com/username/repo"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Add Hackatime section before the description */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "2px solid #8b6b4a",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                  }}>
                    <h3 style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "18px",
                      color: "#6c4a24",
                      margin: 0,
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 6v6l4 2M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#6c4a24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Hackatime Projects
                    </h3>
                    
                    <p style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "14px",
                      color: "#8b6b4a",
                      marginBottom: "16px"
                    }}>
                      Select the Hackatime projects that contributed to this app
                    </p>

                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}>
                      {loadingHackatime ? (
                        <div style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "#6c4a24",
                          fontFamily: "var(--font-m-plus-rounded)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          backgroundColor: "#f8f2e9",
                          borderRadius: "6px",
                          boxShadow: "0 2px 8px rgba(108, 74, 36, 0.05)",
                          border: "1px solid #d4b595"
                        }}>
                          <div style={{
                            width: "16px",
                            height: "16px",
                            border: "2px solid #8b6b4a",
                            borderRightColor: "transparent",
                            borderRadius: "50%",
                            animation: "hackatimeLoadingSpin 1s linear infinite"
                          }} />
                          Loading Hackatime projects...
                        </div>
                      ) : !userData?.slackId ? (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          alignItems: "center",
                          padding: "24px",
                          backgroundColor: "#f8f2e9",
                          borderRadius: "6px",
                          textAlign: "center",
                          boxShadow: "0 2px 8px rgba(108, 74, 36, 0.05)",
                          border: "1px solid #d4b595"
                        }}>
                          <p style={{
                            fontFamily: "var(--font-m-plus-rounded)",
                            fontSize: "16px",
                            color: "#6c4a24",
                            margin: 0,
                            fontWeight: "500"
                          }}>
                            Please connect your Slack account first to see your Hackatime projects
                          </p>
                        </div>
                      ) : hackatimeProjects.length > 0 ? (
                        <>
                          <div style={{
                            position: "relative",
                            marginBottom: "8px"
                          }}>
                            <input
                              type="text"
                              value={hackatimeSearch}
                              onChange={(e) => setHackatimeSearch(e.target.value)}
                              placeholder="Search projects..."
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                paddingLeft: "32px", // Space for the search icon
                                borderRadius: "6px",
                                border: "1px solid #8b6b4a",
                                fontFamily: "var(--font-m-plus-rounded)",
                                fontSize: "14px",
                                color: "#6c4a24",
                                backgroundColor: "#fff"
                              }}
                            />
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              style={{
                                position: "absolute",
                                left: "10px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "#8b6b4a"
                              }}
                            >
                              <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          
                          {hackatimeProjects
                            .filter(project => 
                              project.name.toLowerCase().includes(hackatimeSearch.toLowerCase())
                            )
                            .slice(0, showAllProjects ? undefined : 5)
                            .map(project => {
                              const isSelected = formData.hackatimeProjects.includes(project.name);
                              const isAttributedToOtherApp = project.isAttributed && 
                                project.attributedToAppId !== currentAppId && 
                                !project.isUserProject;
                              
                              return (
                                <div
                                  key={project.name}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "12px",
                                    backgroundColor: isSelected
                                      ? "#f8f2e9"
                                      : isAttributedToOtherApp
                                      ? "#f5f5f5"
                                      : "white",
                                    borderRadius: "8px",
                                    marginBottom: "8px",
                                    cursor: isAttributedToOtherApp
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity: isAttributedToOtherApp
                                      ? 0.7
                                      : 1,
                                    border: isSelected
                                      ? "1px solid #8b6b4a"
                                      : "1px solid #e0e0e0",
                                    transition: "all 0.2s",
                                    gap: "12px"
                                  }}
                                >
                                  <div 
                                    onClick={() => handleHackatimeProjectSelect(project)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      flex: "1"
                                    }}
                                  >
                                    <div style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "4px",
                                      border: "2px solid #8b6b4a",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor: isSelected ? "#8b6b4a" : "#fff",
                                      opacity: isAttributedToOtherApp ? 0.5 : 1,
                                      flexShrink: 0
                                    }}>
                                      {isSelected && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M20 6L9 17L4 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      )}
                                    </div>
                                    <div style={{
                                      flex: 1,
                                      overflow: "hidden"
                                    }}>
                                      <p style={{
                                        fontFamily: "var(--font-m-plus-rounded)",
                                        fontSize: "14px",
                                        color: project.isAttributed && project.attributedToAppId !== currentAppId ? "#8b6b4a" : "#6c4a24",
                                        margin: 0,
                                        fontWeight: "500",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px"
                                      }}>
                                        <span style={{
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap"
                                        }}>
                                          {project.name}
                                        </span>
                                        <span style={{
                                          fontSize: "14px",
                                          color: "#8b6b4a",
                                          fontWeight: "normal"
                                        }}>
                                          ({Math.floor(project.total_seconds / 3600)} hours {Math.round((project.total_seconds % 3600) / 60)} minutes)
                                        </span>
                                        {project.isAttributed && project.attributedToAppId !== currentAppId && (
                                          <span style={{
                                            fontSize: "12px",
                                            color: "#8b6b4a",
                                            fontStyle: "italic"
                                          }}>
                                            (Already attributed)
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Add GitHub URL input field */}
                                  {formData.hackatimeProjects.includes(project.name) && (
                                    <div style={{
                                      marginLeft: "auto",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      flex: "1",
                                      maxWidth: "500px"
                                    }}>
                                      <div style={{
                                        position: "relative",
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center"
                                      }}>
                                        <div style={{
                                          position: "absolute",
                                          left: "10px",
                                          display: "flex",
                                          alignItems: "center",
                                          pointerEvents: "none"
                                        }}>
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" fill="#8b6b4a"/>
                                          </svg>
                                        </div>
                                        <input
                                          type="url"
                                          placeholder="GitHub URL"
                                          value={formData.hackatimeProjectGithubLinks[project.name] || ''}
                                          onChange={(e) => {
                                            console.log("Updating GitHub link for project:", project.name);
                                            console.log("New value:", e.target.value);
                                            handleHackatimeProjectGithubLink(project.name, e.target.value);
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            console.log("Current GitHub links state:", formData.hackatimeProjectGithubLinks);
                                            console.log("Current value for", project.name, ":", formData.hackatimeProjectGithubLinks[project.name]);
                                          }}
                                          style={{
                                            padding: "8px 12px",
                                            paddingLeft: "34px", // Make room for the icon
                                            borderRadius: "6px",
                                            border: "1px solid #8b6b4a",
                                            fontFamily: "var(--font-m-plus-rounded)",
                                            fontSize: "14px",
                                            width: "100%",
                                            backgroundColor: "#fff",
                                            transition: "border-color 0.2s, box-shadow 0.2s",
                                            ":focus": {
                                              outline: "none",
                                              borderColor: "#6c4a24",
                                              boxShadow: "0 0 0 2px rgba(108, 74, 36, 0.1)"
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            
                          {hackatimeProjects.filter(project => 
                            project.name.toLowerCase().includes(hackatimeSearch.toLowerCase())
                          ).length > 5 && !showAllProjects && (
                            <button
                              onClick={() => setShowAllProjects(true)}
                              style={{
                                backgroundColor: "transparent",
                                color: "#8b6b4a",
                                border: "1px solid #8b6b4a",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                fontSize: "14px",
                                fontFamily: "var(--font-m-plus-rounded)",
                                cursor: "pointer",
                                marginTop: "8px",
                                transition: "all 0.2s",
                                alignSelf: "center"
                              }}
                            >
                              Show All Projects ({hackatimeProjects.filter(project => 
                                project.name.toLowerCase().includes(hackatimeSearch.toLowerCase())
                              ).length - 5} more)
                            </button>
                          )}
                          
                          {showAllProjects && hackatimeProjects.length > 5 && (
                            <button
                              onClick={() => setShowAllProjects(false)}
                              style={{
                                backgroundColor: "transparent",
                                color: "#8b6b4a",
                                border: "1px solid #8b6b4a",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                fontSize: "14px",
                                fontFamily: "var(--font-m-plus-rounded)",
                                cursor: "pointer",
                                marginTop: "8px",
                                transition: "all 0.2s",
                                alignSelf: "center"
                              }}
                            >
                              Show Less
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={{
                          backgroundColor: "#f8f2e9",
                          borderRadius: "6px",
                          padding: "32px",
                          boxShadow: "0 2px 8px rgba(108, 74, 36, 0.05)",
                          border: "1px solid #d4b595",
                          maxWidth: "800px",
                          margin: "0 auto",
                          position: "relative",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "3px",
                            background: "linear-gradient(90deg, #8b6b4a 0%, #d4b595 100%)",
                            opacity: 0.8
                          }} />
                          <div style={{
                            backgroundColor: "#fff",
                            borderRadius: "4px",
                            padding: "24px",
                            border: "1px solid rgba(108, 74, 36, 0.1)"
                          }}>
                            <DisconnectedHackatime
                              userData={userData}
                              setUserData={setUserData}
                              slackUsers={slackUsers}
                              setSlackUsers={setSlackUsers}
                              connectingSlack={connectingSlack}
                              setConnectingSlack={setConnectingSlack}
                              searchSlack={searchSlack}
                              setSearchSlack={setSearchSlack}
                              setUIPage={setUIPage}
                              setIsSettingEmail={() => {}}
                              setEmail={() => {}}
                              setEmailCode={() => {}}
                              setEmailChangeValid={() => {}}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Bottom section: Description */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "2px solid #8b6b4a",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                  }}>
                    <h3 style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "18px",
                      color: "#6c4a24",
                      margin: 0,
                      marginBottom: "16px"
                    }}>
                      App Description
                    </h3>
                    
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      style={{
                        width: "100%",
                        minHeight: "200px",
                        padding: "12px",
                        borderRadius: "6px",
                        border: "1px solid #8b6b4a",
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontSize: "14px",
                        color: "#6c4a24",
                        backgroundColor: "#fff",
                        resize: "vertical"
                      }}
                      placeholder="Describe your app, what it does, who it's for, and any other relevant details..."
                    />
                  </div>
                  
                  {/* Submit button with loading state */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "10px"
                  }}>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        backgroundColor: submitting ? "#b0987d" : "#8b6b4a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "12px 24px",
                        fontSize: "16px",
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontWeight: "bold",
                        cursor: submitting ? "not-allowed" : "pointer",
                        transition: "background-color 0.2s",
                        minWidth: "200px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px"
                      }}
                    >
                      {submitting ? (
                        <>
                          <span style={{ 
                            display: "inline-block", 
                            width: "18px", 
                            height: "18px", 
                            borderRadius: "50%", 
                            border: "3px solid #fff", 
                            borderTopColor: "transparent", 
                            animation: "spin 1s linear infinite" 
                          }}></span>
                          <span>{isEditing ? "Updating..." : "Creating..."}</span>
                        </>
                      ) : (
                        isEditing ? "Update App" : "Create App"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : showJoinForm ? (
            <div style={{
              width: "100%",
              maxWidth: "1000px"
            }}>
              <div style={{
                marginBottom: "20px"
              }}>
                <input 
                  type="text"
                  placeholder="Search for apps by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "2px solid #8b6b4a",
                    fontFamily: "var(--font-m-plus-rounded)",
                    fontSize: "16px",
                    color: "#6c4a24",
                    backgroundColor: "#fff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                  }}
                />
              </div>
              
              {getFilteredApps().length === 0 ? (
                <div style={{
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  padding: "30px",
                  border: "2px solid #8b6b4a",
                  textAlign: "center",
                  marginTop: "20px"
                }}>
                  <p style={{
                    fontFamily: "var(--font-m-plus-rounded)",
                    fontSize: "18px",
                    color: "#6c4a24"
                  }}>
                    {availableApps.length === 0 
                      ? "No apps available to join right now." 
                      : "No apps match your search."}
                  </p>
                  {availableApps.length === 0 && (
                    <button
                      onClick={() => {
                        setShowJoinForm(false);
                        setShowCreateForm(true);
                      }}
                      style={{
                        backgroundColor: "#8b6b4a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 20px",
                        fontSize: "16px",
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontWeight: "bold",
                        cursor: "pointer",
                        marginTop: "15px"
                      }}
                    >
                      Create Your Own App
                    </button>
                  )}
                </div>
              ) : (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px"
                }}>
                  {getFilteredApps().map(app => (
                    <div 
                      key={app.id} 
                      onClick={() => joinApp(app.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        backgroundColor: "#fff",
                        borderRadius: "12px",
                        padding: "20px",
                        border: "2px solid #8b6b4a",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        cursor: joiningApp ? "not-allowed" : "pointer",
                        opacity: joiningApp ? 0.7 : 1,
                        pointerEvents: joiningApp ? "none" : "auto",
                        ":hover": {
                          transform: "translateY(-4px)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                        }
                      }}>
                      <div style={{
                        width: "72px",
                        height: "72px",
                        backgroundColor: "#f1f5f9",
                        borderRadius: "12px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: "16px",
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
                            width: "40px",
                            height: "40px",
                            backgroundColor: getSuggestedAppIcon(app.name),
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            color: "#fff",
                            fontSize: "20px",
                            fontWeight: "bold"
                          }}>
                            {app.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p style={{
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontSize: "14px",
                        fontWeight: "500",
                        margin: 0,
                        textAlign: "center",
                        color: "#6c4a24",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {app.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : apps.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "400px",
              gap: "40px"
            }}>
              <div style={{
                textAlign: "center",
                marginBottom: "20px"
              }}>
                <h2 style={{
                  fontFamily: "var(--font-m-plus-rounded)",
                  fontSize: "28px",
                  color: "#6c4a24",
                  marginBottom: "16px"
                }}>You don't have any apps yet</h2>
                <p style={{
                  fontFamily: "var(--font-m-plus-rounded)",
                  fontSize: "18px",
                  color: "#8b6b4a"
                }}>Get started by creating a new app or joining an existing one</p>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "center", 
                  gap: "10px", 
                  marginTop: "20px" 
                }}>
                  <button
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      // Force refresh the apps
                      const fetchApps = async () => {
                        try {
                          let token = localStorage.getItem('neighborhoodToken');
                          if (!token) {
                            token = getToken();
                          }
                          
                          if (!token) {
                            throw new Error("No token found");
                          }
                          
                          const response = await fetch(`/api/getUserApps?token=${token}`);
                          const data = await response.json();
                          
                          if (!response.ok) {
                            throw new Error(data.message || "Failed to fetch apps");
                          }
                          
                          const sortedApps = [...(data.apps || [])].sort((a, b) => {
                            if (!a.createdAt) return 1;
                            if (!b.createdAt) return -1;
                            return new Date(b.createdAt) - new Date(a.createdAt);
                          });
                          
                          setApps(sortedApps);
                        } catch (err) {
                          console.error("Error refreshing apps:", err);
                          setError(err.message || "Failed to refresh apps");
                        } finally {
                          setLoading(false);
                        }
                      };
                      
                      fetchApps();
                    }}
                    style={{
                      backgroundColor: "#fff",
                      color: "#8b6b4a",
                      border: "2px solid #8b6b4a",
                      borderRadius: "8px",
                      padding: "10px 20px",
                      fontSize: "14px",
                      fontFamily: "var(--font-m-plus-rounded)",
                      cursor: "pointer"
                    }}
                  >
                    Refresh Apps List
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        let token = localStorage.getItem('neighborhoodToken');
                        if (!token) {
                          token = getToken();
                        }
                        
                        if (!token) {
                          throw new Error("No token found");
                        }
                        
                        // Attempt to fix app assignments
                        const fixResponse = await fetch('/api/fixUserApps', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ token }),
                        });
                        
                        const fixData = await fixResponse.json();
                        
                        if (!fixResponse.ok) {
                          throw new Error(fixData.message || "Failed to fix app assignments");
                        }
                        
                        // If apps were fixed, show success message and refresh
                        if (fixData.apps && fixData.apps.length > 0) {
                          alert(`Successfully recovered ${fixData.apps.length} app(s). Refreshing list...`);
                          
                          // Refresh the apps list
                          const response = await fetch(`/api/getUserApps?token=${token}`);
                          const data = await response.json();
                          
                          if (!response.ok) {
                            throw new Error(data.message || "Failed to fetch apps");
                          }
                          
                          const sortedApps = [...(data.apps || [])].sort((a, b) => {
                            if (!a.createdAt) return 1;
                            if (!b.createdAt) return -1;
                            return new Date(b.createdAt) - new Date(a.createdAt);
                          });
                          
                          setApps(sortedApps);
                        } else {
                          alert(fixData.message || "No unassigned apps found");
                        }
                      } catch (err) {
                        console.error("Error fixing apps:", err);
                        alert(err.message || "Failed to fix app assignments");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{
                      backgroundColor: "#8b6b4a",
                      color: "#fff",
                      border: "2px solid #8b6b4a",
                      borderRadius: "8px",
                      padding: "10px 20px",
                      fontSize: "14px",
                      fontFamily: "var(--font-m-plus-rounded)",
                      cursor: "pointer"
                    }}
                  >
                    Recover Missing Apps
                  </button>
                </div>
              </div>
              
              <div style={{
                display: "flex",
                gap: "30px",
                justifyContent: "center"
              }}>
                <button
                  onClick={handleCreateApp}
                  style={{
                    backgroundColor: "#8b6b4a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "16px 24px",
                    fontSize: "18px",
                    fontFamily: "var(--font-m-plus-rounded)",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "transform 0.2s, background-color 0.2s",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px"
                  }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Create New App
                </button>
                
                <button
                  onClick={handleJoinApp}
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#8b6b4a",
                    border: "2px solid #8b6b4a",
                    borderRadius: "12px",
                    padding: "16px 24px",
                    fontSize: "18px",
                    fontFamily: "var(--font-m-plus-rounded)",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "transform 0.2s, background-color 0.2s",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px"
                  }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="#8b6b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Join Existing App
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              width: "100%"
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gridGap: "24px",
                width: "100%"
              }}>
                {apps.slice(0, visibleApps).map(app => (
                  <div 
                    key={app.id} 
                    onClick={() => handleAppClick(app)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      backgroundColor: "#fff",
                      borderRadius: "12px",
                      padding: "20px",
                      border: "2px solid #8b6b4a",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      cursor: "pointer",
                      position: "relative", // Added for absolute positioning of leave button
                      ":hover": {
                        transform: "translateY(-4px)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                      }
                    }}>
                    {/* Leave button */}
                    <button
                      onClick={(e) => leaveApp(app.id, e)}
                      disabled={leavingApp}
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        backgroundColor: "#fff",
                        color: "#8b6b4a",
                        border: "1px solid #8b6b4a",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontFamily: "var(--font-m-plus-rounded)",
                        fontWeight: "500",
                        cursor: leavingApp ? "not-allowed" : "pointer",
                        opacity: leavingApp ? 0.5 : 1,
                        transition: "all 0.2s ease",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        boxShadow: "0 1px 2px rgba(139, 107, 74, 0.1)",
                        ":hover": {
                          backgroundColor: "#8b6b4a",
                          color: "#fff"
                        }
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Leave
                    </button>
                    <div style={{
                      width: "72px",
                      height: "72px",
                      backgroundColor: "#f1f5f9",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: "16px",
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
                          width: "40px",
                          height: "40px",
                          backgroundColor: getSuggestedAppIcon(app.name),
                          borderRadius: "8px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          color: "#fff",
                          fontSize: "20px",
                          fontWeight: "bold"
                        }}>
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p style={{
                      fontFamily: "var(--font-m-plus-rounded)",
                      fontSize: "14px",
                      fontWeight: "500",
                      margin: 0,
                      textAlign: "center",
                      color: "#6c4a24",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {app.name}
                    </p>
                  </div>
                ))}
              </div>
              
              {visibleApps < apps.length && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
                  <button 
                    onClick={loadMoreApps}
                    style={{
                      backgroundColor: "#8b6b4a",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px 20px",
                      fontSize: "16px",
                      fontFamily: "var(--font-m-plus-rounded)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                      ":hover": {
                        backgroundColor: "#75593e"
                      }
                    }}
                  >
                    Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AppsComponent; 