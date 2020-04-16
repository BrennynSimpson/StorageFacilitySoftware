const express = require('express');
const cors = require( "cors" );
const bodyParser = require('body-parser');
const model = require('./model');
const { resolve } = require('path');
// Replace if using a different env file or config
const env = require('dotenv').config({ path: "./.env" });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const server = express();
const port = process.env.PORT || 3000;

// Midleware
server.use(bodyParser.urlencoded({ extended: false}));
server.use(
    express.json({
      // We need the raw body to verify webhook signatures.
      // Let's compute it only when hitting the Stripe webhook endpoint.
      verify: function(req, res, buf) {
        if (req.originalUrl.startsWith('/webhook')) {
          req.rawBody = buf.toString();
        }
      }
    })
  );
server.use( cors( ) );
server.use(express.static(process.env.STATIC_DIR));

server.get('/', (req, res) => {
    const path = resolve(process.env.STATIC_DIR + '/index.html');
    res.sendFile(path);
  });
  
  server.get('/public-key', (req, res) => {
    res.send({ publicKey: process.env.STRIPE_PUBLISHABLE_KEY });
  });
  
  server.post('/create-customer', async (req, res) => {
    // This creates a new Customer and attaches
    // the PaymentMethod to be default for invoice in one API call.
    const customer = await stripe.customers.create({
      payment_method: req.body.payment_method,
      email: req.body.email,
      invoice_settings: {
        default_payment_method: req.body.payment_method
      }
    });
    var plan_id = ""
    if(req.body.plan == "8X10") {
      plan_id = "plan_GkVPOqIk9Mne5A"
    } else {
      plan_id = "plan_GkVPOqIk9Mne5A"
    }


    // At this point, associate the ID of the Customer object with your
    // own internal representation of a customer, if you have one.
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ plan: plan_id }],
      expand: ['latest_invoice.payment_intent']
    });
  
    res.send(subscription);
  });
  

  server.post('/subscription', async (req, res) => {
    let subscription = await stripe.subscriptions.retrieve(
      req.body.subscriptionId
    );
    res.send(subscription);
  });
  


// Get list of charges from Stripe
server.get("/charges", function(req, res){
    stripe.charges.list(
      {limit: 10},
      function(err, charges) {
      res.status(200);
      res.json( charges );
      })
  });

// Get list of customers from Stripe
server.get("/customers", function(req, res){
  stripe.customers.list(
    {limit: 10},
    function(err, customers) {
      // asynchronously called
      res.status(200);
      res.json( customers );
  })
});

// GET customer from stripe by ID
server.post("/customers", function(req, res){
  // cust_id = req.body.customer_id
  stripe.customers.retrieve(
    req.body.customer_id,
    function(err, customer) {
      // asynchronously called
      if(customer != null){

        res.status(200);
        res.json( customer );
      } else {
        var response = {
          msg: err.message
        };
        res.status( 400 );
        res.json( response );

      }
    }
  );
});

// POST new Charge
server.post("/charges", function(req, res) {
  if(req.body.payment_id != null) {
    stripe.charges.retrieve( req.body.payment_id, function(err, charge) {
        // asynchronously called
        if(charge != null){
          res.status(200);
          res.json( charge );
        } else {
          var response = {
            msg: err.message
          };
          res.status( 400 );
          res.json( response );
  
        }
      });
  } else if(req.body.customer_id != null){
    stripe.charges.list( {customer: req.body.customer_id}, function(err, charges) {
      // asynchronously called
      if(charges.data != null){
        res.status(200);
        res.json( charges.data );
      } else {
        var response = {
          msg: err.message
        };
        res.status( 400 );
        res.json( response );

      }
    });
  }
  
});
  

// START CODE TO SAVE CLIENTS TO MONGODB
// GET Client List
server.get( "/clients", function( req, res ) {
    model.Client.find().then(function(clients){
        res.status(200);
        res.json( clients );
    }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          console.log("Error sending clients:", err);
          res.sendStatus(500);
      }
  });
});

