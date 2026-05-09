require("dotenv").config();
const { MongoClient } = require("mongodb");
const mongoUrl = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/?retryWrites=true&w=majority`;
const client = new MongoClient(mongoUrl);

async function connectToDatabase() {
  await client.connect();
}

connectToDatabase().catch(console.error);

module.exports = { client };
async function connectToDatabase() {
  await client.connect();
  console.log("Connected to MongoDB");
}
