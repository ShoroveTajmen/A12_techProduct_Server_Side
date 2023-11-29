const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5001;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(cors());

//access post body and convert into json format
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.es62grd.mongodb.net/?retryWrites=true&w=majority`;

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
    const featuredProductsCollection = client
      .db("techProduct")
      .collection("featuredProduct");
    const reviewProductsCollection = client
      .db("techProduct")
      .collection("reviewProduct");
    const usersCollection = client.db("techProduct").collection("users");
    const paymentsCollection = client.db("techProduct").collection("payments");
    const couponsCollection = client.db("techProduct").collection("coupons");

    //*****jwt related api****
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //verify token middleware
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      //token get from header and header from localstorage
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized" });
        }
        req.decoded = decoded;
        next();
      });
      // next();
    };

    //use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //use verify moderator after verifyToken
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isModerator = user?.role === "moderator";
      if (!isModerator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //******users related API*****
    //get all users data
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users/moderator/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let moderator = false;
      if (user) {
        moderator = user?.role === "moderator";
      }
      res.send({ moderator });
    });

    //post email and pass in database
    app.post("/users", async (req, res) => {
      const user = req.body;
      //insert email if user doesn't exists:
      //you can do this many ways (1. email uniqque, 2. upsert, 3.simple checking)
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //patch method for set user role to admin
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );
    //patch method for set user role to moderator
    app.patch("/users/moderator/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "moderator",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //users delete api
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //******products related api******
    //get featured products by sorting real time
    app.get("/products", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });
    //get all products data by sorting status
    app.get("/allProducts", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ status: -1, createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //get product by specific email
    app.get("/userProducts", async (req, res) => {
      const { userEmail } = req.query;
      const result = await productsCollection
        .find({ OwnerEmail: userEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //get trending products by sorting vote count
    app.get("/productsByVote", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ upVote: -1 })
        .toArray();
      res.send(result);
    });

    //number of products count
    app.get("/productsCount", async (req, res) => {
      const count = await productsCollection.estimatedDocumentCount();
      res.send({ count });
    });

    //get product data by tag
    app.get("/productsByTags", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      console.log("pagination query", req.query);
      const { search } = req.query;
      let query = { status: "accepted" };
      if (search) {
        query.tags = { $regex: new RegExp(search, "i") };
      }
      const result = await productsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //get specific product id data
    app.get("/products/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    //post new product
    app.post("/products", async (req, res) => {
      const item = req.body;
      const result = await productsCollection.insertOne(item);
      res.send(result);
    });

    //patch method api for upvote
    app.patch("/upvote/:productId", async (req, res) => {
      const productId = req.params.productId;
      const userEmail = req.body.userEmail;
      //check if the user has already upvoted
      const hasUpVoted = await productsCollection.findOne({
        _id: new ObjectId(productId),
        upvotedBy: userEmail,
      });
      if (hasUpVoted) {
        return res.send({ message: "This user already added vote" });
      }
      //update the upvote count and store the user's email
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(productId) },
        {
          $inc: { upVote: 1 },
          $addToSet: { upvotedBy: userEmail },
        }
      );
      res.send(result);
    });

    //patch method for specific product update
    app.patch("/updateProduct/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          description: item.description,
          link: item.link,
          productName: item.productName,
          productPic: item.productPic,
          tags: item.tags,
        },
      };
      const result = await productsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //patch api to update product status accepted
    app.patch("/updateProductStatus1/:id", async (req, res) => {
      const id = req.params;
      const { status } = req.body;
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    });
    //patch api to update product status rejected
    app.delete("/deleteProduct/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const result = await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    //delete specific product
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    //*****Featured Product related API*****
    //get method for get featured product
    app.get("/featuredProducts", async (req, res) => {
      const result = await featuredProductsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //post method for stored featured product in the database
    app.post("/marksFeatured/:id", async (req, res) => {
      const { id } = req.params;
      //retrive the product from the productsCollection
      const product = await productsCollection.findOne({
        _id: new ObjectId(id),
      });
      const result = await featuredProductsCollection.insertOne(product);
      res.send(result);
    });

    //*****reported product API******
    //get method to load only reported products data
    app.get("/reportedPoducts", async (req, res) => {
      const result = await productsCollection
        .find({ reported: true })
        .toArray();
      res.send(result);
    });

    //patch method to set reported value true
    app.patch("/reportProduct/:id", async (req, res) => {
      const productId = req.params.id;
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { reported: true } }
      );
      res.send(result);
    });

    //*****product review related api*****
    //get specific products reviews
    app.get("/productReview/:id", async (req, res) => {
      const id = req.params.id;
      const query = { pId: id };
      const result = await reviewProductsCollection.find(query).toArray();
      res.send(result);
    });

    //post specific product reviews
    app.post("/productReview", async (req, res) => {
      const review = req.body;
      console.log(review);
      const result = await reviewProductsCollection.insertOne(review);
      res.send(result);
    });

    //******payment intent related API related API*****
    //get specific email related payment history
    app.get("/payments/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log("amount inside the intent", amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //post the payment history
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);
      console.log("payment info", payment);
      res.send(paymentResult);
    });

    //stats or analytics
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const allProducts = await productsCollection.estimatedDocumentCount();
      const reviews = await reviewProductsCollection.estimatedDocumentCount();

      res.send([users, allProducts, reviews]);
    });

    //*****Coupons related API *******/
    app.get("/coupons", async (req, res) => {
      const result = await couponsCollection.find().toArray();
      res.send(result);
    });

    //get specific product id data
    app.get("/coupons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponsCollection.findOne(query);
      res.send(result);
    });

    //post new coupon
    app.post("/coupons", async (req, res) => {
      const item = req.body;
      const result = await couponsCollection.insertOne(item);
      res.send(result);
    });

    //patch method for specific coupon update
    app.patch("/updateCoupon/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          amount: item.amount,
          code: item.code,
          date: item.date,
          description: item.description,
        },
      };
      const result = await couponsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //post method for get coupon discount
    app.post("/validateCoupon", async (req, res) => {
      const { code } = req.body;
        // Find the coupon in the database based on the code
        const coupon = await couponsCollection.findOne({ code });

        if (coupon) {
          // Check if the coupon is still valid based on the expiration date or any other criteria
          const currentDate = new Date();
          const couponExpirationDate = new Date(coupon.date);

          if (currentDate <= couponExpirationDate) {
            // Calculate the discounted amount (replace this with your actual logic)
            const discountedAmount = 0.5 * parseFloat(coupon.amount);

            res.json({ valid: true, discountedAmount });
          } else {
            // Coupon has expired
            res.json({ valid: false, message: "Coupon has expired" });
          }
        } else {
          // Coupon not found
          res.json({ valid: false, message: "Invalid coupon code" });
        }
    });

    //coupon delete api
    app.delete("/coupon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponsCollection.deleteOne(query);
      res.send(result);
    });

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
