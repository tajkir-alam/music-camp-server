require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2ziqne.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const dbConnect = async () => {
    try {
        client.connect();
        console.log("Database Connected Successfully✅");

    } catch (error) {
        console.log(error.name, error.message);
    }
}
dbConnect()



const courseCollection = client.db("musicCampDB").collection("courses");
const userCollection = client.db("musicCampDB").collection("users");
const cartCollection = client.db("musicCampDB").collection("carts");
const paymentCollection = client.db("musicCampDB").collection("payments");


app.get('/', (req, res) => {
    res.send('hello')
})

// JWT Token
app.post('/jwt', (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '2h' });
    res.send({ token });
})

// JWT middleware
const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user?.role !== 'Admin') {
        return res.status(403).status({ error: true, message: 'Forbidden unauthorize access' });
    }
    next();
}

// ----- Checking the role of an user -----
// Checking Admin or not
app.get('/users/admin/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;
    const userEmail = req.decoded?.email;
    if (userEmail !== email) {
        return res.send({ role: false })
    };
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const result = { role: user?.role === 'Admin' };
    res.send(result);
})

// Checking instructor or not
app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;
    const userEmail = req.decoded?.email;
    if (userEmail !== email) {
        return res.send({ role: false })
    };
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const result = { role: user?.role === 'Instructor' };
    res.send(result);
})

// Checking student or not
app.get('/users/student/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;
    const userEmail = req.decoded?.email;
    if (userEmail !== email) {
        return res.send({ role: false })
    };
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const result = { role: user?.role === 'Student' };
    res.send(result);
})



// ----- Admin Section -----

// ------ User Section ------
app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result)
})

// User creating
app.post('/users', async (req, res) => {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
        return res.send({ message: 'User already exist' });
    }
    const result = await userCollection.insertOne(user);
    res.send(result)
})

app.patch('/users/admin/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateUserRole = {
        $set: {
            role: 'Admin'
        },
    };
    const result = await userCollection.updateOne(filter, updateUserRole);
    res.send(result);
})

app.patch('/users/instructor/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateUserRole = {
        $set: {
            role: 'Instructor'
        },
    };
    const result = await userCollection.updateOne(filter, updateUserRole);
    res.send(result);
})


app.patch('/approve-class/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateUserRole = {
        $set: {
            status: 'Approved'
        },
    };
    const result = await courseCollection.updateOne(filter, updateUserRole);
    res.send(result);
})

app.patch('/deny-class/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateUserRole = {
        $set: {
            status: 'Denied'
        },
    };
    const result = await courseCollection.updateOne(filter, updateUserRole);
    res.send(result);
})

app.post('/feedback/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const {feedback} = req.body;
    const filter = { _id: new ObjectId(id) };
    const addFeedback = {
        $set: {
            feedBack: feedback
        }
    }
    const result = await courseCollection.updateOne(filter, addFeedback);
    res.send(result);
})

// ------ Instructor Section ------
app.get('/top-instructors', async (req, res) => {
    const limitIs = req.query.limit;
    const pipeline = [
        {
            $group: {
                _id: "$instructorEmail",
                instructorName: { $first: "$instructorName" },
                instructorImg: { $first: "$instructorImg" },
                totalStudents: { $sum: "$students" },
                classes: { $push: { name: "$name", students: "$students", image: "$image" } }
            }
        },
        {
            $project: {
                _id: 1,
                instructorName: 1,
                instructorImg: 1,
                totalStudents: 1,
                image: {
                    $let: {
                        vars: {
                            maxStudentsClass: {
                                $max: {
                                    $map: {
                                        input: "$classes",
                                        as: "class",
                                        in: {
                                            students: "$$class.students",
                                            image: "$$class.image"
                                        }
                                    }
                                }
                            }
                        },
                        in: "$$maxStudentsClass.image"
                    }
                }
            }
        },
        {
            $sort: {
                totalStudents: -1
            }
        },
        {
            $limit: 6
        }
    ];
    const result = await courseCollection.aggregate(pipeline).toArray();
    res.send(result);
})

