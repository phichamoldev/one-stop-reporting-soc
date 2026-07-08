export interface LineNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a message using the LINE Messaging API.
 * Uses the push endpoint to send a notification to a specific group.
 * 
 * @param message The text message to send
 * @returns An object containing the success status and any error message
 */
export async function notifyLine(message: string): Promise<LineNotificationResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = process.env.LINE_GROUP_ID;
  
  if (!token) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not defined in the environment variables.");
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  if (!groupId) {
    console.warn("LINE_GROUP_ID is not defined in the environment variables.");
    return { success: false, error: "LINE_GROUP_ID is missing" };
  }

  console.log("GROUP ID:", groupId);

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: groupId,
        messages: [
          {
            type: "text",
            text: message
          }
        ]
      })
    });

    const responseText = await response.text();
    
    console.log("LINE STATUS:", response.status);
    console.log("LINE RESPONSE:", responseText);

    if (!response.ok) {
      console.error("LINE API Error:", responseText);
      return { 
        success: false, 
        error: `LINE API responded with status ${response.status}: ${responseText}`
      };
    }

    return { success: true };
    
  } catch (error) {
    console.error("Failed to send LINE notification:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    };
  }
}
