import mongoose from "mongoose";

const DATABASE_NAME = "silent";
const DEFAULT_MONGO_URI = `mongodb://127.0.0.1:27017/${DATABASE_NAME}`;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || DEFAULT_MONGO_URI,
      {
        dbName: DATABASE_NAME,
      },
    );

    console.log(
      `MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`,
    );
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
};

export default connectDB;
