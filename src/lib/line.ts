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

  let lineMessages: any[] = [
    {
      type: "text",
      text: message
    }
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    "academic": "วิชาการและการเรียนการสอน",
    "student": "นักศึกษาและกิจกรรมนิสิต",
    "staff": "อาจารย์และบุคลากร",
    "building": "อาคารและสถานที่",
    "utilities": "สาธารณูปโภค (ไฟฟ้า ประปา แอร์)",
    "it": "เทคโนโลยีสารสนเทศ (IT)",
    "environment": "ความสะอาด สิ่งแวดล้อม และความปลอดภัย",
    "general": "ร้องเรียน ข้อเสนอแนะ และเรื่องทั่วไป"
  };

  if (message.includes("เลขอ้างอิง:")) {
    const publicId = message.match(/เลขอ้างอิง:\s*(.*?)(?=\n\n|$)/)?.[1] || "-";
    const rawCategory = message.match(/หมวดหมู่:\s*(.*?)(?=\n\n|$)/)?.[1] || "-";
    const categoryLabel = CATEGORY_LABELS[rawCategory] || rawCategory;

    const description = message.match(/หัวข้อ:\s*([\s\S]*?)(?=\n\nสถานที่:|$)/)?.[1] || "-";
    const location = message.match(/สถานที่:\s*(.*?)(?=\n\n|$)/)?.[1] || "-";
    const date = message.match(/วันที่แจ้ง:\s*(.*?)(?=\n\n|$)/)?.[1] || "-";

    const statusText = message.match(/สถานะ:\s*(.*?)(?=\n\n|$)/)?.[1] || "";

    let mappedStatus = "🟡 รอรับเรื่อง";
    
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
        altText: `🔔 มีคำร้องใหม่: ${publicId}`,
        contents: {
          type: "bubble",
          size: "kilo",
          header: {
            type: "box",
            layout: "horizontal",
            backgroundColor: "#D1350F",
            alignItems: "center",
            contents: [
              {
                type: "box",
                layout: "vertical",
                width: "32px",
                height: "32px",
                backgroundColor: "#E85D40",
                cornerRadius: "16px",
                alignItems: "center",
                justifyContent: "center",
                contents: [
                  {
                    type: "image",
                    url: "https://supportsoc.vercel.app/notification.svg",
                    size: "24px"
                  }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                contents: [
                  {
                    type: "text",
                    text: "ONE STOP SERVICE",
                    color: "#ffffff",
                    weight: "bold",
                    size: "sm"
                  },
                  {
                    type: "text",
                    text: "มีคำร้องใหม่เข้าสู่ระบบ",
                    color: "#ffffff",
                    size: "xs"
                  }
                ]
              }
            ],
            paddingAll: "16px"
          },
          body: {
            type: "box",
            layout: "vertical",
            paddingAll: "20px",
            contents: [
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                contents: [
                  { type: "text", text: "เลขอ้างอิง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: publicId, color: "#1A1A2E", size: "xs", wrap: true }
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
                  { type: "text", text: categoryLabel, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "หัวข้อ", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: description, color: "#1A1A2E", size: "xs", wrap: true }
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
                  { type: "text", text: location, color: "#1A1A2E", size: "xs", wrap: true }
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
                  { type: "text", text: date, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "สถานะ", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: mappedStatus, color: "#1A1A2E", size: "xs", wrap: true }
                ]
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
