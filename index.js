const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http"); // Required for WebSockets
const { Server } = require("socket.io"); // Socket.io for real-time updates
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server for WebSockets
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow frontend access
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ispqqvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const taskDB = client.db("taskDB").collection("task");

    // Socket.io Connection
    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);
      
      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });

    /**
     * GET: Fetch all tasks
     */
    app.get("/alltask", async (req, res) => {
      try {
        const tasks = await taskDB.find({}).toArray();
        res.status(200).json(tasks);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
      }
    });

    /**
     * POST: Add new task
     */
    app.post("/addnewtask",async(req,res)=>{
        const addCampaign =req.body;
        // console.log(addCampaign)
        const result = await taskDB.insertOne(addCampaign);
        res.send(result)
    })

    /**
     * PUT: Update a task
     */
    
    // API for updating task details (title, description)
// app.put('/tasks/:id/details', async (req, res) => {
//     try {
//       const { id } = req.params;
//       const { taskDetails } = req.body;
  
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ error: "Invalid task ID format" });
//       }
  
//       if (!taskDetails || !taskDetails.title || !taskDetails.description) {
//         return res.status(400).json({ error: "Task title and description are required" });
//       }
  
//       const updatedTask = await taskDB.findOneAndUpdate(
//         { _id: new ObjectId(id) },
//         { $set: { taskDetails } },
//         { returnDocument: "after" }
//       );
  
//       if (!updatedTask.value) {
//         return res.status(404).json({ error: "Task not found" });
//       }
  
//       io.emit("taskUpdated", updatedTask.value); // Emit real-time event to clients
  
//       res.json({ message: "Task details updated successfully", updatedTask: updatedTask.value });
//     } catch (error) {
//       res.status(500).json({ error: "Internal Server Error", details: error.message });
//     }
//   });
app.put("/updatedetailstasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedFields = req.body;
      const result = await taskDB.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedFields }
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Assuming you are using Express.js
  app.put("/reorderTasks", async (req, res) => {
    try {
      const tasks = req.body; // The reordered task list sent from the frontend
  
      if (!Array.isArray(tasks)) {
        return res.status(400).send("Invalid request format. Expected an array of tasks.");
      }
  
      // Loop through each task in the ordered list
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        // Check if the task has a valid id and position
        if (!task._id || task.position === undefined) {
          return res.status(400).send(`Task with ID ${task._id} has missing data.`);
        }
  
        // Update each task's position in the database
        const result = await taskDB.updateOne(
          { _id: new ObjectId(task._id) },
          { $set: { position: i } } // Set the position to the current index
        );
  
        if (result.modifiedCount === 0) {
          return res.status(404).send(`Task with ID ${task._id} not found.`);
        }
      }
  
      // Respond with success if all tasks are updated
      res.status(200).send("Tasks reordered successfully");
    } catch (error) {
      console.error("Error reordering tasks:", error);
      res.status(500).send("Error reordering tasks");
    }
  });
  
  
  
  
  // API for updating task category

  app.put("/taskscategoryupdate/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { category } = req.body;

        // Validate category
        const validCategories = ["To-Do", "In Progress", "Done"];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: "Invalid category" });
        }

        const result = await taskDB.updateOne(
            { _id: new ObjectId(id) },
            { $set: { category } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Task not found or category unchanged" });
        }

        res.json({ message: "Task category updated successfully", result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
//   app.put('/tasks/:id/category', async (req, res) => {
//     try {
//       const { id } = req.params;
//       const { category } = req.body;
  
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ error: "Invalid task ID format" });
//       }
  
//       if (!category) {
//         return res.status(400).json({ error: "Category is required" });
//       }
  
//       const updatedTask = await taskDB.findOneAndUpdate(
//         { _id: new ObjectId(id) },
//         { $set: { category } },
//         { returnDocument: "after" }
//       );
  
//       if (!updatedTask.value) {
//         return res.status(404).json({ error: "Task not found" });
//       }
  
//       io.emit("taskUpdated", updatedTask.value); // Emit real-time event to clients
  
//       res.json({ message: "Task category updated successfully", updatedTask: updatedTask.value });
//     } catch (error) {
//       res.status(500).json({ error: "Internal Server Error", details: error.message });
//     }
//   });
  
  

    /**
     * DELETE: Remove a task
     */
    app.delete("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid task ID format" });
        }

        const result = await taskDB.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Task not found" });
        }

        io.emit("taskDeleted", id); // Emit real-time event to clients

        res.json({ message: "Task deleted successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete task", details: error.message });
      }
    });

    // Home Route
    app.get("/", (req, res) => {
      res.send("Task Manager server is running with WebSockets");
    });

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);

// Start Server
server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
