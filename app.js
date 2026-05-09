require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { isValidSession } = require("./utils.js");
const { client } = require("./databaseConnection.js");

const app = express();
app.set("view engine", "ejs");
const PORT = process.env.PORT || 3000;
const saltRounds = 12;

const userCollection = client
  .db(process.env.MONGODB_DATABASE)
  .collection("users");

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

const mongoUrl = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/?retryWrites=true&w=majority`;

app.use(
  session({
    secret: process.env.NODE_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl,
      dbName: "sessions",
      crypto: { secret: process.env.MONGODB_SESSION_SECRET },
    }),
    cookie: { maxAge: 60 * 60 * 1000 },
  }),
);

app.get("/", (req, res) => {
  res.render("index", { session: req.session });
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signupSubmit", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name) return res.render("signup", { error: "Name is required." });
  if (!email) return res.render("signup", { error: "Email is required." });
  if (!password)
    return res.render("signup", { error: "Password is required." });

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const { error } = schema.validate({ name, email, password });
  if (error) return res.render("signup", { error: error.details[0].message });

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({
    name,
    email,
    password: hashedPassword,
    user_type: "user",
  });

  req.session.authenticated = true;
  req.session.name = name;
  req.session.email = email;
  req.session.user_type = "user";
  res.redirect("/members");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/loginSubmit", async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const { error } = schema.validate({ email, password });
  if (error) return res.render("login", { error: "Invalid input." });

  const user = await userCollection.findOne({ email });
  if (!user)
    return res.render("login", {
      error: "Invalid email/password combination.",
    });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.render("login", {
      error: "Invalid email/password combination.",
    });

  req.session.authenticated = true;
  req.session.name = user.name;
  req.session.email = user.email;
  req.session.user_type = user.user_type;
  res.redirect("/members");
});

app.get("/members", (req, res) => {
  if (!isValidSession(req)) return res.redirect("/");
  res.render("members", { name: req.session.name });
});

app.get("/admin", async (req, res) => {
  if (!isValidSession(req)) return res.redirect("/login");
  if (req.session.user_type !== "admin") {
    return res
      .status(403)
      .render("admin", {
        error: "You are not authorized to view this page.",
        users: null,
      });
  }
  const users = await userCollection.find().toArray();
  res.render("admin", { users, error: null });
});

app.post("/promoteUser", async (req, res) => {
  const { email } = req.body;
  await userCollection.updateOne({ email }, { $set: { user_type: "admin" } });
  res.redirect("/admin");
});

app.post("/demoteUser", async (req, res) => {
  const { email } = req.body;
  await userCollection.updateOne({ email }, { $set: { user_type: "user" } });
  res.redirect("/admin");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("*", (req, res) => {
  res.status(404).render("404");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
