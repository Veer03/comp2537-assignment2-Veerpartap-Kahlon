require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { isValidSession } = require("./utils.js");
const { client } = require("./databaseConnection.js");

const app = express();
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
  if (isValidSession(req)) {
    res.send(`
      <h1>Hello, ${req.session.name}!</h1>
      <a href="/members"><button>Go to Members Area</button></a><br><br>
      <a href="/logout"><button>Logout</button></a>
    `);
  } else {
    res.send(`
      <h1>Home</h1>
      <a href="/signup"><button>Sign up</button></a><br><br>
      <a href="/login"><button>Log in</button></a>
    `);
  }
});

app.get("/signup", (req, res) => {
  res.send(`
    <h2>create user</h2>
    <form action="/signupSubmit" method="POST">
      <input name="name" placeholder="name" /><br>
      <input name="email" placeholder="email" /><br>
      <input name="password" placeholder="password" type="password" /><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post("/signupSubmit", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name)
    return res.send('<p>Name is required.</p><a href="/signup">Try again</a>');
  if (!email)
    return res.send('<p>Email is required.</p><a href="/signup">Try again</a>');
  if (!password)
    return res.send(
      '<p>Password is required.</p><a href="/signup">Try again</a>',
    );

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const { error } = schema.validate({ name, email, password });
  if (error)
    return res.send(
      `<p>${error.details[0].message}</p><a href="/signup">Try again</a>`,
    );

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({ name, email, password: hashedPassword });

  req.session.authenticated = true;
  req.session.name = name;
  req.session.email = email;
  res.redirect("/members");
});

app.get("/login", (req, res) => {
  res.send(`
    <h2>log in</h2>
    <form action="/loginSubmit" method="POST">
      <input name="email" placeholder="email" /><br>
      <input name="password" type="password" placeholder="password" /><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post("/loginSubmit", async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const { error } = schema.validate({ email, password });
  if (error)
    return res.send('<p>Invalid input.</p><a href="/login">Try again</a>');

  const user = await userCollection.findOne({ email });
  if (!user)
    return res.send(
      '<p>Invalid email/password combination.</p><a href="/login">Try again</a>',
    );

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.send(
      '<p>Invalid email/password combination.</p><a href="/login">Try again</a>',
    );

  req.session.authenticated = true;
  req.session.name = user.name;
  req.session.email = user.email;
  res.redirect("/members");
});

app.get("/members", (req, res) => {
  if (!isValidSession(req)) return res.redirect("/");

  const images = ["cat1.jpg", "cat2.jpg", "cat3.jpg"];
  const randomImg = images[Math.floor(Math.random() * images.length)];

  res.send(`
    <h1>Hello, ${req.session.name}.</h1>
    <img src="/${randomImg}" width="300" /><br><br>
    <a href="/logout"><button>Sign out</button></a>
  `);
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("*", (req, res) => {
  res.status(404).send("<h1>Page not found - 404</h1>");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
