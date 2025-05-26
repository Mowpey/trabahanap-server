import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { Console } from 'console';
const prisma = new PrismaClient();

const onlineUsers = new Map(); // userId -> { socketId, lastSeen, userInfo }
const activeCalls = new Map(); // chatId -> { callerId, calleeId, status }

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
        const actualSenderId = userId;
    
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
            participants: {
              include: {
                jobSeeker: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        });

        // Find the job seeker participant and their user details
        const jobSeekerParticipant = updatedChat.participants.find(p => p.jobSeekerId);
        let jobSeekerName = "A job seeker";
        if (jobSeekerParticipant && jobSeekerParticipant.jobSeeker && jobSeekerParticipant.jobSeeker.user) {
          jobSeekerName = `${jobSeekerParticipant.jobSeeker.user.firstName} ${jobSeekerParticipant.jobSeeker.user.lastName}`;
        }

        // Fetch job title for notification
        const job = await prisma.jobRequest.findUnique({
          where: { id: jobRequestId },
          select: { jobTitle: true }
        });

        const notification = {
          type: "offer_made",
          message: `${jobSeekerName} sent an offer of ₱${offerAmount} for "${job?.jobTitle ?? 'a job'}".`,
          offerAmount,
          jobTitle: job?.jobTitle ?? 'Unknown',
          chatId,
        };
        io.to(chatId).emit("offer_notification", notification);

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

        // === NEW: Create notification in DB ===
        const chatParticipants = updatedChat.participants;
        const senderId = socket.user.id;
        const recipientParticipant = chatParticipants.find(
          p => (p.userId && p.userId !== senderId) || (p.jobSeekerId && p.jobSeekerId !== senderId)
        );

        if (recipientParticipant) {
          await createNotification({
            recipient: {
              userId: recipientParticipant.userId,
              jobSeekerId: recipientParticipant.jobSeekerId,
            },
            type: "offer_made",
            title: "New Offer Made",
            message: notification.message,
            relatedIds: [chatId, jobRequestId].filter(Boolean),
          });
        }
        // === END NEW ===

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
          data: { 
            offer: updatedChat.offer,
            jobStatus: "pending",
            jobSeekerId: jobseekerid,
            acceptedAt: new Date()
          },
        });
        
    
        // Notify both parties
        io.to(chatId).emit("offer_accepted", {
          chatId,
          offerAmount: updatedChat.offer,
          offerStatus: updatedChat.offerStatus
        });

        // Fetch job title for notification
        const job = await prisma.jobRequest.findUnique({
          where: { id: jobRequestId },
          select: { jobTitle: true }
        });

        const notification = {
          type: "offer_accepted",
          message: `The offer of ₱${updatedChat.offer} for "${job?.jobTitle ?? 'a job'}" was accepted by the employer.`,
          offerAmount: updatedChat.offer,
          jobTitle: job?.jobTitle ?? 'Unknown',
          chatId,
        };
        io.to(chatId).emit("offer_notification", notification);
    
        // === NEW: Create notification in DB ===
        const chatParticipants = updatedChat.participants;
        const senderId = socket.user.id;
        const recipientParticipant = chatParticipants.find(
          p => (p.userId && p.userId !== senderId) || (p.jobSeekerId && p.jobSeekerId !== senderId)
        );

        if (recipientParticipant) {
          await createNotification({
            recipient: {
              userId: recipientParticipant.userId,
              jobSeekerId: recipientParticipant.jobSeekerId,
            },
            type: "offer_accepted",
            title: "Offer Accepted",
            message: notification.message,
            relatedIds: [chatId, jobRequestId].filter(Boolean),
          });
        }
        // === END NEW ===

      } catch (error) {
        console.error("❌ accept_offer error:", error);
        socket.emit("offer_error", { message: "Failed to accept offer" });
      }
    });
    
    // Handle offer rejection
    socket.on("reject_offer", async ({ chatId, jobRequestId }) => {
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

        let offerAmount = updatedChat.offer;
        let jobTitle = 'Unknown';
        let jobId = null;

        // Try to get jobRequestId from param, or from chat if missing
        let actualJobRequestId = jobRequestId;
        if (!actualJobRequestId && updatedChat.jobId) {
          actualJobRequestId = updatedChat.jobId;
        }

        if (actualJobRequestId) {
          const job = await prisma.jobRequest.findUnique({
            where: { id: actualJobRequestId },
            select: { jobTitle: true }
          });
          jobTitle = job?.jobTitle ?? 'Unknown';
        }

        const notification = {
          type: "offer_rejected",
          message: `The offer of ₱${offerAmount} for "${jobTitle}" was rejected by the employer.`,
          offerAmount,
          jobTitle,
          chatId,
        };
        io.to(chatId).emit("offer_notification", notification);
    
        // === NEW: Create notification in DB ===
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
          include: { participants: true }
        });
        const chatParticipants = chat.participants;
        const senderId = socket.user.id;
        const recipientParticipant = chatParticipants.find(
          p => (p.userId && p.userId !== senderId) || (p.jobSeekerId && p.jobSeekerId !== senderId)
        );

        if (recipientParticipant) {
          await createNotification({
            recipient: {
              userId: recipientParticipant.userId,
              jobSeekerId: recipientParticipant.jobSeekerId,
            },
            type: "offer_rejected",
            title: "Your Offer Was Rejected",
            message: `Unfortunately, your offer of ₱${offerAmount} for "${jobTitle}" was rejected by the employer.`,
            relatedIds: [chatId, jobRequestId].filter(Boolean),
          });
        }
        // === END NEW ===

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
    socket.on('upload_file', async ({ senderId, chatId, file, fileName, fileType }) => {
      try {
        console.log('Received file upload request:', {
          fileName,
          fileType,
          fileDataLength: file ? file.length : 0
        });
    
        let base64Data = file;
        
        // If it's already in data URI format, extract the base64 part
        if (file.startsWith('data:')) {
          const matches = file.match(/^data:(.+);base64,(.+)$/);
          if (!matches || matches.length !== 3) {
            throw new Error('Invalid file format');
          }
          base64Data = matches[2];
        }
    
        // Get file extension from original filename or mime type
        const ext = fileName.split('.').pop() || (fileType ? fileType.split('/')[1] : 'txt');
        const filename = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const folderPath = path.join(process.cwd(), 'assets/messages_files', chatId);
        const filePath = path.join(folderPath, filename);
    
        // Create directory if it doesn't exist
        fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(filePath, base64Data, 'base64');
    
        const relativePath = `assets/messages_files/${chatId}/${filename}`;
    
        const newMessage = await prisma.message.create({
          data: {
            chatId,
            senderId,
            messageContent: relativePath,
            messageType: 'file',
            // fileName: fileName,
            // fileType: fileType,
          },
        });
    
        // Emit success response to the sender
        socket.emit('file_upload_response', {
          success: true,
          message: 'File uploaded successfully',
          fileData: {
            id: newMessage.id,
            fileName: fileName,
            fileType: fileType,
            filePath: relativePath
          }
        });
    
        // Broadcast the new message to all chat participants
        io.to(chatId).emit('receive_message', newMessage);
    
      } catch (error) {
        console.error('Socket file upload error:', error);
        // Emit error response to the sender
        socket.emit('file_upload_response', {
          success: false,
          error: error.message || 'Failed to upload file'
        });
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
    

    socket.on('register_user', async (userId) => {
      try {
        // Get user info from database
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, firstName: true, lastName: true, profileImage: true }
        });

        if (user) {
          // Store user info in online users map
          onlineUsers.set(userId, {
            socketId: socket.id,
            userInfo: user
          });
          console.log(onlineUsers);

          // Broadcast to all clients that this user is online
          io.emit('user_online', {
            userId,
            userInfo: user
          });

          // Send current online users to the newly connected user
          socket.emit('online_users', Array.from(onlineUsers.entries()).map(([id, data]) => ({
            userId: id,
            ...data.userInfo
          })));
        }
      } catch (error) {
        console.error('Error registering user:', error);
      }
    });
    
    
    socket.on('disconnect', () => {
      // Find and remove the user from online users
      for (const [userId, data] of onlineUsers.entries()) {
        if (data.socketId === socket.id) {
          onlineUsers.delete(userId);
          // Broadcast to all clients that this user is offline
          io.emit('user_offline', { userId });
          break;
        }
      }

      // Clean up any active calls where this user was participating
      for (const [chatId, call] of activeCalls.entries()) {
        if (call.callerId === socket.user.id || call.calleeId === socket.user.id) {
          activeCalls.delete(chatId);
          // Notify other participant that call ended
          const otherUserId = call.callerId === socket.user.id ? call.calleeId : call.callerId;
          const otherSocketId = Array.from(onlineUsers.entries())
            .find(([userId]) => userId === otherUserId)?.[1]?.socketId;
          
          if (otherSocketId) {
            io.to(otherSocketId).emit('call_ended', {
              chatId,
              reason: 'participant_disconnected'
            });
          }
        }
      }
    });

    // Add new event to get online users
    socket.on('get_online_users', () => {
      const onlineUsersList = Array.from(onlineUsers.entries()).map(([id, data]) => ({
        userId: id,
        ...data.userInfo
      }));
      socket.emit('online_users', onlineUsersList);
    });

    // Handle call initiation
    socket.on('initiate_call', async ({ chatId, callerId, calleeId }) => {
      console.log('Call initiated:', { chatId, callerId, calleeId });
      
      try {
        // Validate that both users are online
        const callerSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === callerId)?.[1]?.socketId;
        const calleeSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === calleeId)?.[1]?.socketId;

        if (!calleeSocket) {
          socket.emit('call_error', { message: 'Callee is offline' });
          return;
        }

        // Store call information
        activeCalls.set(chatId, {
          callerId,
          calleeId,
          status: 'ringing',
          startTime: new Date()
        });

        // Emit to callee
        io.to(calleeSocket).emit('incoming_call', {
          chatId,
          callerId,
          callerInfo: onlineUsers.get(callerId)?.userInfo
        });

        // Emit to caller that call is being signaled
        socket.emit('call_initiated', {
          chatId,
          calleeId,
          calleeInfo: onlineUsers.get(calleeId)?.userInfo
        });

      } catch (error) {
        console.error('Error initiating call:', error);
        socket.emit('call_error', { message: 'Failed to initiate call' });
      }
    });

    // Handle call signaling
    socket.on('signal_call', ({ chatId, signal, fromUserId, toUserId }) => {
      try {
        const call = activeCalls.get(chatId);
        
        if (!call) {
          socket.emit('call_error', { message: 'Call not found' });
          return;
        }

        // Verify the signal is from a valid participant
        if (fromUserId !== call.callerId && fromUserId !== call.calleeId) {
          socket.emit('call_error', { message: 'Unauthorized signal' });
          return;
        }

        // Find recipient's socket
        const recipientSocketId = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === toUserId)?.[1]?.socketId;

        if (recipientSocketId) {
          // Forward the signal to the other participant
          io.to(recipientSocketId).emit('call_signal', {
            chatId,
            signal,
            fromUserId
          });
        } else {
          socket.emit('call_error', { message: 'Recipient is offline' });
        }

      } catch (error) {
        console.error('Error signaling call:', error);
        socket.emit('call_error', { message: 'Failed to signal call' });
      }
    });

    // Handle call acceptance
    socket.on('accept_call', async ({ chatId, callerId, calleeId }) => {
      console.log('Call accepted:', { chatId, callerId, calleeId });
      
      try {
        // Get the call from active calls
        const call = activeCalls.get(chatId);
        if (!call) {
          socket.emit('call_error', { message: 'Call not found' });
          return;
        }

        // Verify this is the correct callee
        if (call.calleeId !== calleeId) {
          socket.emit('call_error', { message: 'Unauthorized call acceptance' });
          return;
        }

        // Update call status
        activeCalls.set(chatId, {
          ...call,
          status: 'accepted',
          acceptedAt: new Date()
        });

        // Find both sockets
        const callerSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === callerId)?.[1]?.socketId;
        const calleeSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === calleeId)?.[1]?.socketId;

        if (!callerSocket || !calleeSocket) {
          socket.emit('call_error', { message: 'One of the participants is offline' });
          return;
        }

        // Notify both parties
        io.to(callerSocket).emit('call_accepted', {
          chatId,
          calleeId,
          calleeInfo: onlineUsers.get(calleeId)?.userInfo
        });

        io.to(calleeSocket).emit('call_accepted_confirmation', {
          chatId,
          callerId,
          callerInfo: onlineUsers.get(callerId)?.userInfo
        });

      } catch (error) {
        console.error('Error accepting call:', error);
        socket.emit('call_error', { message: 'Failed to accept call' });
      }
    });

    // Handle call rejection
    socket.on('reject_call', async ({ chatId, callerId, calleeId, reason }) => {
      console.log('Call rejected:', { chatId, callerId, calleeId, reason });
      
      try {
        // Get the call from active calls
        const call = activeCalls.get(chatId);
        if (!call) {
          socket.emit('call_error', { message: 'Call not found' });
          return;
        }

        // Verify this is the correct callee
        if (call.calleeId !== calleeId) {
          socket.emit('call_error', { message: 'Unauthorized call rejection' });
          return;
        }

        // Find both sockets
        const callerSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === callerId)?.[1]?.socketId;
        const calleeSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === calleeId)?.[1]?.socketId;

        if (!callerSocket || !calleeSocket) {
          socket.emit('call_error', { message: 'One of the participants is offline' });
          return;
        }

        // Notify both parties
        io.to(callerSocket).emit('call_rejected', {
          chatId,
          calleeId,
          reason: reason || 'Call rejected',
          calleeInfo: onlineUsers.get(calleeId)?.userInfo
        });

        io.to(calleeSocket).emit('call_rejected_confirmation', {
          chatId,
          callerId,
          callerInfo: onlineUsers.get(callerId)?.userInfo
        });

        // Remove the call from active calls
        activeCalls.delete(chatId);

      } catch (error) {
        console.error('Error rejecting call:', error);
        socket.emit('call_error', { message: 'Failed to reject call' });
      }
    });

    // Handle call end (for both parties)
    socket.on('end_call', ({ chatId, callerId, calleeId }) => {
      console.log('Call ended:', { chatId, callerId, calleeId });
      
      try {
        const call = activeCalls.get(chatId);
        if (!call) {
          return; // Call might have already been ended
        }

        // Find both sockets
        const callerSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === callerId)?.[1]?.socketId;
        const calleeSocket = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === calleeId)?.[1]?.socketId;

        // Notify both parties if they're still online
        if (callerSocket) {
          io.to(callerSocket).emit('call_ended', {
            chatId,
            calleeId,
            reason: 'Call ended by other party'
          });
        }

        if (calleeSocket) {
          io.to(calleeSocket).emit('call_ended', {
            chatId,
            callerId,
            reason: 'Call ended by other party'
          });
        }

        // Remove the call from active calls
        activeCalls.delete(chatId);

      } catch (error) {
        console.error('Error ending call:', error);
        socket.emit('call_error', { message: 'Failed to end call' });
      }
    });

    // Handle ICE candidates
    socket.on('ice_candidate', ({ chatId, candidate, fromUserId, toUserId }) => {
      try {
        const call = activeCalls.get(chatId);
        
        if (!call) {
          socket.emit('call_error', { message: 'Call not found' });
          return;
        }

        // Verify the candidate is from a valid participant
        if (fromUserId !== call.callerId && fromUserId !== call.calleeId) {
          socket.emit('call_error', { message: 'Unauthorized ICE candidate' });
          return;
        }

        // Find recipient's socket
        const recipientSocketId = Array.from(onlineUsers.entries())
          .find(([userId]) => userId === toUserId)?.[1]?.socketId;

        if (recipientSocketId) {
          // Forward the ICE candidate to the other participant
          io.to(recipientSocketId).emit('ice_candidate', {
            chatId,
            candidate,
            fromUserId
          });
        } else {
          socket.emit('call_error', { message: 'Recipient is offline' });
        }

      } catch (error) {
        console.error('Error handling ICE candidate:', error);
        socket.emit('call_error', { message: 'Failed to handle ICE candidate' });
      }
    });
  });

  

  return io;
}

async function createNotification({ recipient, type, title, message, relatedIds }) {
  if (!recipient.userId) {
    throw new Error('Notification must have a clientId (userId)');
  }
  const data = {
    notificationType: type,
    notificationTitle: title,
    notificationMessage: message,
    relatedIds: (relatedIds || []).filter(Boolean),
    clientId: recipient.userId,
  };
  if (recipient.jobSeekerId) data.jobSeekerId = recipient.jobSeekerId;
  await prisma.notification.create({ data });
}