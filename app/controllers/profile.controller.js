import { PrismaClient } from "@prisma/client";

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
      const updatedJobSeeker = await prisma.jobSeeker.update({
        where: { userId },
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
