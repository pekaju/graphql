const express = require("express");
const axios = require("axios");
const btoa = require("btoa");
const path = require("path");
const cookieParser = require("cookie-parser");
const ejs = require("ejs");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
const port = 3000;

var isEmail;

// Middleware to parse JSON data in the request body
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname + "/static")));

app.get("/", async (req, res) => {
  const jwt = req.cookies.jwt;
  if (jwt === undefined) {
    console.log("redirected")
    res.redirect("/login");
    return
  }
  axios
    .post(
      "https://01.kood.tech/api/graphql-engine/v1/graphql",
      {
        query: `
        {
          user {
            id
            login
            campus
            lastName
            firstName
            auditRatio
            email
            totalUp
            totalDown
          }
          transaction(
            where: {
              path: {_regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$"}
              type: {_eq:"xp"}
            }
          ) {
            amount
            path
          }
          progress(
            where: {
              path: {_regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$"}
              isDone: {_eq: true}
            }
          ) {
            results {
              grade
            }
          }
        }
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )
    .then((response) => {
      const userData = response.data.data.user[0];
      const transactionData = response.data.data.transaction;
      const progress = response.data.data.progress;
      res.render("index", { userData: userData, xpGraph: transactionData })});
});
app.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.redirect("/login");
  return
});

app.get("/login", (req, res) => {
  if (req.cookies.jwt) {
    res.redirect("/");
  } else {
    res.render("login");
  }
  return
});
// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  isEmail = false;
  if (username.includes("@")) {
    isEmail = true;
  }
  // Determine the credentials based on the provided input (username:password or email:password)
  const credentials = `${username}:${password}`;
  const encodedCredentials = btoa(credentials); // Base64 encoding

  // Make a POST request to the signin endpoint with the encoded credentials
  axios
    .post(
      "https://01.kood.tech/api/auth/signin",
      {},
      {
        headers: {
          Authorization: `Basic ${encodedCredentials}`,
        },
      }
    )
    .then((response) => {
      // Extract the JWT token from the response
      const jwt = response.data;
      // Store the JWT token securely (e.g., in local storage or a cookie)
      res.cookie("jwt", jwt, { httpOnly: true }); // Set the cookie 'jwt' with the JWT token
      res.send({ result: "success" });
    })
    .catch((error) => {
      // Handle invalid credentials or other errors
      console.error("Login failed:", error);
      res.status(401).json({ message: "Invalid credentials" });
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});