import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const signUp = async (req, res) => {
  if (req.body.userType == "jobSeeker") {
    const user = await prisma.user.create({
      data: {
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        suffixName: req.body.suffixName,
        gender: req.body.gender,
        birthday: new Date(req.body.birthday).toISOString(),
        emailAddress: req.body.emailAddress,
        password: bcrypt.hashSync(req.body.password, 10),
        profileImage: req.file.path,
        bio: req.body.bio,
        barangay: req.body.barangay,
        street: req.body.street,
        houseNumber: req.body.houseNumber,
        userType: req.body.userType,
        jobSeeker: {
          create: {
            availability: req.body.availability.toLowerCase() === "true",
            hourlyRate: req.body.hourlyRate,
            jobTags: req.body.jobTags.split(","),
            achievement: {
              create: {
                achievementName: "Starter",
                jobRequired: "None",
                requiredJobCount: 0,
                achievementIcon: "./assets/achievements/starter.png",
              },
            },
            milestone: {
              create: {
                milestoneTitle: "Start of the Journey",
                milestoneDescription: "Successfully created an account",
                jobsCompleted: 0,
                experienceLevel: "1",
              },
            },
          },
        },
      },
      include: {
        jobSeeker: true,
      },
    });
    res.json(user);
  }

  const user = await prisma.user.create({
    data: {
      firstName: req.body.firstName,
      middleName: req.body.middleName,
      lastName: req.body.lastName,
      suffixName: req.body.suffixName,
      gender: req.body.gender,
      birthday: new Date(req.body.birthday).toISOString(),
      emailAddress: req.body.emailAddress,
      password: bcrypt.hashSync(req.body.password, 10),
      profileImage: req.file.path,
      bio: req.body.bio,
      barangay: req.body.barangay,
      street: req.body.street,
      houseNumber: req.body.houseNumber,
      userType: req.body.userType,
    },
  });
  res.json(user);
};
export default signUp;
