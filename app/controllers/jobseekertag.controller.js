import { PrismaClient } from "@prisma/client";
import { ObjectId } from "mongodb"; // ✅ Import ObjectId

const prisma = new PrismaClient();

export const getJobSeekerTags = async (req, res) => {
  try {
    console.log("Logged-in User ID:", req.user.id);

    const jobSeeker = await prisma.jobSeeker.findFirst({
      where: { userId: req.user.id }, // ✅ Convert userId to ObjectId
      select: { jobTags: true },
    });

    console.log("JobSeeker Data:", jobSeeker);

    if (!jobSeeker) {
      return res.status(404).json({ error: "Job Seeker not found" });
    } 

    console.log("Job Seeker Tags:", jobSeeker.jobTags);
    res.json({ jobTags: jobSeeker.jobTags });

  } catch (error) {
    console.error("Error fetching job seeker tags:", error);
    res.status(500).json({ error: "Server error" });
  }
};
