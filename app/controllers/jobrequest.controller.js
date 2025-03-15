import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
