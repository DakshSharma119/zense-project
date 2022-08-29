//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { stringify } = require("querystring");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const dotenv = require("dotenv");
let alert = require('alert');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: "Our little secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://daksh:daksh123@cluster0.yk0xxfl.mongodb.net/foodDB");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
});

const orderSchema = new mongoose.Schema({
  name: String,
  price: Number,
  products: [
    {
      quantity: Number,
      name: String,
      price: Number,
    }]
});

const itemsSchema = {
  name: String,
  description: String,
  price: Number, 
};

// -------------------------------

const CartSchema = new mongoose.Schema(
  {
    userName: String,
    products: [
      {
        quantity: Number,
        name: String,
        price: Number,
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    modifiedOn: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", CartSchema);

const Order = mongoose.model("Order", orderSchema);

// -----------------------------------
const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
  name: "Maggie",
  description: "Maggie description",
  price: 20,
});

const item2 = new Item({
  name: "EggMaggie",
  description: "Egg Maggie description",
  price: 25,
});

const item3 = new Item({
  name: "Pepsi",
  description: "Pepsi description",
  price: 20,
});

const item4 = new Item({
  name: "Sandwich",
  description: "Sandwich description",
  price: 35,
});

const defaultItems = [item1, item2,item3,item4];

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/final", function (req, res) {
  if (req.isAuthenticated()){
  console.log(req.user.username);
  const today = new Date();
  const date = today.toLocaleDateString();
  const time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  console.log(time);
  console.log(date);
  Cart.findOne({ userName: req.user.username }, function (err, foundCart){
    var price =0;
    const newOrder=Order({
      name: req.user.username
    })
    foundCart.products.forEach(product => {
      if(product.quantity!=0){
        newOrder.products.push({
          name: product.name,
          quantity: product.quantity,
          price: product.price
        })
        price+=product.quantity*product.price;
      }

    });
    newOrder.price=price;
    newOrder.save();
    console.log(newOrder);
    
    res.render("confirm", { name: req.user.username, time: time, date: date,cartItems: foundCart.products});
    
    })
  
}
else{
  res.redirect("/login");
}
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/menu");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/menu", function (req, res) {
  if (req.isAuthenticated()) {
    Item.find({}, function (err, foundItems) {
      if (err) {
        console.log(err);
      } else {
        if (foundItems.length === 0) {
          Item.insertMany(defaultItems, function (err) {
            if (err) {
              console.log(err);
            } else {
              console.log("Successful");
            }
          });
        }
        Cart.findOne(
          { userName: req.user.username },
          function (err, foundCart) {
            if (err) {
              console.log(err);
            } else {
              if (foundCart) {
                console.log(foundCart);
                res.render("menu", {
                  newListItems: foundItems,
                  cart: foundCart
                });
              } else {
                const newCart = Cart({
                  userName: req.user.username,
                });
                console.log(foundItems);
                foundItems.forEach((item) => {
                  newCart.products.push({
                    quantity: 0,
                    name: item.name,
                    price: item.price,
                  });
                });
                newCart.save();
                console.log(newCart);
                res.render("menu", { newListItems: foundItems, cart: newCart });
              }
            }
          }
        );
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/viewCart", function (req, res) {
  if (req.isAuthenticated()) {
    Cart.findOne({ userName: req.user.username }, function (err, foundCart) {
      res.render("viewCart", { cartItems: foundCart.products });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function (req, res) {
  req.logOut(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/menu");
        });
      }
    }
  );
});

app.get("/delCart",function(req,res){
  if (req.isAuthenticated()){
  res.redirect("/menu")}
})

app.get("/loginfail",function(req,res){
  alert("Login failed try again or register")

  res.redirect("/login");
})

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local",{failureRedirect: '/loginfail'})(req, res, function () {
        res.redirect("/menu");
      });
    }
  });
});

// ---------------------------

app.post("/cart", function (req, res) {
  console.log(req.body);
  try {
    Cart.findOne({ userName: req.user.username }, function (err, foundCart) {
      if (err) {
        console.log(err);
      } else {
        if (foundCart) {
          let itemIndex = foundCart.products.findIndex(
            (p) => p.name === req.body.item
          );

          if (itemIndex > -1) {
            //product exists in the cart, update the quantity
            console.log("Update quantity");

            let productItem = foundCart.products[itemIndex];
            productItem.quantity = req.body.quantity;
            foundCart.products[itemIndex] = productItem;
          } else {
            //product does not exists in cart, add new item
            foundCart.products.push({
              quantity: req.body.quantity,
              name: req.body.item,
              price: req.body.price,
            });
          }
          foundCart = foundCart.save();
          res.redirect("/menu");
        } else {
          const newCart = Cart({
            userName: req.user.username,
            products: [
              {
                quantity: req.body.quantity,
                name: req.body.item,
                price: req.body.price,
              },
            ],
          });
          newCart.save();

          res.redirect("/menu");
        }
      }
    });
  } catch (err) {
    console.log("here");
    console.log(err);
    res.status(500).send("Something went wrong");
  }
});

// ---------------------------

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
