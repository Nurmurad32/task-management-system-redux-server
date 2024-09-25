const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { hashPassword, comparePassword } = require('./helpers/auth');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 3000;

// Middleware
const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // Update with your frontend URL
  credentials: true,
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.frhdrfe.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    console.log("Auth user",user)
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const taskCollection = client.db("TaskDB").collection("tasks")
    const userCollection = client.db("TaskDB").collection("users")

    //------------- Users APIs ----------------
    app.post("/signup", async (req, res) => {
      try {
        const { name, email, password } = req.body.formData;
        console.log('Signup:', name, email, password);

        // Validate input
        if (!name || !email || !password) {
          return res.status(400).json({ error: "Please provide name, email, and password." });
        }

        // Check if email already exists
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ error: "Email is already taken." });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Insert new user
        const newUser = {
          name,
          email,
          password: hashedPassword,
          createdAt: new Date()
        };
        const result = await userCollection.insertOne(newUser);

        // Generate JWT Token
        const token = jwt.sign(
          { id: result.insertedId, name: newUser.name, email: newUser.email },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // Return user data and token
        const userResponse = {
          id: result.insertedId,
          name: newUser.name,
          email: newUser.email,
        };

        res.status(201).json({ user: userResponse, token });
      } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ error: "Server error during signup." });
      }
    });

    // Login Route
    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body.formData;
        console.log('Login:', email, password);

        // Validate input
        if (!email || !password) {
          return res.status(400).json({ error: "Please provide email and password." });
        }

        // Find user by email
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(400).json({ error: "Invalid credentials." });
        }

        // Compare password
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: "Invalid credentials." });
        }

        // Generate JWT Token
        const token = jwt.sign(
          { id: user._id, name: user.name, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // Return user data and token
        const userResponse = {
          id: user._id,
          name: user.name,
          email: user.email,
        };

        res.status(200).json({ user: userResponse, token });
      } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: "Server error during login." });
      }
    });

    // Logout Route (Optional since JWT is stateless)
    app.post('/logout', (req, res) => {
      // On frontend, simply remove the token from localStorage
      res.status(200).json({ message: "Logout successful." });
    });

    // Get User Profile
    app.get('/profile', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;
        const filter = { _id: new ObjectId(id) };
        const user = await userCollection.findOne(filter);
        if (!user) {
          return res.status(404).json({ error: "User not found." });
        }
        res.status(200).json({ user });
      } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: "Server error while fetching profile." });
      }
    });

    // Update User Profile (Name & Password)
    app.patch('/profile', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;
        const { name, password } = req.body;

        // Validate input
        if (!name && !password) {
          return res.status(400).json({ error: "Please provide name or password to update." });
        }

        const updateFields = {};
        if (name) updateFields.name = name;
        if (password) {
          const hashedPassword = await hashPassword(password);
          updateFields.password = hashedPassword;
        }

        const updateResult = await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: updateFields }
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ error: "No changes were made." });
        }

        // Fetch updated user
        const updatedUser = await userCollection.findOne(
          { _id: new ObjectId(userId) },
          { projection: { password: 0 } }
        );

        res.status(200).json({ message: "Profile updated successfully.", user: updatedUser });
      } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ error: "Server error while updating profile." });
      }
    });

    //------------- Tasks APIs ----------------
    app.get('/tasks', async (req, res) => {
      try {
        const { priority, status, sortBy, order } = req.query;

        // Build the filter object
        const filter = {};
        if (priority && priority !== 'All') {
          filter.priority = priority;
        }
        if (status && status !== 'All') {
          filter.status = status;
        }

        // Define sort order
        const sortOrder = order === 'desc' ? -1 : 1;

        // Define priority mapping
        const priorityMapping = {
          'High': 1,
          'Medium': 2,
          'Low': 3,
        };

        // Build the aggregation pipeline
        const pipeline = [
          { $match: filter },
        ];

        if (sortBy === 'priority') {
          pipeline.push({
            $addFields: {
              priorityValue: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$priority', 'High'] }, then: 1 },
                    { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
                    { case: { $eq: ['$priority', 'Low'] }, then: 3 },
                  ],
                  default: 4,
                },
              },
            },
          });
          pipeline.push({ $sort: { priorityValue: sortOrder } });
        } else if (sortBy === 'dueDate') {
          pipeline.push({ $sort: { dueDate: sortOrder } });
        } else {
          // Default sort (optional)
          pipeline.push({ $sort: { createdAt: -1 } });
        }

        const result = await taskCollection.aggregate(pipeline).toArray();

        res.send(result);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.get('/tasks/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }

        const result = await taskCollection.findOne(query);
        res.send(result);
      }
      catch {
        (err) => res.send(err)
      }
    })

    app.post('/tasks', async (req, res) => {
      try {
        const task = req.body;
        const result = await taskCollection.insertOne(task)

        res.status(200).json({ message: "Task Created Successfully", result: result })
      }
      catch {
        (err) => res.send(err)
      }
    })

    app.patch('/tasks/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const detailTask = await taskCollection.findOne(filter);

        const updatedTask = req.body;
        console.log("updatedUser-role", updatedTask);

        const task = {
          $set: {
            title: updatedTask.title || detailTask.title,
            description: updatedTask.description || detailTask.description,
            dueDate: updatedTask.dueDate || detailTask.dueDate,
            priority: updatedTask.priority || detailTask.priority,
            status: updatedTask.status || detailTask.status,

          }
        };
        const result = await taskCollection.updateOne(filter, task);
        res.send(result);
      }
      catch {
        (err) => res.send(err)
      }
    });

    app.delete('/tasks/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await taskCollection.deleteOne(query);
        res.send(result);
      }
      catch {
        (err) => res.send(err)
      }
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// --------------------------------------------------------------

app.get('/', (req, res) => {
  res.json('Task Server.....')
})

app.listen(port, () => {
  console.log(`Task Server is sitting on port ${port}`)
})