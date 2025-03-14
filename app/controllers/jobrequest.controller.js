import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getJobRequests = async (req, res) => {
  try {
    const jobRequests = await prisma.jobRequest.findMany({
      where: {
        jobStatus: "Open", // ✅ Only fetch "Open" job requests
      },
      include: { client: true }, // ✅ Include client details
    });

    res.json(jobRequests);
    // console.log(jobRequests);
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res.status(500).json({ error: "Server error" });
  }
};

