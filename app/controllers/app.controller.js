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
  await prisma.jobRequest.delete({
    where: { id: req.query.jobID },
  });

  res.send(`Successfully deleted job ID ${req.query.jobID}`);
};

export const editClientListings = async (req, res) => {
  let final_images = [];

  if (req.body.jobImage != undefined) {
    if (Array.isArray(req.body.jobImage)) {
      req.body.jobImage.forEach((imgURI) => final_images.push(imgURI));
    } else {
      final_images.push(req.body.jobImage);
    }
  }

  if (req.files.length > 0) {
    req.files.map((file) => final_images.push(file.path));
  }

  const response = await prisma.jobRequest.update({
    where: { id: req.body.id },
    data: {
      jobTitle: req.body.jobTitle,
      jobDescription: req.body.description,
      category: req.body.category,
      budget: req.body.budget,
      jobLocation: req.body.jobLocation,
      jobImage: final_images,
    },
  });

  res.status(200).json(response);
};
