import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const signUp = async (req, res) => {
  if (req.body.userType == "jobSeeker") {
    const availability = req.body.availability.toLowerCase() === "true";

    const user = await prisma.user.create({
      data: {
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        suffixName: req.body.suffixName,
        gender: req.body.gender,
        age: parseInt(req.body.age),
        emailAddress: req.body.emailAddress,
        password: bcrypt.hashSync(req.body.password, 10),
        profileImage: req.file.filename,
        bio: req.body.bio,
        barangay: req.body.barangay,
        street: req.body.street,
        houseNumber: req.body.houseNumber,
        userType: req.body.userType,
        jobSeeker: {
          create: {
            availability: availability,
            hourlyRate: req.body.hourlyRate,
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
      age: parseInt(req.body.age),
      emailAddress: req.body.emailAddress,
      password: bcrypt.hashSync(req.body.password, 10),
      profileImage: req.file.filename,
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
