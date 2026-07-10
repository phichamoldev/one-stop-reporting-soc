export interface LineNotificationResult {
  success: boolean;
  error?: string;
}

export interface LineNotificationPayload {
  publicId: string;
  categoryName: string;
  subcategoryName: string;
  description: string;
  location: string;
  date: string;
  statusText?: string;
  reporterName?: string;
}

/**
 * Sends a message using the LINE Messaging API.
 * Uses the push endpoint to send a notification to a specific group.
 * 
 * @param message The text message to send or a payload for a flex message
 * @returns An object containing the success status and any error message
 */
export async function notifyLine(message: string | LineNotificationPayload, customGroupId?: string | null): Promise<LineNotificationResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = customGroupId || process.env.LINE_DEFAULT_GROUP_ID || process.env.LINE_GROUP_ID;

  if (!token) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not defined in the environment variables.");
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  if (!groupId) {
    console.warn("LINE_GROUP_ID is not defined in the environment variables.");
    return { success: false, error: "LINE_GROUP_ID is missing" };
  }

  console.log("GROUP ID:", groupId);

  let lineMessages: any[] = [];

  if (typeof message === "string") {
    lineMessages = [
      {
        type: "text",
        text: message
      }
    ];
  } else {
    let mappedStatus = "🟡 รอรับเรื่อง";
    const statusText = message.statusText || "pending";

    if (statusText === "pending" || statusText.includes("รอรับเรื่อง")) {
      mappedStatus = "🟡 รอรับเรื่อง";
    }
    else if (statusText === "in_progress" || statusText.includes("กำลังดำเนินการ")) {
      mappedStatus = "🔵 กำลังดำเนินการ";
    }
    else if (statusText === "resolved" || statusText.includes("เสร็จสิ้น")) {
      mappedStatus = "🟢 ดำเนินการเสร็จสิ้น";
    }
    else if (statusText === "rejected" || statusText.includes("ปฏิเสธ")) {
      mappedStatus = "🔴 ปฏิเสธคำร้อง";
    }
    else if (statusText === "cancelled" || statusText.includes("ยกเลิก")) {
      mappedStatus = "⚫ ยกเลิกคำร้อง";
    }

    lineMessages = [
      {
        type: "flex",
        altText: `🔔 มีคำร้องใหม่: ${message.publicId}`,
        contents: {
          type: "bubble",
          size: "kilo",
          header: {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            paddingTop: "12px",
            paddingEnd: "12px",
            paddingBottom: "0px",
            paddingStart: "12px",
            contents: [
              {
                type: "text",
                text: "ONE STOP SERVICE",
                color: "#D1350F",
                weight: "bold",
                size: "md",
              }
            ]
          },
          body: {
            type: "box",
            layout: "vertical",
            paddingTop: "12px",
            paddingEnd: "12px",
            paddingBottom: "0px",
            paddingStart: "12px",
            contents: [
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                contents: [
                  { type: "text", text: "เลขอ้างอิง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: message.publicId, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "หมวดหมู่", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: `${message.categoryName}\n-\n${message.subcategoryName}`, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "เรื่องที่แจ้ง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: message.description, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "สถานที่", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: message.location, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "ผู้แจ้ง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: message.reporterName || "-", color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "วันที่แจ้ง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: message.date, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "20px",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#D1350F",
                action: {
                  type: "uri",
                  label: "ดูรายละเอียดเพิ่มเติม",
                  uri: `${process.env.NEXT_PUBLIC_APP_URL || "https://supportsoc.vercel.app"}/report/${message.publicId}`
                }
              }
            ]
          }
        }
      }
    ];
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: groupId,
        messages: lineMessages
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
