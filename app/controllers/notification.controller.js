import { PrismaClient } from "@prisma/client";
import { Expo } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo();

// Store push token
export const storePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    const userId = req.user.id;

    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({ error: "Invalid push token" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken }
    });

    res.json({ message: "Push token stored successfully" });
  } catch (error) {
    console.error("Error storing push token:", error);
    res.status(500).json({ error: "Failed to store push token" });
  }
};

// Helper function to send push notification
export const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }

    return tickets;
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
  }
}; 