// GET One client by Id
server.get("/clients/:id", function(req, res){
  model.Client.findById(req.params.id).then(function( client ){
    if( client == null ){
        res.status( 404 );
        res.json({
            msg: `There is no client with the id of ${ req.params.id}`
        });
    } else {
      res.status( 200 );
      res.json({ client: client});
    }
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// POST to Client
server.post('/clients', function(req, res){
    // create an instance of the mongoose model
    let client = new model.Client({
        stripeId: req.body.stripeId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        zipCode: req.body.zipCode,
        state: req.body.state,
        moveInDate: req.body.moveInDate,
        moveOutDate: req.body.moveOutDate
    });

    // Save the new contact to the database
    client.save(client).then(function (client){
        res.status(201);
        res.json({client: client} );
    }).catch( function( error ) {
        // If anything went wrong above, we catch the error here
        var response = {
            msg: error.message
        };
        res.status( 400 );
        res.json( response );
    });
});

// PUT client by ID
server.put("/clients/:id", function(req, res){
  model.Client.findById(req.params.id).then(function( client ){
      if( client == null ){
          res.status( 404 );
          res.json({
              msg: `There is no client with the id of ${ req.params.id}`
          });
      } else {

          client.firstName = req.body.firstName;
          client.lastName = req.body.lastName;
          client.email = req.body.email;
          client.phone = req.body.phone ;
          client.address = req.body.address;
          client.zipCode = req.body.zipCode;
          client.state = req.body.state;
          client.moveInDate = req.body.moveInDate,
          client.moveOutDate = req.body.moveOutDate

          client.save().then( function( ){
              res.status( 200 );
              res.json({
                  client: client
              });
          });
      }
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// Delete Client by ID
server.delete("/clients/:id", function( req, res ) {
  model.Client.findByIdAndDelete( req.params.id ).then( function( ){
      res.status( 204 );
      res.send( );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});


// START UNITS CODE
// GET all units
server.get("/units", function(req, res){
  model.Unit.find().then(function(units){
    res.status(200);
    res.json( units );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          console.log("Error sending Units:", err);
          res.sendStatus(500);
      }
  });
});

// GET unit by ID
server.get("/units/:id", function( req, res ) {
  model.Unit.findById( req.params.id ).then( function( ){
      res.status( 200 );
      res.json({
        unit: unit});
      res.send( );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// POST unit
server.post('/units', function(req, res){
  // create an instance of the mongoose model
  let unit = new model.Unit({
      customerId: req.body.customerId,
      unitNumber: req.body.unitNumber,
      unitSize: req.body.unitSize,
      occupied: req.body.occupied
  });

  // Save the new unit to the database
  unit.save(unit).then(function (unit){
      res.status(201);
      res.json( unit );
  }).catch( function( error ) {
      // If anything went wrong above, we catch the error here
      var response = {
          msg: error.message
      };
      console.log(response);
      res.status( 400 );
      res.json( response );
  });
});

// PUT by ID
server.put("/units/:id", function(req, res){
  model.Unit.findById(req.params.id).then(function( unit ){
      if( unit == null ){
          res.status( 404 );
          res.json({
              msg: `There is no unit with the id of ${ req.params.id}`
          });
      } else {
        unit.customerId = req.body.customerId,
        unit.unitNumber = req.body.unitNumber
        unit.unitSize = req.body.unitSize,
        unit.occupied = req.body.occupied,
        unit.save().then( function( ){
            res.status( 200 );
            res.json({
                unit: unit
            });
        });
      }
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// Delete by ID
server.delete("/units/:id", function( req, res ) {
  model.Unit.findByIdAndDelete( req.params.id ).then( function( ){
      res.status( 204 );
      res.send( );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});


// Start Tasks Code
// Get all tasks
server.get("/tasks", function(req, res){
  model.Task.find().then(function(tasks){
    res.status(200);
    res.json( tasks );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          console.log("Error sending tasks:", err);
          res.sendStatus(500);
      }
  });
});

// GET task by ID
server.get("/tasks/:id", function( req, res ) {
  model.Task.findById( req.params.id ).then( function( ){
      res.status( 200 );
      res.json({
        task: task});
      res.send( );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// POST task
server.post('/tasks', function(req, res){
  // create an instance of the mongoose model
  let task = new model.Task({
      title: req.body.title,
      dateCreated: req.body.dateCreated,
      dueDate: req.body.dueDate,
      details: req.body.details,
      createdBy: req.body.createdBy,
  });

  // Save the new task to the database
  task.save(task).then(function (task){
      res.status(201);
      res.json( task );
  }).catch( function( error ) {
      // If anything went wrong above, we catch the error here
      var response = {
          msg: error.message
      };
      console.log(response);
      res.status( 400 );
      res.json( response );
  });
});

// PUT by ID
server.put("/tasks/:id", function(req, res){
  model.Task.findById(req.params.id).then(function( task ){
      if( task == null ){
          res.status( 404 );
          res.json({
              msg: `There is no task with the id of ${ req.params.id}`
          });
      } else {
        task.title = req.body.title,
        task.dateCreated = req.body.dateCreated
        task.dueDate = req.body.dueDate,
        task.details = req.body.details,
        task.createdBy = req.body.createdBy,
        task.complete = req.body.complete,

        task.save().then( function( ){
            res.status( 200 );
            res.json({
                task: task
            });
        });
      }
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// Delete Task by ID
server.delete("/tasks/:id", function( req, res ) {
  model.Task.findByIdAndDelete( req.params.id ).then( function( ){
      res.status( 204 );
      res.send( );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});
// End Tasks Code



// START LEAD FUNCTIONS
// GET all leads
server.get("/leads", function(req, res){
  model.Lead.find().then(function(leads){
    res.status(200);
    res.json( leads );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          console.log("Error sending leads:", err);
          res.sendStatus(500);
      }
  });
});

// POST lead
server.post('/leads', function(req, res){
  // create an instance of the mongoose model
  let lead = new model.Lead({
      type: req.body.type,
      source: req.body.source,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      desiredUnit: req.body.desiredUnit,
      date: req.body.date,
      contacted: req.body.contacted
  });

  // Save the new lead to the database
  lead.save(lead).then(function (lead){
      res.status(201);
      res.json( lead );
  }).catch( function( error ) {
      // If anything went wrong above, we catch the error here
      var response = {
          msg: error.message
      };
      console.log(response);
      res.status( 400 );
      res.json( response );
  });
});

// PUT lead
server.put("/leads/:id", function(req, res){
  model.Lead.findById(req.params.id).then(function( lead ){
      if( lead == null ){
          res.status( 404 );
          res.json({
              msg: `There is no lead with the id of ${ req.params.id}`
          });
      } else {
        lead.type = req.body.type,
        lead.source = req.body.source,
        lead.firstName = req.body.firstName,
        lead.lastName = req.body.lastName,
        lead.email = req.body.email,
        lead.phone = req.body.phone,
        lead.desiredUnit = req.body.desiredUnit,
        lead.date = req.body.date,
        lead.contacted = req.body.contacted

        lead.save().then( function( ){
            res.status( 200 );
            res.json({
                lead: lead
            });
        });
      }
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// DELETE lead by ID
server.delete("/leads/:id", function( req, res ) {
  model.Lead.findByIdAndDelete( req.params.id ).then( function( ){
      res.status( 204 );
      res.send( );
  }).catch( function( err ) {
      if (err.errors) {
          var messages = {}
          for(let e in err.errors) {
              messages[e] = err.errors[e].message
          }
          res.status( 400 ).json(messages);
      } else {
          res.sendStatus(500);
      }
  });
});

// Start Server
server.listen(port, function(){
    console.log(`Example app listening on port ${port}!`)
});
