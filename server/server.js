import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";

const port = process.env.PORT || 3000;
connectDB();
const server = http.createServer(app);
server.listen(port, () => {
  console.log(
    `Server is running on port ${port} in ${process.env.NODE_ENV || "development"} mode`,
  );
});
