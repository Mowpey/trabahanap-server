import { PrismaClient } from "@prisma/client";
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const prisma = new PrismaClient();

export const createChat = async (req, res) => {
  try {
    const { clientId, jobId} = req.body;

    const jobSeekerId = req.user.id; // The job seeker (current user)
    const io = req.app.get("socketio");
    const job = await prisma.jobRequest.findUnique({
      where: { id: jobId },
      select: { jobTitle: true }
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    let chat = await prisma.chat.findFirst({
      where: {
        jobId: jobId,
        AND: [
          { participants: { some: { userId: clientId } } },
          { participants: { some: { jobSeekerId: jobSeekerId } } },
        ],
      },
      include: { participants: true },
    });
    
    

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          chatTitle: job.jobTitle,
          chatStatus: "pending",
          jobId:jobId,
          participants: {
            create: [
              {
                userId: clientId, 
                jobSeekerId: jobSeekerId, // Both in one document ✅
              },
            ],
          },
        },
        include: { participants: true },
      });
        // After creating the chat
        io.to(`user_${clientId}`).to(`user_${jobSeekerId}`).emit("new_chat", {
          chatId: chat.id,
          chatTitle: chat.chatTitle,
          chatStatus: chat.chatStatus,
          jobId : jobId,
          participants: chat.participants
        });

        // Also emit to update the chat list
        io.to(`user_${clientId}`).to(`user_${jobSeekerId}`).emit("chat_updated", {
          id: chat.id,
          lastMessage: "Chat created",
          lastMessageTime: new Date()
        });
    }

    res.json({ chatId: chat.id,
               chatTitle: chat.chatTitle,
               chatStatus:chat.chatStatus,
               jobId : jobId,
               participants: chat.participants });
    console.log("Chat Participants Added");
  } catch (error) {
    console.log("Error here");
    console.error("Error creating chat:", error);
    res.status(500).json({ error: "Server error" });
  }
};



