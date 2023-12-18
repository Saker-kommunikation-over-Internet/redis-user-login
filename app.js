import bodyParser from "body-parser";
import express from "express";
import { createClient } from "redis";
import session from "express-session";
import RedisStore from "connect-redis";

const app = express();
//Ansluter till Redis
const redisClient = createClient();
redisClient.connect();

// Låter oss hantera sessioner via Redis
const redisStore = new RedisStore({ client: redisClient, prefix: "session:" });

//Sätter upp all nödvändig middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "myUnsafeSecret",
    saveUninitialized: false,
    resave: false,
    store: redisStore,
  })
);

// Då den här ligger före app.use(express.static("public"))
// så körs den här först. ORDNINGEN ÄR VIKTIG!
// Om användaren är inloggad kör vi vidare användaren via next()
// Annars skickar vi "not permitted"
app.get("/protected", (req, res, next) => {
  if (req.session.isLoggedIn) {
    next();
  } else {
    res.status(401).send("Not permitted.");
  }
});

// Implementation 1 - Ett hårdkodat lösenord.
// Mycket bristfällig approach. Stöder bara en användare.
// Om en illvillig användare får tillgång till koden, får den också tillgång till lösenorden.
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "kristian" && password === "123") {
    req.session.isLoggedIn = true;
    res.redirect("/protected");
  } else {
    res.send("Invalid credentials");
  }
});

// Implementation 2 - Ett lösenord från databasen.
// Nu kan vi ha flera användare.
// Vi har dock fortfarande sårbarheten att om databasen läcker
// har användaren tillgång till alla lösenord. Undrar hur man löser det? 
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const dbPassword = await redisClient.get(`user:${username}`);
  if (password === dbPassword) {
    req.session.isLoggedIn = true;
    res.redirect("/protected");
  } else {
    res.status(401).send("Invalid Credentials");
  }
});

// Den här ska ligga sist. Då körs alla funktioner i respektive get först.
app.use(express.static("public"));

app.listen(8000);
