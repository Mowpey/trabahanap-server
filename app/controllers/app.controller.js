import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const jobRequest = async (req, res) => {
  const jobPost = await prisma.jobRequest.create({
    data: {
      client: { connect: { id: req.body.client } },
      jobTitle: req.body.jobTitle,
      jobDescription: req.body.jobDescription,
      category: req.body.category,
      jobLocation: req.body.jobLocation,
      jobStatus: "open",
      budget: req.body.budget,
      jobStartDuration: new Date(Date.now()), //temporarily while waiting for the commit
      jobEndDuration: new Date(Date.now()), //temporarily while waiting for the commit
      jobImage: req.files.map((file) => file.path),
      jobRating: 0,
      jobReview: "",
      acceptedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
      completedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
      verifiedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
    },
  });

  console.log("Successfully posted the job request", jobPost);
};

export const getClientListings = async (req, res) => {
  const response = await prisma.jobRequest.findMany({
    where: { clientId: req.query.client },
  });

  res.json(response);
};
