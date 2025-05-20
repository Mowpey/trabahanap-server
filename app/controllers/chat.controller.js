import { PrismaClient } from "@prisma/client";
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Console } from "console";
import { sendPushNotification } from './notification.controller.js';

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
      await prisma.jobRequest.update({
        where: { id: jobId },
        data: {
          applicantCount: {
            increment: 1
          }
        }
      })
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

        // Notify the client
        await prisma.notification.create({
          data: {
            clientId: clientId,
            jobSeekerId: jobSeekerId,
            notificationType: "chat-request",
            notificationTitle: "New Chat Request",
            notificationMessage: `A job seeker has requested to chat about your job posting "${job.jobTitle}".`,
            relatedIds: [jobId],
            isRead: false,
            createdAt: new Date(),
          },
        });

        // Get client's push token
        const client = await prisma.user.findUnique({
          where: { id: clientId },
          select: { pushToken: true }
        });

        // Send push notification if token exists
        if (client?.pushToken) {
          await sendPushNotification(
            client.pushToken,
            "New Chat Request",
            `A job seeker has requested to chat about your job posting "${job.jobTitle}".`,
            {
              type: 'chat-request',
              chatId: chat.id,
              jobId: jobId
            }
          );
        }
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

    // Fetch chat and job title
    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    });

    let jobTitle = '';
    if (chat && chat.jobId) {
      const jobRequest = await prisma.jobRequest.findUnique({
        where: { id: chat.jobId },
        select: { jobTitle: true }
      });
      jobTitle = jobRequest?.jobTitle || '';
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

    // Find the jobSeeker participant
    const jobSeekerParticipant = updatedChat.participants.find(p => p.jobSeeker && p.jobSeeker.user);
    if (jobSeekerParticipant) {
      await prisma.notification.create({
        data: {
          clientId: userId,
          jobSeekerId: jobSeekerParticipant.jobSeekerId,
          notificationType: "chat-approved",
          notificationTitle: "Chat Approved",
          notificationMessage: `Your chat request for the job "${jobTitle}" has been approved by the employer.`,
          relatedIds: [chatId],
          isRead: false,
          createdAt: new Date(),
        },
      });
    }

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

    // Fetch chat and job title
    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    });

    let jobTitle = '';
    if (chat && chat.jobId) {
      const jobRequest = await prisma.jobRequest.findUnique({
        where: { id: chat.jobId },
        select: { jobTitle: true }
      });
      jobTitle = jobRequest?.jobTitle || '';
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { 
        chatStatus: "rejected"
      },
      include: {
        participants: true
      }
    });

    // Find the jobSeeker participant
    const jobSeekerParticipant = updatedChat.participants.find(p => p.jobSeekerId);
    if (jobSeekerParticipant) {
      await prisma.notification.create({
        data: {
          clientId: userId,
          jobSeekerId: jobSeekerParticipant.jobSeekerId,
          notificationType: "chat-rejected",
          notificationTitle: "Chat Rejected",
          notificationMessage: `Your chat request for the job "${jobTitle}" has been rejected by the employer.`,
          relatedIds: [chatId],
          isRead: false,
          createdAt: new Date(),
        },
      });
    }

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

