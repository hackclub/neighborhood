const cron = require('node-cron');
const fetch = require('node-fetch');

// Function to check for unlogged time
async function checkUnloggedTime() {
    console.log('Checking All Projects For Unlogged Time');
    
    try {
        const response = await fetch('http://adventure-time.hackclub.dev/api/getNeighborsSecurely');
        const data = await response.json();
        
        console.log('\nProcessing Slack IDs and their unlogged time:');
        for (const neighbor of data.neighbors) {
            // Skip users who have hideJakeTheDog set to true
            if (neighbor.hideJakeTheDog === true) {
                console.log(`Skipping Slack ID: ${neighbor.slackId?.[0] || 'unknown'} - hideJakeTheDog is true`);
                continue;
            }

            if (neighbor.slackId && neighbor.slackId.length > 0) {
                const slackId = neighbor.slackId[0];
                try {
                    const unloggedRes = await fetch(`http://adventure-time.hackclub.dev/api/getUnloggedTimeForUser?slackId=${encodeURIComponent(slackId)}`);
                    const unloggedData = await unloggedRes.json();
                    if (unloggedData.apps) {
                        for (const [appName, appData] of Object.entries(unloggedData.apps)) {
                            const hours = parseFloat(appData.unloggedHours);
                            if (hours >= 3) {
                                console.log(`Slack ID: ${slackId}, App: ${appName}, Unlogged Hours: ${hours}`);
                                // Send POST request to create unlogged DM
                                const dmResponse = await fetch('http://adventure-time.hackclub.dev/api/createUnloggedDm', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        slackID: slackId,
                                        unloggedTime: hours,
                                        projectName: appName
                                    })
                                });
                                const dmData = await dmResponse.json();
                                console.log(`DM Response for ${slackId}:`, dmData);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching unlogged time for Slack ID ${slackId}:`, err.message);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching neighbors:', error.message);
    }
}

// Run immediately on start
checkUnloggedTime();

// // Schedule to run every hour
// cron.schedule('0 * * * *', () => {
//     checkUnloggedTime();
// });

console.log('Time checking service started. Will run every hour.');
