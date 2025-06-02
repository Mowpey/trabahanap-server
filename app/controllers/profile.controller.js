import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userType } = req.query;

    if (userType === "client") {
      const client = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
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
        },
      });

      return res.status(200).json({
        userType: "client",
        ...client,
      });
    }

    if (userType === "job-seeker") {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
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
            },
          },
          achievement: true,
        },
      });

      if (jobSeeker) {
        const { user, ...jobSeekerData } = jobSeeker;
        return res.status(200).json({
          userType: "job-seeker",
          ...user,
          ...jobSeekerData,
        });
      }
    }

    return res.status(404).json({ message: "User profile not found" });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userType } = req.body;

    if (!userType) {
      return res.status(400).json({ message: "User type is required" });
    }

    if (userType === "client") {
      const updatedClient = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: req.body.firstName,
          middleName: req.body.middleName,
          lastName: req.body.lastName,
          profileImage: req.file ? req.file.path : undefined,
          emailAddress: req.body.emailAddress,
          suffixName: req.body.suffixName,
          gender: req.body.gender.toLowerCase(),
          birthday: new Date(req.body.birthday).toISOString(),
          barangay: req.body.barangay,
          street: req.body.street,
          houseNumber: req.body.houseNumber,
        },
      });
      console.log("Updated Client Profile (User Data)", updatedClient);
      return res.status(200).json(updatedClient);
    }

    if (userType === "job-seeker") {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!jobSeeker) {
        return res.status(404).json({ message: "JobSeeker not found" });
      }

      const updatedJobSeeker = await prisma.jobSeeker.update({
        where: { id: jobSeeker.id },
        data: {
          user: {
            update: {
              firstName: req.body.firstName,
              middleName: req.body.middleName,
              lastName: req.body.lastName,
              profileImage: req.file ? req.file.path : undefined,
              emailAddress: req.body.emailAddress,
              suffixName: req.body.suffixName,
              gender: req.body.gender.toLowerCase(),
              birthday: new Date(req.body.birthday).toISOString(),
              barangay: req.body.barangay,
              street: req.body.street,
              houseNumber: req.body.houseNumber,
            },
          },
        },
      });

      return res.status(200).json(updatedJobSeeker);
    }

    return res.status(400).json({ message: "Invalid user type" });
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateJobTags = async (req, res) => {
  try {
    const { userId } = req.params;
    const { jobTags } = req.body;

    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!jobSeeker) {
      return res.status(404).json({ message: "JobSeeker not found" });
    }

    const updatedJobSeeker = await prisma.jobSeeker.update({
      where: { id: jobSeeker.id },
      data: {
        jobTags: jobTags,
      },
    });

    console.log("Updated JobSeeker", updatedJobSeeker);
    return res.status(200).json(updatedJobSeeker);
  } catch (error) {
    console.error("Error updating job tags:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getJobSeekerProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params; // This is the User.id
    console.log(
      `[getJobSeekerProfileByUserId] Received request for User ID: ${userId}`
    ); // Added log

    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { userId: userId }, // Find JobSeeker by the unique userId (foreign key to User table)
      include: {
        user: {
          // Include related User data
          select: {
            id: true,
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
            bio: true,
            userType: true,
            jobsDone: true,
            joinedAt: true,
            verificationStatus: true,
          },
        },
        // You can include other JobSeeker specific relations here if needed
        // e.g., achievement: true, jobTags: true (jobTags is an enum array, handled differently)
      },
    });

    console.log(
      `[getJobSeekerProfileByUserId] Prisma findUnique result for userId ${userId}:`,
      jobSeeker
    ); // Added log

    if (!jobSeeker) {
      console.log(
        `[getJobSeekerProfileByUserId] No JobSeeker found for User ID: ${userId}. Returning 404.`
      ); // Added log
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    // Combine user data and jobSeeker specific data
    // The 'user' object is already nested under jobSeeker from the include
    // We might want to flatten it or structure it as the frontend expects.
    // For now, let's return a structure that clearly separates JobSeeker fields and User fields.
    const responsePayload = {
      jobSeekerId: jobSeeker.id, // This is the JobSeeker's own _id
      availability: jobSeeker.availability,
      credentials: jobSeeker.credentials,
      hourlyRate: jobSeeker.hourlyRate,
      rate: jobSeeker.rate,
      jobTags: jobSeeker.jobTags, // This is an array of enum JobTag
      // ... other JobSeeker specific fields
      user: jobSeeker.user, // Contains all the selected user fields
    };

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error(
      "[getJobSeekerProfileByUserId] Error fetching job seeker profile:",
      error
    ); // Enhanced log
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const uploadCredential = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Processing credential upload for userId:", userId);

    // Check if files are present
    if (!req.files || req.files.length === 0) {
      console.log("No files received in request");
      return res.status(400).json({ message: "No credential files uploaded" });
    }

    console.log(`Received ${req.files.length} files in memory`);

    // Find the JobSeeker first
    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { userId },
      select: { id: true, credentials: true },
    });

    if (!jobSeeker) {
      console.log(`JobSeeker not found for userId: ${userId}`);
      return res.status(404).json({ message: "JobSeeker not found" });
    }

    // Generate filenames and paths before writing to disk
    const uploadPath = "assets/profiles/";

    // Ensure directory exists
    fs.mkdirSync(uploadPath, { recursive: true });

    // Generate paths for each file
    const filePaths = req.files.map((file) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const filename =
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
      return uploadPath + filename;
    });

    console.log("Generated file paths:", filePaths);

    // Update database FIRST, before writing files
    // Ensure credentials is properly initialized as an array
    const currentCredentials = Array.isArray(jobSeeker.credentials)
      ? jobSeeker.credentials
      : [];
    const newCredentials = [...currentCredentials, ...filePaths];

    console.log("Updating database with credential paths");
    const result = await prisma.jobSeeker.update({
      where: { userId },
      data: { credentials: newCredentials },
    });

    console.log("Database updated successfully");

    // Now that database is updated, write files to disk
    const writeFilePromises = req.files.map((file, index) => {
      return new Promise((resolve, reject) => {
        fs.writeFile(filePaths[index], file.buffer, (err) => {
          if (err) {
            console.error(`Error writing file ${filePaths[index]}:`, err);
            reject(err);
          } else {
            console.log(
              `File ${index + 1} written successfully to ${filePaths[index]}`
            );
            resolve();
          }
        });
      });
    });

    // Process all file writes - if server restarts during this, database is already updated
    Promise.all(writeFilePromises)
      .then(() => {
        console.log("All files written successfully");
      })
      .catch((err) => {
        console.error("Error writing some files:", err);
      });

    return res.status(200).json({
      message: "Credentials uploaded successfully",
      credentials: result.credentials,
    });
  } catch (error) {
    console.error("Error in uploadCredential:", error);

    // Prisma-specific error handling
    if (error.code === "P2025") {
      return res.status(404).json({ message: "JobSeeker record not found" });
    }

    if (error.code && error.code.startsWith("P")) {
      return res.status(500).json({
        message: "Database error",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAchievements = async (req, res) => {
  try {
    const userId = req.params.userId;

    // 1. Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Fetch achievements directly by userId for the given user.
    // This assumes your Achievement model in schema.prisma has a 'userId' field
    // that correctly links to the User model's id.
    // If this field is missing or named differently in your schema, Prisma will error.
    const achievements = await prisma.achievement.findMany({
      where: { userId: userId }, // Querying by the userId field on the Achievement model
    });

    return res.status(200).json(achievements);
  } catch (error) {
    console.error("Error in getAchievements:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