app.get('/all-classes', async (req, res) => {
    const result = await courseCollection.find().toArray();
    res.send(result);
})


// ----- Instructors Section -----
// get instructors classes
app.get('/instructor-classes', verifyJWT, async (req, res) => {
    const email = req.decoded.email;
    const query = { instructorEmail: email };
    const result = await courseCollection.find(query).toArray();
    res.send(result);
})

app.get('/all-instructor', async (req, res) => {
    const pipeline = [
        // Group by instructorEmail and find the largest data for each email
        {
            $group: {
                _id: "$instructorEmail",
                largestData: { $max: "$students" },
                data: { $first: "$$ROOT" }
            }
        },
        // Sort the data based on instructorEmail or any other field
        {
            $sort: { students: -1 }
        },
        // Project the desired fields
        {
            $project: {
                _id: 0,
                instructorEmail: "$data.instructorEmail",
                students: "$largestData",
                instructorImg: "$data.instructorImg",
                instructorName: "$data.instructorName",
            }
        }
    ]
    const result = await courseCollection.aggregate(pipeline).toArray();
    res.send(result);
})

// ------ Class Section ------

// Classes for home limit with sort based students
app.get('/class', async (req, res) => {
    const limitIs = req.query.limit;
    const sortClasses = req.query.sort;
    const cursor = courseCollection.find().limit(limitIs ? parseInt(limitIs) : 100000000).sort(sortClasses ? { students: parseInt(sortClasses) } : {});
    const result = await cursor.toArray();
    res.send(result)
})

// All classes that are approved by admin
app.get('/classes', async (req, res) => {
    const query = { status: "Approved" };
    const cursor = courseCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

app.patch('/classes/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateSeats = {
        $inc: {
            availableSeats: -1,
            students: 1,
        },
    };
    const result = await courseCollection.updateOne(filter, updateSeats);
    res.send(result);
})

app.post('/course', verifyJWT, async (req, res) => {
    const item = req.body;
    const result = await courseCollection.insertOne(item);
    res.send(result)
})



// // ------ Cart Section ------
app.get('/added-to-cart', verifyJWT, async (req, res) => {
    const email = req.decoded.email;
    const query = { userEmail: email };
    const result = await cartCollection.find(query).toArray();
    res.send(result);
})

app.get('/cart', verifyJWT, async (req, res) => {
    const email = req.query.email;
    if (!email) {
        res.send([])
    }

    const decodedEmail = req.decoded.email;
    if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
    }

    const query = { userEmail: email };
    const cursor = cartCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

app.post('/cart', verifyJWT, async (req, res) => {
    const item = req.body;
    const result = await cartCollection.insertOne(item);
    res.send(result)
})

app.delete('/cart/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await cartCollection.deleteOne(query);
    res.send(result);
})


// Payment Section
app.post("/create-payment-intent", verifyJWT, async (req, res) => {
    const { totalPrice } = req.body;
    const amount = totalPrice * 100;
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],
    });
    res.send({
        clientSecret: paymentIntent.client_secret,
    });
})

app.get('/payment', verifyJWT, async (req, res) => {
    const email = req.decoded.email;
    const sortByDate = parseInt(req.query?.sort);
    const query = { customerEmail: email };
    const result = await paymentCollection.find(query).sort(sortByDate ? { date: -1 } : {}).toArray();
    res.send(result);
})

app.post('/payment', verifyJWT, async (req, res) => {
    const payment = req.body;
    const insertResult = await paymentCollection.insertOne(payment);

    const query = { _id: new ObjectId(payment.cartId) };
    const deleteResult = await cartCollection.deleteOne(query);

    res.send({ insertResult, deleteResult });
})


app.listen(port, () => {
    console.log(`Port is running on ${port}`);
})