export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("🔍 Current User ID:", userId);

    // Check if user is a JobSeeker
    const userAsJobSeeker = await prisma.jobSeeker.findUnique({
      where: { userId },
      include: { user: true }
    });

    const isJobSeeker = !!userAsJobSeeker; // Boolean to check if the user is a Job Seeker
    console.log("🔍 Is Job Seeker?", isJobSeeker);

    // Fetch all chats where the user is involved
    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          // Must have TWO participants: one client (user) and one jobseeker
          some: {
            userId: userId // Current user is the client
          },
          some: {
            jobSeekerId: userAsJobSeeker?.id // Current user is the jobseeker
          }
        }
      },
      include: {
        participants: {
          include: {
            user: true,       // Client data
            jobSeeker: {      // Jobseeker data
              include: {
                user: true    // Jobseeker's user profile
              }
            }
          }
        },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1
        }
      }
    });

    const transformedChats = chats.map(chat => {
      // Verify the chat has exactly 2 participants
      if (chat.participants.length !== 2) {
        console.error(`Chat ${chat.id} has invalid participants count`);
        return null;
      }
    
      // Identify client and jobseeker
      const clientParticipant = chat.participants.find(p => p.userId && !p.jobSeekerId);
      const jobSeekerParticipant = chat.participants.find(p => p.jobSeekerId && !p.userId);
    
      if (!clientParticipant || !jobSeekerParticipant) {
        console.error(`Chat ${chat.id} is missing required participant types`);
        return null;
      }
    
      // Get the OTHER participant's details
      const otherParticipant = userId === clientParticipant.userId 
        ? jobSeekerParticipant 
        : clientParticipant;
    
      const participantName = otherParticipant.jobSeeker
        ? `${otherParticipant.jobSeeker.user.firstName} ${otherParticipant.jobSeeker.user.lastName}`
        : `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
    
      const profileImage = otherParticipant.jobSeeker
        ? otherParticipant.jobSeeker.user.profileImage
        : otherParticipant.user.profileImage;
    
      return {
        id: chat.id,
        participantName,
        profileImage,
        lastMessage: chat.messages[0]?.messageContent || null,
        lastMessageTime: chat.lastMessageAt,
        offer: chat.offer || null,
        offerStatus: chat.offerStatus || 'none'
      };
    }).filter(chat => chat !== null); // Remove invalid chats

    console.log("🔍 Transformed Chats:", JSON.stringify(transformedChats, null, 2));

    res.json(transformedChats);
  } catch (error) {
    console.error("🚨 Error fetching user chats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId, messageContent } = req.body;
    const userId = req.user.id; // Authenticated user ID (Client OR Job Seeker's User ID)
    
    // 🔍 Check if the sender is a Job Seeker
    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { userId },
      select: { id: true }
    });

    const senderType = jobSeeker ? "jobSeeker" : "client";
    const actualSenderId = jobSeeker ? jobSeeker.id : userId; // Use Job Seeker ID if applicable

    console.log(`🔍 Sender Type: ${senderType}, ID: ${actualSenderId}`);

    // 🔍 Check if the chat exists
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true }
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // 🔍 Find the sender as a participant
    const sender = chat.participants.find(p => p.userId === actualSenderId || p.jobSeekerId === actualSenderId);
    if (!sender) {
      return res.status(403).json({ message: "You are not a participant in this chat" });
    }

    // ✅ Store the correct senderId in the message
    const newMessage = await prisma.message.create({
      data: {
        chatId,
        senderId: actualSenderId, // 🔥 Now supports both Clients and Job Seekers
        messageContent,
        sentAt: new Date(),
      }
    });

    // ✅ Update chat's `lastMessageAt`
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date() }
    });

    console.log(`✅ Message Sent! Sender ID: ${actualSenderId}, Content: ${messageContent}`);

    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("🚨 Error sending message:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};



export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { sentAt: "asc" },
          include: {
            readBy: true // ✅ Include read status
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    return res.json(chat.messages);
  } catch (error) {
    console.error("🚨 Error fetching messages:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


// GET /api/chats/:chatId/status
export const getStatus=  async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id; // From JWT middleware

    // Verify user has access to this chat
    const participant = await prisma.participant.findFirst({
      where: {
        chatId,
        OR: [
          { userId },
          { jobSeeker: { userId } }
        ]
      }
    });

    if (!participant) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { chatStatus: true }
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json({ status: chat.chatStatus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// POST /api/chats/:chatId/approve
export const chatApprove = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is a client and participant
    const participant = await prisma.participant.findFirst({
      where: {
        chatId,
        userId // Only clients have userId (job seekers have jobSeekerId)
      },
      include: { user: true }
    });

    if (!participant) {
      return res.status(403).json({ error: "Only client can approve chats" });
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { chatStatus: "approved" },
      include: {
        participants: {
          include: {
            jobSeeker: {
              include: { user: true }
            }
          }
        }
      }
    });

    // Notify all participants via socket.io
    const io = req.app.get('socketio');
    io.to(chatId).emit('chat_approved', { 
      chatId,
      approvedBy: participant.user.name 
    });
    io.to(chatId).emit("chat_approved", { status: "approved" }); 
   
  } catch (error) {
    console.error(error);
  }
  res.json({ message: "Chat approved" });
};

// POST /api/chats/:chatId/reject
export const chatReject = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is a client and participant
    const participant = await prisma.participant.findFirst({
      where: {
        chatId,
        userId
      }
    });

    if (!participant) {
      return res.status(403).json({ error: "Only client can reject chats" });
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { 
        chatStatus: "rejected"
      }
    });

    // Notify via socket.io
    const io = req.app.get('socketio');
    io.to(chatId).emit('chat_rejected', { 
      chatId,
      rejectedBy: userId
    });
    io.to(chatId).emit("chat_rejected", { status: "rejected" }); 

    
  } catch (error) {
    console.error(error);

  }
  res.json({ message: "Chat rejected" });
};

export const getReadStatus = async (req, res) => {
  const { messageId } = req.params;
  const { userId } = req.query; 
  try {
    const readStatus = await prisma.readStatus.findFirst({
      where: {
        messageId: messageId,
        userId: userId, // Check for a specific user
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      status: readStatus ? readStatus.status : 'Not Seen',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch read status' });
  }
};

