export interface LineNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a message using the LINE Messaging API.
 * Uses the broadcast endpoint by default to send a notification.
 * 
 * @param message The text message to send
 * @returns An object containing the success status and any error message
 */
export async function notifyLine(message: string): Promise<LineNotificationResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!token) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not defined in the environment variables.");
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: [
          {
            type: "text",
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("LINE API Error:", errorData);
      return { 
        success: false, 
        error: `LINE API responded with status ${response.status}: ${JSON.stringify(errorData)}`
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
