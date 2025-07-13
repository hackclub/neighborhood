import Airtable from 'airtable';
import { cleanString } from "../../lib/airtable.js";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const cleanedEmail = cleanString(email);

  try {
    // Add the email to the RSVP table
    await base('RSVP').create([
      { fields: { Email: cleanedEmail } }
    ]);
    return res.status(200).json({ message: 'RSVP recorded' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record RSVP', error: error.message });
  }
} 