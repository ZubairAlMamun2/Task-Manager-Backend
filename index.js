
const express=require('express');
const cors=require('cors')
require('dotenv').config()
const app=express();
const port=process.env.PORT||5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');





app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ispqqvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
let clients = [];

async function run() {
  try {
    const taskDB = client.db("taskDB").collection("task");


    app.get("/alltask", async (req, res) => {
        try {
          const tasks = await taskDB.find().toArray(); // Assuming `tasksCollection` is your MongoDB collection
          res.json(tasks);
        } catch (error) {
          console.error("Error fetching tasks:", error);
          res.status(500).json({ message: "Internal server error" });
        }
      });
    
    app.get("/pollForUpdates", async (req, res) => {
      try {
        // Add client to the polling list
        const clientObj = { res, timestamp: Date.now() };
        clients.push(clientObj);

        // Timeout after 30 seconds if there are no updates
        const timeout = setTimeout(() => {
          clients = clients.filter((c) => c !== clientObj); // Remove client from list after timeout
          res.status(200).json([]); // Send empty response if no updates
        }, 30000); // 30 seconds timeout

        // Check for updates and notify client
        const checkForUpdates = async () => {
          const tasks = await taskDB.find({}).toArray(); // Fetch tasks from the database
          if (tasks) {
            clearTimeout(timeout); // Clear timeout if there are updates
            clients = clients.filter((c) => c !== clientObj); // Remove client from list after update
            res.status(200).json(tasks); // Send updated tasks to the client
          }
        };

        // Trigger the check for updates
        checkForUpdates();
      } catch (error) {
        console.error("Error with long polling:", error);
        res.status(500).send("Internal Server Error");
      }
    });





    app.post("/addnewtask", async (req, res) => {
        try {
          const addCampaign = req.body;
          const result = await taskDB.insertOne(addCampaign);
          // Notify clients after adding a new task
          notifyClients();
          res.status(201).json(result);
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });


    app.put("/updatedetailstasks/:id", async (req, res) => {
        try {
          const { id } = req.params;
          const updatedFields = req.body;
  
          const result = await taskDB.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedFields }
          );
  
          if (result.modifiedCount > 0) {
            // Notify clients after the task update
            notifyClients();
            res.json(result);
          } else {
            res.status(404).json({ error: "Task not found or update failed" });
          }
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });


      app.put("/updateTaskOrder", async (req, res) => {
        try {
          const { tasks } = req.body; // Expecting tasks to be an array with new order
      
          if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ error: "Invalid task data" });
          }
      
          // Loop through each task and update its position in the database
          for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
      
            // Fix: Ensure correct field name (`position` instead of `order`)
            const updatedTask = await Task.findByIdAndUpdate(
              task._id, 
              { position: i }, // Update the `position` field
              { new: true }
            );
      
            if (!updatedTask) {
              return res.status(404).json({ error: `Task with ID ${task._id} not found` });
            }
          }
      
          // Send success response
          res.status(200).json({ message: "Tasks reordered successfully!" });
        } catch (error) {
          console.error("Error updating task order:", error); // Log the error details
          res.status(500).json({ error: "Failed to reorder tasks" });
        }
      });
      


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
  
          // Notify clients after task category update
          notifyClients();
          res.json({ message: "Task category updated successfully", result });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });

      app.put("/api/tasks/update-positions", async (req, res) => {
        try {
            const { sourceTaskId, targetTaskId } = req.body;  // sourceTaskId: the task being dragged, targetTaskId: the task being replaced
    
            // Get both tasks to be updated
            const sourceTask = await taskDB.findOne({ _id: new ObjectId(sourceTaskId) });
            const targetTask = await taskDB.findOne({ _id: new ObjectId(targetTaskId) });
    
            if (!sourceTask || !targetTask) {
                return res.status(404).json({ success: false, message: "One or both tasks not found" });
            }
    
            // Swap their positions
            const tempPosition = sourceTask.position;
            sourceTask.position = targetTask.position;
            targetTask.position = tempPosition;
    
            // Perform the bulk update operation to update the positions
            const bulkOperations = [
                {
                    updateOne: {
                        filter: { _id: new ObjectId(sourceTaskId) },
                        update: { $set: { position: sourceTask.position } },
                    },
                },
                {
                    updateOne: {
                        filter: { _id: new ObjectId(targetTaskId) },
                        update: { $set: { position: targetTask.position } },
                    },
                },
            ];
    
            await taskDB.bulkWrite(bulkOperations);
            res.json({ success: true, message: "Positions updated successfully" });
        } catch (error) {
            console.error("Error updating positions:", error);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    


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
  
          // Notify clients after the task is deleted
          notifyClients();
          res.json({ message: "Task deleted successfully" });
        } catch (error) {
          res.status(500).json({ error: "Failed to delete task", details: error.message });
        }
      });



    const notifyClients = async () => {
        try {
          const tasks = await taskDB.find({}).toArray(); // Fetch updated tasks
          clients.forEach((client) => {
            client.res.status(200).json(tasks); // Send updated tasks to each client
          });
          clients = []; // Clear the list of clients after notification
        } catch (error) {
          console.error("Error notifying clients:", error);
        }
      };


  } finally {

  }
}
run().catch(console.dir);




app.get("/",(req,res)=>{
    res.send("Task server is running")
})

app.listen(port,()=>{
    console.log(`server is running at ${port} `)
})