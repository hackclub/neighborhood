import { WebClient } from "@slack/web-api";
import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");

  // Handle OPTIONS request for CORS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];

  // validate the token with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    // First, get the user's email from Airtable using their token
    console.log("Looking up user with token:", token.substring(0, 5) + "...");
    const userRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 10, // Increased to detect duplicates
      })
      .firstPage();

    if (userRecords.length === 0) {
      // If no user found with token, try finding by email to detect duplicates
      const email = req.query.email; // You'll need to pass email in the request
      if (email) {
        const allUserRecords = await base("neighbors")
          .select({
            filterByFormula: `{email} = '${email}'`,
            maxRecords: 10,
          })
          .firstPage();

        if (allUserRecords.length > 1) {
          console.log("Found duplicate user records:", {
            email,
            count: allUserRecords.length,
            records: allUserRecords.map((r) => ({
              id: r.id,
              hasToken: !!r.fields.token,
              tokenMatch: r.fields.token === token,
            })),
          });
        }
      }

      // No user found with this token
      console.log("No user found for token:", token.substring(0, 5) + "...");
      return res.status(403).json({
        message: "User not found",
        shouldLogout: true,
      });
    }

    if (userRecords.length > 1) {
      console.log("Warning: Multiple user records found with same token:", {
        count: userRecords.length,
        records: userRecords.map((r) => ({
          id: r.id,
          email: r.fields.email,
          hasToken: !!r.fields.token,
        })),
      });
    }

    // Select the record with the most complete data
    const userRecord = userRecords.reduce((best, current) => {
      const bestScore =
        (best.fields.token ? 1 : 0) +
        (best.fields.email ? 1 : 0) +
        (best.fields.name ? 1 : 0);
      const currentScore =
        (current.fields.token ? 1 : 0) +
        (current.fields.email ? 1 : 0) +
        (current.fields.name ? 1 : 0);
      return currentScore > bestScore ? current : best;
    }, userRecords[0]);

    console.log("Selected user record:", {
      id: userRecord.id,
      email: userRecord.fields.email,
      hasToken: !!userRecord.fields.token,
      tokenMatch: userRecord.fields.token === token,
      totalRecordsFound: userRecords.length,
    });

    const userFields = userRecord.fields;
    const userId = userRecord.id;

    // Extract all relevant user data
    const userData = {
      email: userFields.email,
      name: userFields.name || "",
      profilePicture: userFields.profilePicture || "",
      githubUsername: userFields.githubUsername || "",
      birthday: userFields.birthday || "",
      hasProfilePic: !!userFields.profilePicture,
      country: userFields.country || "",
      hasVisa: !!userFields.hasVisa,
      // Add time-related fields
      totalTimeHackatimeHours: userFields.totalTimeHackatimeHours || 0,
      totalTimeStopwatchHours: userFields.totalTimeStopwatchHours || 0,
      totalTimeCombinedHours: userFields.totalTimeCombinedHours || 0,
      moveInDate: userFields["move-in-date"] || "",
      moveOutDate: userFields["move-out-date"] || "",
      gender: userFields["RoomGender"] || "",
      totalCheckedTime: userFields.totalCheckedTime || 0,
    };

    // Get hackatime projects for this user
    const hackatimeProjects = await base("hackatimeProjects")
      .select({
        filterByFormula: `{email} = '${userData.email}'`,
        fields: ["name", "githubLink"],
      })
      .all();

    userData.hackatimeProjects = hackatimeProjects.map((record) => ({
      id: record.id,
      ...record.fields,
    }));

    // Get the user's Slack profile using the bot token
    const web = new WebClient(process.env.SLACK_BOT_TOKEN);

    let slack_id = null;
    let real_name = userData.name;
    let image_72 = userData.profilePicture;
    let display_name = userData.name;

    // Check if user already has Slack information in Airtable
    const existingSlackRecords = await base("#neighborhoodSlackMembers")
      .select({
        filterByFormula: `{Email} = '${userData.email}'`,
        maxRecords: 1,
      })
      .firstPage();

    console.log("Found Slack records:", {
      count: existingSlackRecords.length,
      email: userData.email,
      fields: existingSlackRecords[0]?.fields,
      recordId: existingSlackRecords[0]?.id,
    });

    if (existingSlackRecords.length > 0) {
      const slackRecord = existingSlackRecords[0].fields;
      slack_id = slackRecord["Slack ID"];
      console.log("Found existing Slack ID:", slack_id);
    }

    // If we have a Slack ID, use that to get fresh info from Slack
    if (slack_id) {
      console.log("Fetching Slack info using ID:", slack_id);
      try {
        const userInfo = await web.users.info({
          user: slack_id,
        });
        console.log("Slack API response:", {
          ok: userInfo.ok,
          user: userInfo.user
            ? {
                id: userInfo.user.id,
                real_name: userInfo.user.real_name,
                display_name: userInfo.user.profile?.display_name,
                has_image: !!userInfo.user.profile?.image_72,
              }
            : null,
        });

        if (userInfo.ok && userInfo.user) {
          const { profile, id } = userInfo.user;
          real_name = profile.real_name || real_name;
          image_72 = profile.image_72 || image_72;
          // Use display_name if set, otherwise fall back to real_name
          display_name = profile.display_name || profile.real_name || real_name;

          console.log("Updated Slack info from ID:", {
            slack_id,
            display_name,
            real_name,
            has_image: !!image_72,
            using_real_name_as_handle: !profile.display_name,
          });

          // Update the Slack member record with fresh data
          if (existingSlackRecords.length > 0) {
            await base("#neighborhoodSlackMembers").update([
              {
                id: existingSlackRecords[0].id,
                fields: {
                  Email: userData.email,
                  "Slack ID": slack_id,
                  "Slack Handle": display_name,
                  "Full Name": real_name,
                  Pfp: image_72 ? [{ url: image_72 }] : undefined,
                  neighbors: existingSlackRecords[0].fields.neighbors || [
                    userId,
                  ],
                },
              },
            ]);
            console.log("Updated Slack member record with fresh data");
          }
        } else {
          console.log("Slack API response was not ok or user was null");
        }
      } catch (error) {
        console.error("Error fetching Slack info by ID:", {
          error: error.message,
          data: error.data,
          code: error.code,
        });
      }
    }
    // Only try email lookup if we don't have a Slack ID
    else {
      console.log(
        "No Slack ID found, attempting email lookup for:",
        userData.email,
      );
      try {
        const users = await web.users.lookupByEmail({
          email: userData.email,
        });
        console.log("Email lookup response:", {
          ok: users.ok,
          user: users.user
            ? {
                id: users.user.id,
                real_name: users.user.real_name,
                display_name: users.user.profile?.display_name,
                has_image: !!users.user.profile?.image_72,
              }
            : null,
        });

        if (users.ok && users.user) {
          const { profile, id } = users.user;
          slack_id = id;
          real_name = profile.real_name || real_name;
          image_72 = profile.image_72 || image_72;
          // Use display_name if set, otherwise fall back to real_name
          display_name =
            profile.display_name || profile.real_name || display_name;

          console.log("Found Slack info by email:", {
            slack_id,
            display_name,
            real_name,
            has_image: !!image_72,
            using_real_name_as_handle: !profile.display_name,
          });
        }
      } catch (error) {
        if (error.data?.error === "users_not_found") {
          console.log(
            "User not found in Slack workspace for email:",
            userData.email,
          );
        } else {
          console.error("Error looking up by email:", {
            error: error.message,
            data: error.data,
            code: error.code,
          });
        }
      }
    }

    // Now find and join the channel
    let channelList;
    try {
      console.log("Starting channel operations");

      // First, get the bot's own info
      const botInfo = await web.auth.test();
      console.log("Bot info retrieved:", { botId: botInfo.user_id });

      try {
        // Try to get channels using users.conversations
        const userChannels = await web.users.conversations({
          user: botInfo.user_id,
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 1000,
        });

        // Also try the regular conversations.list
        const allChannels = await web.conversations.list({
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 1000,
        });

        // Combine both lists
        channelList = {
          channels: [
            ...new Set([...userChannels.channels, ...allChannels.channels]),
          ],
        };
      } catch (channelError) {
        console.error("Error fetching channels:", channelError);
        channelList = { channels: [] };
      }

      // Try different possible channel names
      const possibleNames = [
        "neighborhood",
        "neighbourhood",
        "neighborhoods",
        "neighbourhoods",
      ];
      let foundChannel = null;

      for (const name of possibleNames) {
        foundChannel = channelList.channels.find(
          (channel) => channel.name.toLowerCase() === name.toLowerCase(),
        );
        if (foundChannel) {
          console.log("Found matching channel:", foundChannel.name);
          break;
        }
      }

      if (foundChannel) {
        try {
          // First try to join the channel if we're not already a member
          if (!foundChannel.is_member) {
            console.log("Bot joining channel");
            await web.conversations.join({
              channel: foundChannel.id,
            });
          }

          // Only try to invite the user if we have their slack_id
          if (slack_id) {
            try {
              console.log("Attempting to invite user to channel");
              await web.conversations.invite({
                channel: foundChannel.id,
                users: slack_id,
              });
            } catch (inviteError) {
              console.log("Invite result:", inviteError.data?.error);
              if (inviteError.data?.error === "user_is_restricted") {
                try {
                  // Get the channel link
                  const channelInfo = await web.conversations.info({
                    channel: foundChannel.id,
                  });

                  // Send DM to user
                  await web.chat.postMessage({
                    channel: slack_id,
                    text: `Welcome to the neighborhood! You can join our main channel here: ${channelInfo.channel.url}`,
                  });
                } catch (dmError) {
                  console.error("Error sending DM:", dmError);
                }
              } else if (inviteError.data?.error === "already_in_channel") {
                console.log("User already in channel");
              } else {
                console.error("Unknown invite error:", inviteError);
              }
            }
          }
        } catch (channelError) {
          console.error("Error in channel operations:", channelError);
        }
      }

      // Update or create record in #neighborhoodSlackMembers table
      try {
        console.log("Updating Slack member record");
        // Only proceed if we have at least the user ID and some meaningful data
        if (userId && (slack_id || display_name || real_name || image_72)) {
          // Check if a record already exists for this user
          const existingRecords = await base("#neighborhoodSlackMembers")
            .select({
              filterByFormula: `{Email} = '${userData.email}'`,
              maxRecords: 1,
            })
            .firstPage();

          let record;
          if (existingRecords.length > 0) {
            // Get current neighbors to preserve them
            const currentNeighbors = existingRecords[0].fields.neighbors || [];

            // Update existing record
            record = await base("#neighborhoodSlackMembers").update([
              {
                id: existingRecords[0].id,
                fields: {
                  Email: userData.email,
                  "Slack ID": slack_id,
                  "Slack Handle": display_name,
                  "Full Name": real_name,
                  Pfp: image_72 ? [{ url: image_72 }] : undefined,
                  neighbors: currentNeighbors.includes(userId)
                    ? currentNeighbors
                    : [...currentNeighbors, userId],
                },
              },
            ]);
            console.log("Updated existing Slack member record");
          } else {
            // Create new record
            record = await base("#neighborhoodSlackMembers").create([
              {
                fields: {
                  Email: userData.email,
                  "Slack ID": slack_id,
                  "Slack Handle": display_name,
                  "Full Name": real_name,
                  Pfp: image_72 ? [{ url: image_72 }] : undefined,
                  neighbors: [userId],
                },
              },
            ]);
            console.log("Created new Slack member record");
          }
        }
      } catch (error) {
        console.error("Error updating Slack member record:", error);
      }

      console.log("Preparing final response");
      return res.status(200).json({
        id: userId,
        name: real_name,
        profilePicture: image_72,
        slackId: slack_id,
        slackHandle: display_name,
        email: userData.email,
        githubUsername: userData.githubUsername,
        birthday: userData.birthday,
        hasProfilePic: userData.hasProfilePic,
        hackatimeProjects: userData.hackatimeProjects,
        country: userData.country,
        hasVisa: userData.hasVisa,
        // Add time-related fields to response
        totalTimeHackatimeHours: userData.totalTimeHackatimeHours,
        totalTimeStopwatchHours: userData.totalTimeStopwatchHours,
        totalTimeCombinedHours: userData.totalTimeCombinedHours,
        moveInDate: userData.moveInDate,
        moveOutDate: userData.moveOutDate,
        gender: userData.gender,
        totalCheckedTime: userData.totalCheckedTime,
      });
    } catch (error) {
      console.error("Error in channel operations:", error);
      if (
        error.code === "slack_webapi_platform_error" &&
        error.data?.error === "missing_scope"
      ) {
        console.log("Slack scope error:", {
          error: error.data?.error,
          needed_scopes: error.data?.needed || "unknown",
          provided_scopes: error.data?.provided || "unknown",
        });
        return res.status(403).json({
          message: "Missing required Slack scopes",
          error:
            "The Slack app needs the following scopes: users:read.email, users:read, channels:read, channels:join, channels:manage, groups:read",
          shouldLogout: false,
        });
      }

      // Instead of throwing, return what we have so far
      return res.status(200).json({
        id: userId,
        name: real_name,
        profilePicture: image_72,
        slackId: slack_id,
        slackHandle: display_name,
        email: userData.email,
        githubUsername: userData.githubUsername,
        birthday: userData.birthday,
        hasProfilePic: userData.hasProfilePic,
        hackatimeProjects: userData.hackatimeProjects,
        country: userData.country,
        hasVisa: userData.hasVisa,
        // Add time-related fields here too
        totalTimeHackatimeHours: userData.totalTimeHackatimeHours,
        totalTimeStopwatchHours: userData.totalTimeStopwatchHours,
        totalTimeCombinedHours: userData.totalTimeCombinedHours,
        moveInDate: userData.moveInDate,
        moveOutDate: userData.moveOutDate,
        gender: userData.gender,
        totalCheckedTime: userData.totalCheckedTime,
      });
    }
  } catch (error) {
    console.error("Fatal error in get-user-data:", error);
    return res.status(500).json({
      message: "Error fetching user data",
      error: error.message,
    });
  }
}
