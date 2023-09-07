const express = require("express");
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const cors = require("cors");
const port = process.env.PORT || 8000;

// middleware

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers?.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized access" });
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "Unauthorized access" })
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${ process.env.DB_USER }:${ process.env.DB_PASS }@cluster0.apl9htr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("bistroBossDB").collection("users");
    const menuCollection = client.db("bistroBossDB").collection("menu");
    const reviewCollection = client.db("bistroBossDB").collection("reviews");
    const cartCollection = client.db("bistroBossDB").collection("carts");

    // jwt function

    // app.post('/jwt', (req, res) => {
    //   const user = req.body;
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET)
    //   res.send({ token })
    // })

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      // console.log(token);
      res.send({ token });
    })




    // verify admin api

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      // console.log(email);
      const query = { email: email };
      const user = await usersCollection.findOne(query)
      if (user?.role !== "admin") {
        // return res.status(403).send({ error: true, message: "Forbidden access" })
        return res.send({ admin: false })
      }
      next()
    }

    // users related apis

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    // app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
    //   const email = req.params.email;
    //   console.log("admin email",email);
    //   if (req.decoded.email !== email) {
    //     res.send({ admin: false })
    //   }
    //   const query = { email: email }
    //   const user = await usersCollection.findOne(query)

    //   const result = { admin: user?.role === 'admin' }

    //   res.send(result)
    // })

    app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateUser = {
        $set: {
          role: "admin"
        },
      }
      const result = await usersCollection.updateOne(filter, updateUser);
      res.send(result);
    })


    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id
      const deleteUser = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(deleteUser)
      res.send(result);
    })


    // menu related apis


    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const result = await menuCollection.find(filter).toArray();
      res.send(result);

    })

    app.post("/menu",verifyJWT, verifyAdmin, async(req, res) =>{
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

    app.put("/menu/:id", async(req, res) =>{
      const id = req.params.id;
      const menu = req.body;
      const filter= {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updateMenu = {
        $set: {
          name: menu.name,
          recipe: menu.recipe,
          category: menu.category,
          price: menu.price

        },
      }
      const result = await menuCollection.updateOne(filter, updateMenu, options);
      res.send(result);
    })

    app.delete("/menu/:id", async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    })

    // review related apis

    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    // cart related apis

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([])
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "Forbidden access" })
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })


    // Create payment intent 
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const {price} = req.body;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Bistro Boss Database connected");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res) => {
  res.send("Bistro boss server is running")
})

app.listen(port, () => {
  console.log(`Bistro server listening on ${ port }`);
});
