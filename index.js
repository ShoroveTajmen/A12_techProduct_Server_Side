const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();

const port = process.env.PORT || 5001;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
//access post body and convert into json format
app.use(express.json());


const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.es62grd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    //database collections
    const productsCollection = client.db("techProduct").collection("products");


    //products related api
    //get products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    //post new product
    app.post('/products', async (req, res) => {
      const item = req.body;
      const result = await productsCollection.insertOne(item);
      res.send(result);
    })

    //patch method api for upvote
    app.patch('/upvote/:productId', async (req, res) => {
        const productId = req.params.productId;
        const userEmail = req.body.userEmail;

        //check if the user has already upvoted
        const hasUpVoted = await productsCollection.findOne({
          _id: new ObjectId(productId),
          upvotedBy: userEmail,
        })
        if(hasUpVoted) {
          return res.send({message: 'This user already added vote'})
        }

        //update the upvote count and store the user's email
        const result = await productsCollection.updateOne(
          {_id: new ObjectId(productId)},
          {
            $inc: {upVote: 1},
            $addToSet: {upvotedBy: userEmail},
          }
        )
        res.send(result);
    })











    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {

  }
}
run().catch(console.dir);

//for testing
app.get("/", (req, res) => {
  res.send("tech website server is running");
});

app.listen(port, () => {
  console.log(`tech website server is running on port ${port}`);
});
