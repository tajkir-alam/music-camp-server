const express = require('express');
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
// const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// Middleware
const corsConfig = {
    origin: '*',
    Credential: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}
app.use(cors(corsConfig));
app.use(express.json());

// const verifyJWT = (req, res, next) => {
//     const authorization = req.headers.authorization;
//     if (!authorization) {
//         return res.status(401).send({ error: true, message: 'unauthorized access' });
//     }

//     // bearer token
//     const token = authorization.split(' ')[1];

//     jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
//         if (err) {
//             return res.status(401).send({ error: true, message: 'unauthorized access' });
//         }
//         req.decoded = decoded;
//         next();
//     })
// }


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2ziqne.mongodb.net/?retryWrites=true&w=majority`;

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

        const courseCollection = client.db("musicCampDB").collection("courses");


        // JWT Token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '2h' });
            res.send({ token });
        })

        // JWT middleware
        // const verifyAdmin = async (req, res, next) => {
        //     const email = req.decoded.email;
        //     const query = { email: email };
        //     const user = await userCollection.findOne(query);
        //     if (user?.role !== 'admin') {
        //         console.log(user?.role);
        //         return res.status(403).status({ error: true, message: 'Forbidden unauthorize access' });
        //     }
        //     next();
        // }

        // ------ User Section ------
        // app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
        //     const result = await userCollection.find().toArray();
        //     res.send(result)
        // })

        // app.post('/users', async (req, res) => {
        //     const user = req.body;
        //     const query = { email: user.email };
        //     const existingUser = await userCollection.findOne(query);
        //     if (existingUser) {
        //         return res.send({ message: 'User already exist' });
        //     }
        //     const result = await userCollection.insertOne(user);
        //     res.send(result)
        // })

        // app.delete('/users/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await userCollection.deleteOne(query);
        //     res.send(result);
        // })

        // app.get('/users/admin/:email', verifyJWT, async (req, res) => {
        //     const email = req.params.email;
        //     const userEmail = req.decoded.email;
        //     if (userEmail !== email) {
        //         return res.send({ admin: false })
        //     };
        //     const query = { email: email };
        //     const user = await userCollection.findOne(query);
        //     const result = { admin: user?.role === 'admin' };
        //     res.send(result);
        // })

        // app.patch('/users/admin/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: new ObjectId(id) };
        //     const updateUserRole = {
        //         $set: {
        //             role: 'admin'
        //         },
        //     };
        //     const result = await userCollection.updateOne(filter, updateUserRole);
        //     res.send(result);
        // })


        // ------ Class Section ------
        app.get('/class', async (req, res) => {
            const limitIs = req.query.limit;
            const sortClasses = req.query.sort;

            const cursor = courseCollection.find().limit(limitIs ? parseInt(limitIs) : 10000000).sort(sortClasses ? { students: parseInt(sortClasses) } : {});
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/top-instructors', async (req, res) => {
            const limitIs = req.query.limit;

            const pipeline = [
                {
                    $group: {
                        _id: "$instructorEmail",
                        instructorName: { $first: "$instructorName" },
                        totalStudents: { $sum: "$students" },
                        classes: { $push: { name: "$name", students: "$students", image: "$image" } }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        instructorName: 1,
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

        app.get('/instructors', async (req, res) => {
            const result = await courseCollection.find().toArray();
            res.send(result);
        })

        // app.post('/class', verifyJWT, verifyAdmin, async (req, res) => {
        //     const newItem = req.body;
        //     const result = await menuCollection.insertOne(newItem);
        //     res.send(result);
        // })

        // app.delete('/class/:id', verifyJWT, verifyAdmin, async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await menuCollection.deleteOne(query);
        //     res.send(result);
        // })


        // ------ Review Section ------
        // app.get('/reviews', async (req, res) => {
        //     const cursor = reviewsCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result)
        // })


        // // ------ Cart Section ------
        // app.get('/cart', verifyJWT, async (req, res) => {
        //     const email = req.query.email;
        //     if (!email) {
        //         res.send([])
        //     }
        //     // const decodedEmail = req.decoded.email;
        //     // if(email !== decodedEmail){
        //     //     return res.status(403).send({error: true, message:"Forbidden access"});
        //     // }

        //     const decodedEmail = req.decoded.email;
        //     if (email !== decodedEmail) {
        //         return res.status(403).send({ error: true, message: 'forbidden access' })
        //     }

        //     const query = { email: email };
        //     const cursor = cartCollection.find(query);
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })

        // app.post('/cart', async (req, res) => {
        //     const item = req.body
        //     const result = await cartCollection.insertOne(item);
        //     res.send(result)
        // })

        // app.delete('/cart/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await cartCollection.deleteOne(query);
        //     res.send(result);
        // })


        // Payment Section
        // app.post("/create-payment-intent", verifyJWT, async (req, res) => {
        //     const { price } = req.body;
        //     const amount = price * 100;
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: "usd",
        //         payment_method_types: ['card']
        //     });
        //     res.send({
        //         clientSecret: paymentIntent.client_secret,
        //     });
        // })

        // app.post('/payment', verifyJWT, async (req, res) => {
        //     const payment = req.body;
        //     const insertResult = await paymentCollection.insertOne(payment);

        //     const query = { _id: { $in: payment.cartsItems.map(id => new ObjectId(id)) } };
        //     const deleteResult = await cartCollection.deleteMany(query);

        //     res.send({ insertResult, deleteResult });
        // })

        // // admin status
        // app.get('/admin-status', verifyJWT, verifyAdmin, async (req, res) => {
        //     const payment = await paymentCollection.find().toArray();
        //     const revenue = payment.reduce((sum, item) => sum + item.price, 0);
        //     const customers = await userCollection.estimatedDocumentCount();
        //     const products = await menuCollection.estimatedDocumentCount();
        //     const orders = await paymentCollection.estimatedDocumentCount();

        //     res.send({
        //         revenue,
        //         customers,
        //         products,
        //         orders
        //     })

        // })

        // app.get('/order-stats', async (req, res) => {
        //     const pipeline = [
        //         {
        //             $lookup: {
        //                 from: 'menu',
        //                 localField: 'menuItems',
        //                 foreignField: '_id',
        //                 as: 'menuItemsData'
        //             }
        //         },
        //         {
        //             $unwind: '$menuItemsData'
        //         },
        //         {
        //             $group: {
        //                 _id: '$menuItemsData.category',
        //                 count: { $sum: 1 },
        //                 total: { $sum: '$menuItemsData.price' }
        //             }
        //         },
        //         {
        //             $project: {
        //                 category: '$_id',
        //                 count: 1,
        //                 total: { $round: ['$total', 2] },
        //                 _id: 0
        //             }
        //         }
        //     ];

        //     const result = await paymentCollection.aggregate(pipeline).toArray()
        //     res.send(result)

        // })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('hello')
})

app.listen(port, () => {
    console.log(`Port is running on ${port}`);
})