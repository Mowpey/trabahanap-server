import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { Console } from 'console';
const prisma = new PrismaClient();

export function initializeSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO middleware for authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Attach user information to the socket
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });
  // In your approve controller
  const userSocketMap = new Map(); 

  io.on('connection', (socket) => {
    // console.log('A user connected');
    socket.on('fetch_user_chats', async () => {
      try {
        const userId = socket.user.id;
    
        // Check if user is a JobSeeker
        const userAsJobSeeker = await prisma.jobSeeker.findUnique({
          where: { userId },
          select: { userId: true }
        });
    
        // Fetch all chats with necessary relations
        const chats = await prisma.chat.findMany({
          where: {
            participants: {
              some: userAsJobSeeker
                ? {
                    jobSeekerId: userAsJobSeeker.userId,
                    deletedByJobSeeker: false
                  }
                : {
                    userId,
                    deletedByClient: false
                  }
            }
          },
          include: {
            participants: {
              include: {
                user: true,
                jobSeeker: {
                  include: {
                    user: true
                  }
                }
              }
            },
            messages: {
              orderBy: { sentAt: "desc" }
            }
          },
          orderBy: {
            lastMessageAt: "desc"
          }
        });
        
    
        // Transform the chats
        const transformedChats = chats.map(chat => {
          const isJobSeeker = !!userAsJobSeeker;
    
          // Find the latest visible message for current user
          let visibleMessage = null;

          if (chat.messages.length > 0) {
            for (const msg of chat.messages) {
              const deletedBySender = msg.deletedBySender === 'yes';
              const deletedByReceiver = msg.deletedByReceiver === 'yes';
          
              if (deletedBySender && deletedByReceiver) {
                visibleMessage = { ...msg, messageContent: 'This message was deleted' };
                break;
              }
          
              if (
                (msg.senderId === userId && !deletedBySender) ||
                (msg.senderId !== userId && !deletedByReceiver)
              ) {
                visibleMessage = msg;
                break;
              }
            }
          }
          
    
          // Find the other participant
          let otherParticipant = null;
          if (isJobSeeker) {
            otherParticipant = chat.participants.find(p => p.userId)?.user;
          } else {
            otherParticipant = chat.participants.find(p => p.jobSeekerId)?.jobSeeker?.user;
          }
          
          // Determine the lastMessage content
          let lastMessageText = "No messages yet";

          if (chat.messages.length > 0 && visibleMessage) {
            const deletedBySender = visibleMessage.deletedBySender === 'yes';
            const deletedByReceiver = visibleMessage.deletedByReceiver === 'yes';
            const isImage = visibleMessage.messageContent?.includes('assets/messages_files/');
            const senderId = visibleMessage.senderId;

            if (deletedBySender && deletedByReceiver) {
              if (senderId === userId) {
                lastMessageText = "You removed a message";
              } else {
                lastMessageText = `${otherParticipant?.firstName ?? "Someone"} removed a message`;
              }
            } else if (isImage) {
              lastMessageText = senderId === userId
                ? "You sent a photo"
                : `${otherParticipant?.firstName ?? "Someone"} sent a photo`;
            } else {
              lastMessageText = visibleMessage.messageContent || "This message was deleted";
            }
          }

          return {
            id: chat.id,
            createdAt: chat.createdAt,
            participantName: otherParticipant 
              ? `${otherParticipant.firstName} ${otherParticipant.lastName}` 
              : "Unknown User",
            profileImage: otherParticipant?.profileImage || null,
            lastMessage: lastMessageText,
            lastMessageTime: chat.lastMessageAt,
            chatTitle: chat.chatTitle,
            chatStatus: chat.chatStatus,
            jobId: chat.jobId,
            offer: chat.offer,
            offerStatus: chat.offerStatus,
            senderId: visibleMessage?.senderId || null,
            otherParticipantId: otherParticipant?.id || null
          };
          
          
        });
    
        socket.emit('user_chats_fetched', transformedChats);
      } catch (error) {
        console.error("Error fetching user chats:", error);
        socket.emit('user_chats_error', { error: "Failed to fetch chats" });
      }
    });
    // Join a specific chat room
    socket.on('join_chat', ({ chatId }) => {
      console.log('joined chat',chatId)
      socket.join(chatId);
      socket.emit('mark_as_seen', { chatId });
      // console.log(`User joined chat room: ${chatId}`);
    });

    socket.on("send_message", async (messageData) => {
      try {
        const { chatId, messageContent, messageType } = messageData;
        const userId = socket.user.id;
    
        // 🔍 Check if the sender is a Job Seeker
        const jobSeeker = await prisma.jobSeeker.findUnique({
          where: { userId },
          select: { id: true },
        });
    
        const senderType = jobSeeker ? "jobSeeker" : "client";
        const actualSenderId = jobSeeker ? jobSeeker.id : userId; // Use Job Seeker ID if applicable
    
        // 🔍 Fetch chat and participants
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
          include: { 
            participants: {
              include: {
                user: true, // ✅ Include client user details
                jobSeeker: {
                  include: { user: true } // ✅ Include job seeker user details
                }
              }
            }
          }
        });
    
        if (!chat) {
          socket.emit("message_error", { message: "Chat not found" });
          return;
        }
    
        // 🔍 Ensure sender is a valid participant
        const sender = chat.participants.find(p => 
          p.userId === actualSenderId || p.jobSeekerId === actualSenderId
        );
    
        if (!sender) {
          socket.emit("message_error", { message: "You are not a participant in this chat" });
          return;
        }
    
        // ✅ Store the message
        const newMessage = await prisma.message.create({
          data: {
            chatId,
            senderId: actualSenderId,
            messageContent,
            messageType,
            sentAt: new Date(),
          },
          include:{
            readBy:true
          }
        });
    
        // ✅ Update chat's `lastMessageAt`
        await prisma.chat.update({
          where: { id: chatId },
          data: { lastMessageAt: new Date() },
        }); 
        const participants = await prisma.participant.findMany({
          where: { chatId },
          select: { id: true }
        });
        await prisma.$transaction(
          participants
            .filter(p => p.id !== actualSenderId)
            .map(participant =>
              prisma.readStatus.upsert({
                where: {
                  messageId_participantId: {
                    messageId: newMessage.id,
                    participantId: participant.id
                  }
                },
                create: {
                  messageId: newMessage.id,
                  participantId: participant.id,
                  readAt: null
                },
                update: {
                  // Make sure we don't overwrite readAt if it already has a value
                  // This keeps existing readAt values untouched
                }
              })
            )
        );
        
        
        const messageWithStatus = {
          ...newMessage,
          isDelivered: true,
          isSeen: false
        };
        // 🔍 Determine the other participant (SAME LOGIC AS `fetch_user_chats`)
        let otherParticipant = null;
        
        if (jobSeeker) {
          // Sender is a Job Seeker → Find the Client
          otherParticipant = chat.participants.find(p => p.userId)?.user;
        } else {
          // Sender is a Client → Find the Job Seeker
          otherParticipant = chat.participants.find(p => p.jobSeekerId)?.jobSeeker?.user;
        }
        console.log(otherParticipant);
        let participantName = "Unknown User";
        let profileImage = null;
    
        if (otherParticipant) {
          participantName = `${otherParticipant.firstName} ${otherParticipant.lastName}`;
          profileImage = otherParticipant.profileImage;
        }

    
        // ✅ Create the chat update object (ONLY update last message)
        const chatUpdate = {
          id: chat.id,
          participantName,
          profileImage,
          lastMessage: newMessage.messageContent,
          lastMessageTime: new Date(),
          isDelivered: true,
          isSeen: false
        };
    
        // Emit to all participants that message was delivered
        io.to(chatId).emit('message_delivered', { 
          messageId: newMessage.id,
          chatId: chat.id
        });
         
        // ✅ Broadcast the message to the chat room
        io.to(chatId).emit("receive_message", messageWithStatus);
    
        // ✅ Broadcast the updated chat (with correct participant) to all connected clients
        io.emit("chat_updated", chatUpdate);
    
      } catch (error) {
        console.error("🚨 Error sending message via socket:", error);
        socket.emit("message_error", { message: "Internal Server Error" });
      }
    });
    socket.on('mark_as_seen', async ({ chatId }) => {
      try {
        const userId = socket.user.id;
        console.log('UserID:', userId, 'ChatID:', chatId);
    
        // Find participant
        const participant = await prisma.participant.findFirst({
          where: {
            chatId,
            OR: [
              { userId },
              { jobSeeker: { userId } }
            ]
          },
          select: { id: true }
        });
    
        if (!participant) {
          console.log('Participant not found');
          return;
        }
    
        // Get all unread messages in this chat
        const unreadMessages = await prisma.readStatus.findMany({
          where: {
            participantId: participant.id,
            readAt: null,
            message: {
              chatId,
              senderId: { not: socket.user.id }
            }
          }
        });
    
        // If no unread messages, return early
        if (unreadMessages.length === 0) {
          console.log('No unread messages found');
          return;
        }
    
        // Update the read status only if there's an unread message
        const result = await prisma.readStatus.updateMany({
          where: {
            participantId: participant.id,
            readAt: null,
            message: {
              chatId,
              senderId: { not: socket.user.id }
            }
          },
          data: {
            readAt: new Date()
          }
        });
        console.log('Updated read statuses:', result);
    
        // Get the last message to update seen status
        const lastMessage = await prisma.message.findFirst({
          where: { chatId },
          orderBy: { sentAt: 'desc' },
          select: { id: true }
        });
    
        if (lastMessage) {
          console.log('Emitting message_seen for message ID:', lastMessage.id);
          io.to(chatId).emit('message_seen', {
            messageId: lastMessage.id,
            chatId
          });
        } else {
          console.log('No messages found in this chat');
        }
    
      } catch (error) {
        console.error("Error marking messages as seen:", error);
      }
    });
    
 socket.on('mark_as_read', async ({ chatId, messageIds }) => {
  try {
    const userId = socket.user.id;

    const participant = await prisma.participant.findFirst({
      where: {
        chatId,
        OR: [
          { userId },
          { jobSeeker: { userId } }
        ]
      },
      select: { id: true }
    });

    if (!participant) return;

    const readStatuses = await prisma.$transaction(
      messageIds.map(messageId =>
        prisma.readStatus.upsert({
          where: {
            messageId_participantId: {
              messageId,
              participantId: participant.id
            }
          },
          create: {
            messageId,
            participantId: participant.id,
            readAt: new Date()
          },
          update: {
            readAt: new Date()
          },
          include: {
            participant: true
          }
        })
      )
    );
   
    socket.to(chatId).emit('messages_read', {
      messageIds,
      readStatuses
    });

  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
});

    
    socket.on('leave_chat', ({ chatId }) => {
      console.log('left chat',chatId)
      socket.leave(chatId);
    });

    // Fetch chat history
    socket.on('fetch_messages', async ({ chatId }) => {
      try {
        // 🔍 Check if the chat exists
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
          include: { 
            messages: { 
              orderBy: { sentAt: "desc" },
              take: 50, // Limit to last 50 messages
              include: {
                // Optionally include sender details
                sender: true
              }
            } 
          }
        });

        if (!chat) {
          socket.emit('messages_error', { message: "Chat not found" });
          return;
        }

        // Send messages back to the client
        socket.emit('messages_fetched', chat.messages);
      } catch (error) {
        console.error("🚨 Error fetching messages via socket:", error);
        socket.emit('messages_error', { message: "Internal Server Error" });
      }
    });
    
    socket.on("make_offer", async ({ jobRequestId, offerAmount, chatId }) => {
      try {

        console.log(jobRequestId,offerAmount)
        if (!chatId || !offerAmount) {
          socket.emit("make_offer_error", { message: "Missing chatId or offerAmount" });
          return;
        }

        // Update job with offer and jobSeekerId
        const updatedChat = await prisma.chat.update({
          where: { id: chatId },
          data: {
            offer: offerAmount,
            offerStatus: "pending",
          },
          include: {
            participants: true
          }
        });

        // Emit success back to job seeker
        socket.emit("offer_made_success", {
          jobRequestId,
          offerAmount,
        });
        const status = updatedChat.offerStatus;
        console.log(status)
        // Optional: Notify the client (use room or client socket ID if you store them)
        io.to(chatId).emit("client_offer_notification", {
          jobRequestId,
          offerAmount,
          status,
          chatId,
        });

    
      } catch (error) {
        console.error("❌ make_offer error:", error);
        socket.emit("make_offer_error", { message: "Failed to make offer" });
      }
    });

    socket.on("accept_offer", async ({ chatId,jobRequestId }) => {
      try {
        const updatedChat = await prisma.chat.update({
          where: { id: chatId },
          data: {
            offerStatus: "accepted",
          },
          include: {
            participants: true
          }
        });
        
        const jobseekerid = updatedChat.participants[0]?.jobSeekerId;

        const updatedJob = await prisma.jobRequest.update({
          where: { id: jobRequestId },
          data: { offer: updatedChat.offer,jobStatus: "pending",jobSeekerId:jobseekerid},
        });
        
    
        // Notify both parties
        io.to(chatId).emit("offer_accepted", {
          chatId,
          offerAmount: updatedChat.offer,
          offerStatus: updatedChat.offerStatus
        });
    
      } catch (error) {
        console.error("❌ accept_offer error:", error);
        socket.emit("offer_error", { message: "Failed to accept offer" });
      }
    });
    
    // Handle offer rejection
    socket.on("reject_offer", async ({ chatId }) => {
      try {
        const updatedChat = await prisma.chat.update({
          where: { id: chatId },
          data: {
            offerStatus: "rejected",
          }
        });
    
        io.to(chatId).emit("offer_rejected", {
          chatId,
          offerAmount: updatedChat.offer,
          offerStatus: updatedChat.offerStatus
        });
    
      } catch (error) {
        console.error("❌ reject_offer error:", error);
        socket.emit("offer_error", { message: "Failed to reject offer" });
      }
    });

    socket.on("get_chat_offer", async ({ chatId }) => {
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { offer: true, offerStatus: true }
      });
    
      if (chat) {
        socket.emit("chat_offer_data", {
          offer: chat.offer,
          offerStatus: chat.offerStatus
        });
      }
    });

    socket.on('upload_image', async ({ senderId, chatId, image }) => {
      try {
        const matches = image.match(/^data:(.+);base64,(.+)$/);
    
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid image format');
        }
    
        const mimeType = matches[1]; // e.g., "image/jpeg"
        const base64Data = matches[2];
    
        const ext = mimeType.split('/')[1] || 'jpg'; // fallback to jpg if undefined
        const filename = `${Date.now()}.${ext}`;
        const folderPath = path.join(process.cwd(), 'assets/messages_files', chatId);
        const filePath = path.join(folderPath, filename);
    
        fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(filePath, base64Data, 'base64');
    
        const relativePath = `assets/messages_files/${chatId}/${filename}`;
    
        const newMessage = await prisma.message.create({
          data: {
            chatId,
            senderId,
            messageContent: relativePath,
            messageType: 'image',
          },
        });
    
        io.to(chatId).emit('receive_message', newMessage);
        
      } catch (error) {
        console.error('Socket upload error:', error);
      }
    });
    
    socket.on('delete-message', async ({ messageId, chatId, deletionType, isSender }) => {
      try {
        console.log(isSender);
        // 1. Verify message exists
        const message = await prisma.message.findUnique({
          where: { id: messageId }
        });
        if (!message) throw new Error('Message not found');
    
        // 2. Prepare update data
        const updateData = {};
        if (deletionType === 'forEveryone') {
          updateData.deletedBySender = 'yes';
          updateData.deletedByReceiver = 'yes';
        } else {
          updateData[isSender ? 'deletedBySender' : 'deletedByReceiver'] = 'yes';
        }
    
        // 3. Update message in database
        await prisma.message.update({
          where: { id: messageId },
          data: updateData
        });
    
        // 4. Broadcast to all chat participants

        io.to(chatId).emit('message-deleted', {
          messageId,
          updates: updateData,
          // newContent: 'This message was deleted'
        });
    
      } catch (error) {
        socket.emit('delete-error', error.message);
      }
    });

    socket.on('delete_chat', async ({ chatId, userRole }) => {
      try {
        const userId = socket.user.id;
    
        const updateData =
          userRole === 'job-seeker'
            ? { deletedByJobSeeker: true }
            : { deletedByClient: true };
    
        await prisma.participant.updateMany({
          where: {
            chatId,
            ...(userRole === 'job-seeker' ? { jobSeekerId: userId } : { userId }),
          },
          data: updateData,
        });
    
        socket.emit('chat_deleted_success', { chatId });
      } catch (error) {
        console.error('Error deleting chat:', error);
        socket.emit('chat_deleted_error', { error: 'Failed to delete chat' });
      }
    });
    

    socket.on('register_user', (userId) => {
      userSocketMap.set(userId, socket.id);
      console.log(`User ${userId} registered`);
    });
    
    
    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
    for (const [userId, sockId] of userSocketMap.entries()) {
      if (sockId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  });

  

  return io;
}