export const getJobSeekerTags = async (req, res) => {
  try {
    const jobSeekerId = req.params.id; // Adjust based on your auth setup
    console.log("THe id is",jobSeekerId);

    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { userId: jobSeekerId },
      select: {
        jobTags: true,
      },
    });

    if (!jobSeeker) {
      return res.status(404).json({ error: "Job seeker not found" });
    }

    res.json({ jobTags: jobSeeker.jobTags || [] });
  } catch (error) {
    console.error("Error fetching job seeker tags:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get the job seeker with all related data
    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            suffixName: true,
            profileImage: true,
            emailAddress: true,
            barangay: true,
            street: true,
            houseNumber: true,
            gender: true,
            birthday: true,
            jobsDone: true,
            joinedAt: true,
          },
        },
        achievement: {
          select: {
            id: true,
            achievementName: true,
            jobRequired: true,
            achievementIcon: true,
          },
        },
        jobRequest: {
          where: {
            AND: [
              { jobStatus: 'verified' },
            ]
          },
          select: { 
            completedAt: true,
            verifiedAt: true
          }
        }
      },
    });

    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker not found" });
    }

    // Fetch all reviews for this jobseeker (by jobRequest)
    const reviews = await prisma.review.findMany({
      where: {
        jobRequest: {
          jobSeekerId: userId,
          jobStatus: 'verified'
        }
      },
      select: {
        id: true,
        rating: true,
        feedback: true,
        createdAt: true,
        jobRequest: {
          select: {
            verifiedAt: true
          }
        }
      }
    });

    // Calculate average rating and completed jobs
    const completedJobs = jobSeeker.jobRequest.length;
    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Transform achievements to match the interface
    const achievements = jobSeeker.achievement.map(achievement => ({
      id: achievement.id,
      title: achievement.achievementName,
      description: `Complete ${achievement.jobRequired} jobs`,
      icon: achievement.achievementIcon,
      color: '#4CAF50' // Default color, can be customized
    }));

    // Transform feedbacks
    const feedbacks = reviews
      .filter(review => review.feedback)
      .map(review => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.feedback,
        date: (review.jobRequest?.verifiedAt || review.createdAt).toISOString(),
        anonymousName: 'Anonymous Client'
      }));

    // Calculate years of experience (assuming it's based on first job completion)
    const firstJobDate = jobSeeker.jobRequest.length > 0 
      ? new Date(Math.min(...jobSeeker.jobRequest.map(job => job.verifiedAt)))
      : new Date();
    const yearsExperience = Math.floor((new Date() - firstJobDate) / (1000 * 60 * 60 * 24 * 365));

    const response = {
      name: `${jobSeeker.user.firstName}  ${jobSeeker.user.middleName} ${jobSeeker.user.lastName}`,
      profileImage: jobSeeker.user.profileImage || '',
      address: `${jobSeeker.user.houseNumber || ''} ${jobSeeker.user.street}, ${jobSeeker.user.barangay}`,
      rating: averageRating,
      completedJobs,
      yearsExperience,
      skills: [], // We'll need to fetch job tags separately or modify the schema
      achievements,
      email: jobSeeker.user.emailAddress,
      phoneNumber: '', // Not currently stored in the schema
      gender: jobSeeker.user.gender,
      birthday: jobSeeker.user.birthday.toISOString(),
      feedbacks,
      jobsDone: jobSeeker.user.jobsDone || 0,
      joinedAt: jobSeeker.user.joinedAt ? jobSeeker.user.joinedAt.toISOString() : null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getReviews = async (req, res) => {
  try {
    const userId = req.params.id;

    // Get all reviews for this job seeker (by reviewedId only)
    const reviews = await prisma.review.findMany({
      where: {
        reviewedId: userId
      },
      select: {
        id: true,
        rating: true,
        feedback: true,
        createdAt: true,
        reviewer: {  // Add this to get reviewer information
          select: {
            firstName: true,
            lastName: true
          }
        },
        // jobRequest: {
        //   select: {
        //     jobTitle: true,
        //     verifiedAt: true
        //   }
        // }
      }
    });

    // Transform the reviews into feedback format
    const feedbacks = reviews
      .filter(review => review.feedback)
      .map(review => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.feedback,
        date: (review.jobRequest?.verifiedAt || review.createdAt).toISOString(),
        jobTitle: review.jobRequest?.jobTitle || '',
        anonymousName: `${review.reviewer.firstName} ${review.reviewer.lastName}`  // Use actual name
      }));

    return res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getClientProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch the user (client) profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        suffixName: true,
        profileImage: true,
        emailAddress: true,
        barangay: true,
        street: true,
        houseNumber: true,
        gender: true,
        birthday: true,
        jobsDone: true,
        joinedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const response = {
      name: `${user.firstName} ${user.middleName || ''} ${user.lastName}`,
      profileImage: user.profileImage || '',
      address: `${user.houseNumber || ''} ${user.street || ''}, ${user.barangay || ''}`,
      email: user.emailAddress,
      phoneNumber: '', // Not currently stored in the schema
      gender: user.gender,
      birthday: user.birthday ? user.birthday.toISOString() : null,
      jobsDone: user.jobsDone || 0,
      joinedAt: user.joinedAt ? user.joinedAt.toISOString() : null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching client profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const blockUser = async (req, res) => {
  try {
    const { blockedId, reason } = req.body;
    const blockerId = req.user.id;

    // Prevent self-blocking
    if (blockerId === blockedId) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }

    // Check if already blocked
    const existingBlock = await prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    if (existingBlock) {
      return res.status(400).json({ message: "User is already blocked" });
    }

    // Create block
    const block = await prisma.blockedUser.create({
      data: {
        blockerId,
        blockedId,
        reason,
      },
    });

    res.status(201).json(block);
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { blockedId } = req.params;
    const blockerId = req.user.id;

    const block = await prisma.blockedUser.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const blockerId = req.user.id;

    const blockedUsers = await prisma.blockedUser.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    res.status(200).json(blockedUsers);
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const isBlocked = async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user.id;

    const block = await prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: userId,
        },
      },
    });

    res.status(200).json({ isBlocked: !!block });
  } catch (error) {
    console.error("Error checking block status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getJobRequestBudget = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get the job request with budget
    const jobRequest = await prisma.jobRequest.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        budget: true,
        jobTitle: true,
        jobStatus: true
      }
    });

    if (!jobRequest) {
      return res.status(404).json({ message: "Job request not found" });
    }

    res.status(200).json({
      jobId: jobRequest.id,
      budget: jobRequest.budget,
      jobTitle: jobRequest.jobTitle,
      jobStatus: jobRequest.jobStatus
    });
  } catch (error) {
    console.error("Error fetching job request budget:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUsersWhoBlockedMe = async (req, res) => {
  try {
    const userId = req.params.id;

    const blockedByUsers = await prisma.blockedUser.findMany({
      where: { blockedId: userId },
      select: {
        blockerId: true
      }
    });

    // Extract just the blocker IDs from the results
    const blockerIds = blockedByUsers.map(block => block.blockerId);

    res.status(200).json(blockerIds);
  } catch (error) {
    console.error("Error fetching users who blocked me:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};