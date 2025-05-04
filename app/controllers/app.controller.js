import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";

const prisma = new PrismaClient();

export const jobRequest = async (req, res) => {
  let jobPost;
  let assignedJobSeekerId = req.body.jobSeeker || null;

  if (assignedJobSeekerId) {
    jobPost = await prisma.jobRequest.create({
      data: {
        client: { connect: { id: req.body.client } },
        jobSeeker: { connect: { id: assignedJobSeekerId } },
        jobTitle: req.body.jobTitle,
        jobDescription: req.body.jobDescription,
        category: req.body.category,
        jobLocation: req.body.jobLocation,
        jobStatus: "open",
        budget: req.body.budget,
        jobDuration: req.body.jobDuration,
        jobImage: req.files.map((file) => file.path),
        acceptedAt: new Date(Date.now()),
        completedAt: new Date(Date.now()),
        verifiedAt: new Date(Date.now()),
      },
    });
    console.log("Successfully posted the job request", jobPost);
  } else {
    jobPost = await prisma.jobRequest.create({
      data: {
        client: { connect: { id: req.body.client } },
        jobTitle: req.body.jobTitle,
        jobDescription: req.body.jobDescription,
        category: req.body.category,
        jobLocation: req.body.jobLocation,
        jobStatus: "open",
        budget: req.body.budget,
        jobDuration: req.body.jobDuration,
        jobImage: req.files.map((file) => file.path),
        acceptedAt: new Date(Date.now()),
        completedAt: new Date(Date.now()),
        verifiedAt: new Date(Date.now()),
      },
    });
    console.log("Successfully posted the job request", jobPost);
  }

  // --- Notification logic ---
  const jobCategory = req.body.category;

  // Find all jobseekers with matching jobTags
  let jobSeekerWhere = {
    jobTags: {
      has: jobCategory,
    },
  };
  // If a jobSeeker is assigned, exclude them from notifications
  if (assignedJobSeekerId) {
    jobSeekerWhere.id = { not: assignedJobSeekerId };
  }

  const matchingJobSeekers = await prisma.jobSeeker.findMany({
    where: jobSeekerWhere,
    select: { id: true, userId: true },
  });

  // Prepare notifications for each matching jobseeker
  const notifications = matchingJobSeekers.map((jobSeeker) => ({
    clientId: req.body.client,
    jobSeekerId: jobSeeker.id,
    notificationType: "job-match",
    notificationTitle: "New Job Available!",
    notificationMessage: `A new job matching your skills (${jobCategory}) has been posted.`,
    relatedIds: [jobPost.id],
    isRead: false,
    createdAt: new Date(),
  }));

  if (notifications.length > 0) {
    const notifResult = await prisma.notification.createMany({
      data: notifications,
    });
    console.log(
      `Notifications created: ${notifResult.count} for jobPost ${jobPost.id}`,
      notifications
    );
  } else {
    console.log(
      `No notifications created for jobPost ${jobPost.id}. Matching job seekers:`,
      matchingJobSeekers
    );
  }

  res.status(201).json(jobPost);
};

export const getClientListings = async (req, res) => {
  const response = await prisma.jobRequest.findMany({
    where: { clientId: req.query.client },
  });

  res.json(response);
};

export const getSingleJobListing = async (req, res) => {
  const response = await prisma.jobRequest.findFirst({
    where: { id: req.query.jobID },
  });

  res.json(response);
};

export const deleteClientListings = async (req, res) => {
  const response = await prisma.jobRequest.delete({
    where: { id: req.query.jobID },
  });

  if (response && response.jobImage > 0) {
    const parseDir = response.jobImage[0].split("/");
    parseDir.pop();
    const finalParsing = parseDir.join("/");

    fs.rm(finalParsing, { recursive: true });
  }

  res.status(200).json(`Successfully deleted job ID ${req.query.jobID}`);
};

