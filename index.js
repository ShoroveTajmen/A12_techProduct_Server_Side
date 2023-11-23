const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5001;


//middleware
const corsOptions = {
    origin: "*",
    credentials: true,
    optionSuccessStatus: 200,
  };
  app.use(cors(corsOptions));
  //access post body and convert into json format
  app.use(express.json());



  //for testing
app.get("/", (req, res) => {
    res.send("tech website server is running");
  });
  
  app.listen(port, () => {
    console.log(`tech website server is running on port ${port}`);
  });