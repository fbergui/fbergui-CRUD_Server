import http from "http";
import https from "https";
import url from "url";
import fs from "fs";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import express from "express";

// config
const cors = require('cors')
const HTTP_PORT = 1337;
const HTTPS_PORT = 1338
dotenv.config({ path: ".env" });
const app = express();
const connectionString: any = process.env.connectionString;
const DBNAME = "5b";
const whitelist = ["http://localhost:1337", "https://localhost:1338", "https://fberguis-server.onrender.com",
  "https://cordovaapp"];
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { "key": privateKey, "cert": certificate };

//CREAZIONE E AVVIO DEL SERVER HTTP

let httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  init();
});

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
  console.log("Server in ascolto sulle porte HTTP:" + HTTP_PORT + ", HTTPS:" + HTTPS_PORT);
});

let paginaErrore: string = "";
function init() {
  fs.readFile("./static/error.html", function (err: any, data: any) {
    if (!err)
      paginaErrore = data.toString();
    else
      paginaErrore = "<h1>Risorsa non trovata</h1>"
  });
}

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (!origin) // browser direct call
      return callback(null, true);
    if (whitelist.indexOf(origin) === -1) {
      var msg = `The CORS policy for this site does not
 allow access from the specified Origin.`
      return callback(new Error(msg), false);
    }
    else
      return callback(null, true);
  },
  credentials: true
};

/***********MIDDLEWARE****************/
// 1 request log
app.use("/", (req: any, res: any, next: any) => {
  console.log(req.method + ": " + req.originalUrl);
  next();
});

// 2 gestione delle risorse statiche
//cerca le risorse nella cartella segnata nel path e li restituisce
app.use("/", express.static("./static"));

// 3 lettura dei parametri POST
app.use("/", express.json({ limit: "50mb" }));
app.use("/", express.urlencoded({ limit: "50mb", extended: true }));

// 4 log dei parametri get e post
app.use("/", (req: any, res: any, next: any) => {
  // parametri get .query, post .body
  if (Object.keys(req.query).length != 0) {
    console.log("---> Parametri GET: " + JSON.stringify(req.query));
  }
  if (Object.keys(req.body).length != 0) {
    console.log("---> Parametri BODY: " + JSON.stringify(req.body));
  }
  next();
});
app.use("/", cors(corsOptions));

// Apertura della connessione
app.use("/api/", (req: any, res: any, next: any) => {
  let connection = new MongoClient(connectionString);
  connection
    .connect()
    .catch((err: any) => {
      res.status(503);
      res.send("Errore di connessione al DB");
    })
    .then((client: any) => {
      req["client"] = client;
      next();
    });
});

/***********USER LISTENER****************/
app.get("/api/getCollections", (req: any, res: any, next: any) => {
  let db = req.client.db(DBNAME);
  // Leggo tutte le collezioni del DB
  db.listCollections().toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore lettura connesioni");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.get(
  "/api/richiestaParams/:gender/:hair",
  (req: any, res: any, next: any) => {
    let gender = req.params.gender;
    let hair = req.params.hair;

    let collection = req.client.db(DBNAME).collection("unicorns");
    collection.find({ gender, hair }).toArray((err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req.client.close();
    });
  }
);

app.get("/api/:collection", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let param = req.query;

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.find(param).toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      let response = [];
      for (const item of data) {
        let key = Object.keys(item)[1];
        response.push({ _id: item["_id"], val: item[key] });
      }
      res.send(response);
    }
    req.client.close();
  });
});

app.get("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.findOne({ _id: id }, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.delete("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.deleteOne({ _id: id }, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.patch("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.updateOne(
    { _id: id },
    { $set: req.body.stream },
    (err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req.client.close();
    }
  );
});

app.put("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.replaceOne({ _id: id }, req.body.stream, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.post("/api/:collection", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let params = req.body.stream;

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.insertOne(params, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

/***********DEFAULT ROUTE****************/

app.use("/", (req: any, res: any, next: any) => {
  res.status(404);
  if (req.originalUrl.startsWith("/api/")) {
    res.send("API non disponibile");
    req.client.close();
  } else {
    res.send(paginaErrore);
  }
});

app.use("/", (err: any, req: any, res: any, next: any) => {
  if (req.client) {
    req.client.close();
  }
  console.log("SERVER ERROR " + err.stack);
  res.status(500);
  res.send(err.message);
});