export const editClientListings = async (req, res) => {
  let final_images = [];
  const folderPath =
    req.files && req.files.length > 0 ? req.files[0].destination : "";

  if (req.body.jobImage) {
    if (Array.isArray(req.body.jobImage)) {
      req.body.jobImage.forEach((imgURI) => final_images.push(imgURI));
    } else {
      final_images.push(req.body.jobImage);
    }
  }

  if (req.files.length > 0) {
    req.files.map((file) => final_images.push(file.path));
  }

  if (folderPath) {
    const existingImages = await fs.readdir(folderPath);
    existingImages.forEach((existing_img) => {
      if (!final_images.map((x) => x.split("/").pop()).includes(existing_img)) {
        fs.unlink(`${folderPath}/${existing_img}`);
      }
    });
  }

  const response = await prisma.jobRequest.update({
    where: { id: req.body.id },
    data: {
      jobTitle: req.body.jobTitle,
      jobDescription: req.body.description,
      category: req.body.category,
      budget: req.body.budget,
      jobDuration: req.body.jobDuration,
      jobLocation: req.body.jobLocation,
      jobImage: final_images,
    },
  });

  console.log("Successfully Edited Job Request!", response);
  res.status(200).json(response);
};

export const getJobRequests = async (req, res) => {
  try {
    const jobRequests = await prisma.jobRequest.findMany({
      where: {
        jobStatus: "open",
      },
      include: { client: true },
    });

    res.json(jobRequests);
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getJobSeekerTags = async (req, res) => {
  try {
    const jobSeekerId = req.user.id; // Adjust based on your auth setup

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

export const getMyJobs = async (req, res) => {
  try {
    // Get job seeker ID from auth token or session
    const jobSeekerId = req.user.id; // Adjust based on your auth setup

    const myJobs = await prisma.jobRequest.findMany({
      where: {
        jobSeekerId: jobSeekerId,
        jobStatus: {
          in: ["accepted", "pending", "completed"], // Only show accepted/pending jobs
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        datePosted: "desc",
      },
    });

    res.json(myJobs);
  } catch (error) {
    console.error("Error fetching job seeker's jobs:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const markJobAsCompleted = async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobSeekerId = req.user.id; // Adjust based on your auth setup

    // Verify job exists and belongs to this job seeker
    const job = await prisma.jobRequest.findFirst({
      where: {
        id: jobId,
        jobSeekerId: jobSeekerId,
      },
    });

    if (!job) {
      return res
        .status(404)
        .json({ error: "Job not found or not assigned to you" });
    }

    // Update job status
    const updatedJob = await prisma.jobRequest.update({
      where: { id: jobId },
      data: {
        jobStatus: "completed",
        completedAt: new Date(),
      },
      include: {
        client: true,
      },
    });

    res.json(updatedJob);
  } catch (error) {
    console.error("Error marking job as completed:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const reviewnRating = async (req, res) => {
  const jobId = req.params.id; // Changed from id to jobId for clarity
  const { rating, feedback, reviewerId, reviewedId, userType } = req.body;
  console.log(req.body);
  console.log(
    "jobId:",
    jobId,
    "reviewerId:",
    reviewerId,
    "reviewedId:",
    reviewedId,
    "rating:",
    rating,
    "review",
    feedback
  );

  // Validation
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      message: "Valid rating (1-5) is required.",
    });
  }
  if (!reviewedId) {
    return res.status(400).json({
      message: "reviewedId (reviewee) is required.",
    });
  }

  try {
    // 1. Verify job exists and is complete
    const job = await prisma.jobRequest.findUnique({
      where: { id: jobId },
      select: {
        jobStatus: true,
        clientId: true,
        jobSeekerId: true,
      },
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    // 2. Check if reviewer is a participant
    const isValidReviewer =
      reviewerId === job.clientId || reviewerId === job.jobSeekerId;

    if (!isValidReviewer) {
      return res.status(403).json({
        message: "Only job participants can leave reviews.",
      });
    }

    // 3. Create review
    const review = await prisma.review.create({
      data: {
        jobRequestId: jobId,
        reviewerId,
        reviewedId,
        rating,
        feedback,
      },
      include: {
        reviewer: {
          select: {
            firstName: true,
            profileImage: true,
          },
        },
      },
    });

    // --- Increment jobsDone for the reviewee ---
    await prisma.user.update({
      where: { id: reviewedId },
      data: {
        jobsDone: { increment: 1 },
      },
    });

    // --- Create notification for review ---
    await prisma.notification.create({
      data: {
        clientId: userType === "client" ? reviewerId : job.clientId,
        jobSeekerId: userType === "job-seeker" ? reviewerId : reviewedId,
        notificationType: userType === "client" ? "review-jobseeker" : "review-client",
        notificationTitle: "You received a new review!",
        notificationMessage: `You have received a new review from ${review.reviewer.firstName}.`,
        relatedIds: [jobId],
        isRead: false,
        createdAt: new Date(),
      },
    });
    // --- End notification logic ---

    // 4. Update job status (optional)
    await prisma.jobRequest.update({
      where: { id: jobId },
      data: {
        verifiedAt: new Date(),
        jobStatus:
          userType === "client"
            ? "completed"
            : userType === "job-seeker"
            ? "reviewed"
            : undefined,
      },
    });

    res.status(201).json({
      message: "Review submitted successfully.",
      review,
    });
  } catch (error) {
    console.error("Review submission error:", error);
    res.status(500).json({
      message: "Failed to submit review.",
      error: error.message,
    });
  }
};

export const searchJobs = async (req, res) => {
  try {
    const { searchQuery, filter } = req.query;

    // Build the where clause for Prisma
    let whereClause = {
      jobStatus: "open", // Only show open jobs
    };

    // Add text search if searchQuery exists
    if (searchQuery) {
      whereClause.OR = [
        { jobTitle: { contains: searchQuery, mode: "insensitive" } },
        { jobDescription: { contains: searchQuery, mode: "insensitive" } },
        { category: { contains: searchQuery, mode: "insensitive" } },
        {
          client: {
            OR: [
              { firstName: { contains: searchQuery, mode: "insensitive" } },
              { lastName: { contains: searchQuery, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Add category filter if it exists and is not 'all'
    if (filter && filter !== "all") {
      whereClause.category = filter;
    }

    // Fetch jobs with client information
    const jobs = await prisma.jobRequest.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      orderBy: {
        datePosted: "desc",
      },
    });

    // Transform the response to include formatted client information
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription,
      category: job.category,
      jobLocation: job.jobLocation,
      budget: job.budget,
      jobDuration: job.jobDuration,
      jobImage: job.jobImage,
      datePosted: job.datePosted,
      client: {
        id: job.client.id,
        name: `${job.client.firstName} ${job.client.lastName}`,
        profileImage: job.client.profileImage,
      },
    }));

    // Get available categories (for dynamic filter options)
    const categories = await prisma.jobRequest.findMany({
      where: { jobStatus: "open" },
      select: { category: true },
      distinct: ["category"],
    });

    res.json({
      jobs: formattedJobs,
      categories: categories.map((c) => c.category),
      total: formattedJobs.length,
    });
  } catch (error) {
    console.error("Error searching jobs:", error);
    res.status(500).json({
      error: "Failed to search jobs",
      details: error.message,
    });
  }
};

export const getTopCategories = async (req, res) => {
  try {
    // Get categories with their count, ordered by frequency
    const categoryStats = await prisma.jobRequest.groupBy({
      by: ["category"],
      _count: {
        category: true,
      },
      where: {
        // Optionally filter only open jobs
        jobStatus: "open",
      },
      orderBy: {
        _count: {
          category: "desc",
        },
      },
      take: 10, // Limit to top 10
    });

    // Transform the response to a simpler format
    const formattedCategories = categoryStats.map((stat) => ({
      category: stat.category,
      count: stat._count.category,
    }));

    res.json({
      categories: formattedCategories,
      total: formattedCategories.length,
    });
  } catch (error) {
    console.error("Error fetching top categories:", error);
    res.status(500).json({
      error: "Failed to fetch top categories",
      details: error.message,
    });
  }
};

export const searchJobSeekers = async (req, res) => {
  const { query, category, page = 1, limit = 10 } = req.query;

  try {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const whereClause = {
      userType: "job-seeker",
    };

    if (query) {
      whereClause.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { middleName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ];
    }

    let allMatchingJobSeekers = await prisma.user.findMany({
      where: whereClause,
      include: {
        jobSeeker: true,
      },
      orderBy: {
        firstName: "asc",
      },
    });

    let filteredJobSeekers = allMatchingJobSeekers;

    if (category) {
      const lowerCaseCategory = category.toLowerCase();
      filteredJobSeekers = allMatchingJobSeekers.filter((user) =>
        user.jobSeeker?.jobTags?.some(
          (tag) => tag.toLowerCase() === lowerCaseCategory
        )
      );
    }

    const totalJobSeekers = filteredJobSeekers.length;
    const paginatedJobSeekers = filteredJobSeekers.slice(
      (pageNum - 1) * limitNum,
      pageNum * limitNum
    );

    res.json({
      data: paginatedJobSeekers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalJobSeekers,
        totalPages: Math.ceil(totalJobSeekers / limitNum),
      },
    });
  } catch (error) {
    console.error("Error searching job seekers:", error);
    res.status(500).json({ error: "Failed to search job seekers" });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // Assumes authentication middleware sets req.user
    const userType = req.user.userType; // e.g., "client" or "job-seeker"

    // Build the where clause based on user type
    let whereClause = {};
    if (userType === "client") {
      whereClause.clientId = userId;
    } else if (userType === "job-seeker") {
      // Find the jobSeekerId for this user
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (jobSeeker) {
        whereClause.jobSeekerId = jobSeeker.userId;
      } else {
        return res.status(404).json({ error: "Job seeker profile not found." });
      }
    } else {
      return res.status(400).json({ error: "Invalid user type." });
    }

    // Fetch notifications
    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    res.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

export const getJobRequestById = async (req, res) => {
  try {
    const { id } = req.params; // Get the job request ID from the URL parameter

    const jobRequest = await prisma.jobRequest.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!jobRequest) {
      return res.status(404).json({ error: "Job request not found" });
    }

    res.json(jobRequest);
  } catch (error) {
    console.error("Error fetching job request by id:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// // Optional: Add an endpoint to get recent searches if you want to persist them
// export const getRecentSearches = async (req, res) => {
//   try {
//     const userId = req.user.id; // Assuming you have user authentication

//     const recentSearches = await prisma.searchHistory.findMany({
//       where: {
//         userId: userId
//       },
//       orderBy: {
//         searchedAt: 'desc'
//       },
//       take: 5 // Limit to 5 recent searches
//     });

//     res.json(recentSearches);
//   } catch (error) {
//     console.error("Error fetching recent searches:", error);
//     res.status(500).json({ error: "Failed to fetch recent searches" });
//   }
// };

// // Optional: Add an endpoint to save recent searches
// export const saveRecentSearch = async (req, res) => {
//   try {
//     const userId = req.user.id; // Assuming you have user authentication
//     const { searchQuery } = req.body;

//     const search = await prisma.searchHistory.create({
//       data: {
//         userId: userId,
//         searchQuery: searchQuery,
//         searchedAt: new Date()
//       }
//     });

//     res.json(search);
//   } catch (error) {
//     console.error("Error saving search:", error);
//     res.status(500).json({ error: "Failed to save search" });
//   }
// };
