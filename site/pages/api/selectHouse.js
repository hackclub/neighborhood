import Airtable from 'airtable';
import { cleanString } from "../../lib/airtable.js";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get token from Authorization header
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Get house from request body
  const { house } = req.body;
  
  if (!house) {
    return res.status(400).json({ message: 'House is required' });
  }

  const cleanedToken = cleanString(token);
  const cleanedHouse = cleanString(house);

  if (!cleanedToken) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (!cleanedHouse) {
    return res.status(400).json({ message: 'Invalid house value' });
  }

  // Validate house value
  const validHouses = ['Sunset', 'Mission', 'Lower Haight'];
  if (!validHouses.includes(cleanedHouse)) {
    return res.status(400).json({ message: 'Invalid house. Must be one of: Sunset, Mission, Lower Haight' });
  }

  try {
    // Find the user with this token
    console.log('Looking up user with token:', cleanedToken.substring(0, 5) + '...');
    const userRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${cleanedToken}'`,
        maxRecords: 1
      })
      .firstPage();

    if (userRecords.length === 0) {
      console.log('No user found for token:', cleanedToken.substring(0, 5) + '...');
      return res.status(404).json({ message: 'User not found' });
    }

    const userRecord = userRecords[0];
    
    // Update the user's house
    await base("neighbors").update([
      {
        id: userRecord.id,
        fields: {
          House: cleanedHouse
        }
      }
    ]);

    return res.status(200).json({
      message: 'House selected successfully',
      house: cleanedHouse
    });

  } catch (error) {
    console.error('Error selecting house:', error);
    return res.status(500).json({ 
      message: 'Error selecting house',
      error: error.message 
    });
  }
} 