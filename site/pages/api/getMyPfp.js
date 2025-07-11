import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get token from Authorization header or query parameter
  let token = req.headers.authorization?.split(' ')[1] || req.query.token;
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Check token with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;

  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  try {
    // Find the user with this token
    console.log('Looking up user with token:', token.substring(0, 5) + '...');
    const userRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1
      })
      .firstPage();

    if (userRecords.length === 0) {
      console.log('No user found for token:', token.substring(0, 5) + '...');
      return res.status(404).json({ message: 'User not found' });
    }

    const userRecord = userRecords[0];
    const userFields = userRecord.fields;
    
    // Get profile picture from Pfp field
    let profilePicture = null;
    if (userFields.Pfp && userFields.Pfp.length > 0) {
      profilePicture = userFields.Pfp[0].url;
    }
    
    // Check if user has Slack information
    const email = userFields.email;
    let slackId = null;
    
    if (email) {
      const slackRecords = await base("#neighborhoodSlackMembers")
        .select({
          filterByFormula: `{Email} = '${email}'`,
          maxRecords: 1
        })
        .firstPage();
        
      if (slackRecords.length > 0) {
        slackId = slackRecords[0].fields['Slack ID'] || null;
        
        // If no profile picture from neighbors table, try to get it from slack members table
        if (!profilePicture && slackRecords[0].fields.Pfp && slackRecords[0].fields.Pfp.length > 0) {
          profilePicture = slackRecords[0].fields.Pfp[0].url;
        }
      }
    }

    return res.status(200).json({
      profilePicture,
      slackId,
      name: userFields.name || null
    });

  } catch (error) {
    console.error('Error fetching profile picture:', error);
    return res.status(500).json({ 
      message: 'Error fetching profile picture',
      error: error.message 
    });
  }
} 