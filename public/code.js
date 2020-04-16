// STRIPE CODE
var stripe;

var stripeElements = function(publicKey) {
  stripe = Stripe(publicKey);
  var elements = stripe.elements();

  // Element styles
  var style = {
    base: {
      fontSize: '16px',
      color: '#32325d',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: 'rgba(0,0,0,0.4)'
      }
    }
  };

  var card = elements.create('card', { style: style });

  card.mount('#card-element');

  // Element focus ring
  card.on('focus', function() {
    var el = document.getElementById('card-element');
    el.classList.add('focused');
  });

  card.on('blur', function() {
    var el = document.getElementById('card-element');
    el.classList.remove('focused');
  });

  document.querySelector('#submit').addEventListener('click', function(evt) {
    evt.preventDefault();
    changeLoadingState(true);
    // Initiate payment
    createPaymentMethodAndCustomer(stripe, card);
  });
};

function showCardError(error) {
  changeLoadingState(false);
  // The card was declined (i.e. insufficient funds, card has expired, etc)
  var errorMsg = document.querySelector('.sr-field-error');
  errorMsg.textContent = error.message;
  setTimeout(function() {
    errorMsg.textContent = '';
  }, 8000);
}

var createPaymentMethodAndCustomer = function(stripe, card) {
  var cardholderEmail = document.querySelector('#email').value;
  stripe
    .createPaymentMethod('card', card, {
      billing_details: {
        email: cardholderEmail,
      },
    })
    .then(function(result) {
      if (result.error) {
        showCardError(result.error);
      } else {
        var customerObject = createCustomer(result.paymentMethod.id, cardholderEmail);
        console.log("Customer Object", customerObject);
      }
    });
};

async function createCustomer(paymentMethod, cardholderEmail) {
    var cardholderPlan = document.querySelector('#plan_selector').value

  return fetch('/create-customer', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        plan: cardholderPlan,
        email: cardholderEmail,
        payment_method: paymentMethod
    })
  })
    .then(response => {
      console.log("response in Create Customer: ", response);
      return response.json();
    })
    .then(subscription => {
      handleSubscription(subscription);
    });
}

function handleSubscription(subscription) {
  const { latest_invoice } = subscription;
  const { payment_intent } = latest_invoice;

  if (payment_intent) {
    const { client_secret, status } = payment_intent;

    if (status === 'requires_action' || status === 'requires_payment_method') {
      stripe.confirmCardPayment(client_secret).then(function(result) {
        if (result.error) {
          // Display error message in your UI.
          // The card was declined (i.e. insufficient funds, card has expired, etc)
          changeLoadingState(false);
          showCardError(result.error);
        } else {
          // Show a success message to your customer
          confirmSubscription(subscription.id);
        }
      });
    } else {
      // No additional information was needed
      // Show a success message to your customer
      orderComplete(subscription);
    }
  } else {
    orderComplete(subscription);
  }
}

function confirmSubscription(subscriptionId) {
  return fetch('/subscription', {
    method: 'post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId
    })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(subscription) {
      orderComplete(subscription);
    });
}

function getPublicKey() {
  return fetch('/public-key', {
    method: 'get',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(response) {
      stripeElements(response.publicKey);
    });
}


/* ------- Post-payment helpers ------- */

/* Shows a success / error message when the payment is complete */
var orderComplete = function(subscription) {
  changeLoadingState(false);
  // var subscriptionJson = JSON.stringify(subscription, null, 2);
  document.querySelectorAll('.completed-view').forEach(function(view) {
    view.classList.remove('hidden');
  });
  document.querySelector('.order-status').textContent = subscription.status;
  app.new_client_stripe_id = subscription.customer
};

// Show a spinner on subscription submission
var changeLoadingState = function(isLoading) {
  if (isLoading) {
    document.querySelector('#spinner').classList.add('loading');
    document.querySelector('button').disabled = true;

    document.querySelector('#button-text').classList.add('hidden');
  } else {
    document.querySelector('button').disabled = false;
    document.querySelector('#spinner').classList.remove('loading');
    document.querySelector('#button-text').classList.remove('hidden');
  }
};




// VUE CODE
var app = new Vue ({
    el: "#app",
    vuetify: new Vuetify(),
    data: {
        dialog: false,
        drawer: true,
        page: 'dashboard',
        navItems: [
          { title: 'Dashboard', icon: 'mdi-view-dashboard', page: 'dashboard' },
          { title: 'Clients', icon: 'fas fa-user-circle', page: 'clients' },
          { title: 'Payments', icon: 'fas fa-dollar-sign', page: 'payments' },
          { title: 'Tasks', icon: 'fas fa-check', page: 'tasks' },
          { title: 'Units', icon: 'fas fa-warehouse', page: 'units' },
          {title: 'Leads', icon: 'fas fa-phone', page: 'leads'}
        ],

        // Payment Page Data Members
        charges: [],
        charge_search: '',
        charge_headers: [
          { text: 'Amount', align: 'start', sortable: false, value: 'amount'},
          { text: 'Description', value: 'description' },
          { text: 'Customer', value: 'billing_details.email' },
          { text: 'Date', value: 'created' },
          { text: 'Actions', value: 'action', sortable: false },
        ],
        charge_summary_headers: [
          { text: 'Amount', align: 'start', sortable: false, value: 'amount'},
          { text: 'Description', value: 'description' },
          { text: 'Customer', value: 'billing_details.email' },
          { text: 'Date', value: 'created' },
        ],
        dialog_charge: {
          client: {},
          id: "",
          billing_details:{},
          amount: "",
          description: "",
          card: {
            brand:"",
            exp_month: "",
            last4: "",
            exp_year: ""
          },
          receipt_url: "",
          statement_descriptor: "",
          status: "",
          created: "",
        },
        defaultItem: {},
        charge_info_dialog: false,

        // Clients Page Data Membersr
        e1: 1,
        clients: [],
        client_search: '',
        client_headers: [
          { text: 'Email', align: 'start', sortable: false, value: 'email'},
          { text: 'First Name', value: 'firstName' },
          { text: 'Last Name', value: 'lastName' },
          { text: 'Phone', value: 'phone' },
          { text: 'Address', value: 'address' },
          { text: 'Zip Code', value: 'zipCode' },
          { text: 'State', value: 'state', sortable: false },
          { text: 'Actions', value: 'action', sortable: false },
        ],
        recent_client_headers: [
          { text: 'Email', align: 'start', sortable: false, value: 'email'},
          { text: 'First Name', value: 'firstName' },
          { text: 'Last Name', value: 'lastName' },
          { text: 'Phone', value: 'phone' },
        ],
        client_info_dialog: false,
        editing_client: false,
        dialog_client: {
          client: {},
          first_invoice: {
            payment_method_details: {
              type: "",
              card: {
                brand:"",
                exp_month: "",
                last4: "",
                exp_year: ""

              },
            },
          },
          invoices: [],
          unit: {},
        },
        new_client_dialog: false,
        new_client_stripe_id: "",
        new_client_first_name: "",
        new_client_last_name: "",
        new_client_email: "",
        new_client_phone: "",
        new_client_address: "",
        new_client_zip_code: "",
        new_client_state: "",
        new_client_move_in_date: new Date().toISOString().substr(0, 10),
        new_client_move_out_date: new Date().toISOString().substr(0, 10),
        new_client_move_in_menu: false,
        new_client_move_out_menu: false,
        assign_unit_size: "",
        assign_unit_number: "",
        payment_plans: ["8X10", "10X16"],

        // Units Page data members
        units: [],
        unit_headers: [
          { text: 'Unit ID', align: 'start', sortable: false, value: '_id'},
          { text: 'Number', value: 'unitNumber'},
          { text: 'Size', value: 'unitSize' },
          { text: 'Customer Id', value: 'customerId' },
          { text: 'Actions', value: 'action', sortable: false },
        ],
        summary_unit_headers: [
          { text: 'Unit ID', align: 'start', sortable: false, value: '_id'},
          { text: 'Number', value: 'unitNumber'},
          { text: 'Size', value: 'unitSize' },
          { text: 'Customer Id', value: 'customerId' },
        ],
        unit_to_be_assigned_to_client: "",
        unit_search: "",
        new_unit_dialog: false,
        unit_info_dialog: false,
        editing_unit: false,
        editing_unit_id: "",
        editing_unit_occupied: false,
        new_unit_size: "",
        new_unit_number: "",
        selected_unit: {
          client: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            address: "",
            zipCode: "",
            state: "",
            moveInDate: "",
            moveOutDate: ""
          },
          unit:{},
        },
        // selected_payment_plan: "",

        // Tasks Page Data Members 
        tasks: [],
        editing_task: false,
        editing_task_complete: false,
        editing_task_id: "",
        new_task_dialog: false,
        new_task_title: "",
        new_task_details: "",
        new_task_due_date: new Date().toISOString().substr(0, 10),
        new_task_due_menu: false,
        new_task_created_by: "",
        invalidTaskForm: false,
        option1: true,

        // Lead Page Data Members
        leads: [],
        editing_lead: false,
        editing_lead_contacted: false,
        editing_lead_id: "",
        new_lead_dialog: false,
        new_lead_type_items: ["Walk-in", "Call-in", "Previous Customer"],
        new_lead_source_items: ["Refferal", "Web Search", "Facebook", "Instagram"],
        new_lead_type: "",
        new_lead_source: "",
        new_lead_first_name: "",
        new_lead_last_name: "",
        new_lead_email: "",
        new_lead_phone: "",
        new_lead_desired_unit_items: ["8X10", "10X20"],
        new_lead_desired_unit: ""
    },

    created: function ( ) {
        this.loadClients();
        this.loadTasks();
        this.loadLeads();
        this.loadUnits();
      },

    computed: {
      formTitle () {
        return this.editedIndex === -1 ? 'New Item' : 'Edit Item'
      },

      // Unit data members
      total_units () {
        return this.units.length
      },
      occupied_units () {
        var total = 0
        this.units.forEach( unit =>{
          if(unit.occupied == true){
            total += 1
          }
        })
        return total
      },
      vacant_units () {
        var total = 0
        this.units.forEach( unit =>{
          if(unit.occupied == false){
            total += 1
          }
        })
        return total
      },
      unit_graph_color () {
        if(this.vacant_units <= 5){
          return "success"
        } else if (this.vacant_units <= 10) {
          return "orange"
        } else {
          return "red"
        }
      },
      available_8_by_10_units () {
        var available_units = [];
        if(this.assign_unit_size == "8X10"){
          this.units.forEach(unit => {
            if(unit.unitSize == "8X10" && unit.occupied == false){
              available_units.push(unit.unitNumber);
            }
          });
        }
        return available_units;
      },
      available_10_by_16_units () {
        var available_units = [];
        if(this.assign_unit_size == "10X16"){
          this.units.forEach(unit => {
            if(unit.unitSize == "10X16" && unit.occupied == false){
              available_units.push(unit.unitNumber);
            }
          });
        }
        return available_units;
      },
      clients_that_can_be_assigned_a_unit(){
        var client_list = [];
        this.clients.forEach(client => {
          if(client.unitId == ""){
            client_list.push(client);
          }
        })
        return client_list;
      },
      available_units (){
        var list_of_units =[]
        this.units.forEach(unit =>{
          if(unit.occupied == false){
            list_of_units.push(unit);
          }
        });
        return list_of_units;
      },

      // Task data members
      total_tasks () {
        return this.tasks.length
      },
      incomplete_tasks() {
        var total = 0
        this.tasks.forEach( task => {
          if(task.complete == false){
            total += 1;
          }
        })
        return total
      },
      completed_tasks() {
        var total = 0
        this.tasks.forEach( task => {
          if(task.complete == true){
            total += 1;
          }
        })
        return total
      },
      task_graph_color () {
        if(this.incomplete_tasks == 0){
          return "success"
        } else if (this.incomplete_tasks <= 2) {
          return "orange"
        } else {
          return "red"
        }
      },

      // lead data members
      total_leads () {
        return this.leads.length
      },
      uncontacted_leads() {
        var total = 0
        this.leads.forEach( lead => {
          if(lead.contacted == false){
            total += 1;
          }
        })
        return total
      },
      contacted_leads() {
        var total = 0
        this.leads.forEach( lead=> {
          if(lead.contacted == true){
            total += 1;
          }
        })
        return total
      },
      lead_graph_color () {
        if(this.uncontacted_leads == 0){
          return "success"
        } else if (this.uncontacted_leads <= 2) {
          return "orange"
        } else {
          return "red"
        }
      },

    },

    watch: {
      dialog (val) {
        val || this.close()
      },
    },

    methods: {

        // Stripe Methods
        getClientInvoices: function (stripeId) {
          var req_body = {
            customer_id: stripeId
          }
          fetch( `http://localhost:3000/charges`, {
            method: "POST",
            headers: {
              "Content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
            response.json(  ).then( ( invoices ) => {
              this.dialog_client.first_invoice = invoices[0];
              this.dialog_client.invoices =  invoices;
            });
          });
        },

        // Clients Methods
        openNewClientDialog: function(){
          this.new_client_dialog = true;
          getPublicKey();
        },

        // Get all Clients
        loadClients: function () {
          fetch( "http://localhost:3000/clients" ).then( ( response ) => {
              response.json(  ).then( ( data ) => {
                this.clients = data;
                this.loadCharges();
              });
            });
        },

        createNewClient: function(){
          this.new_client_dialog = false;
          this.e1 = 1
          var newClient = {
            stripeId: this.new_client_stripe_id,
            firstName: this.new_client_first_name,
            lastName: this.new_client_last_name,
            email: this.new_client_email,
            phone: this.new_client_phone,
            address: this.new_client_address,
            zipCode: this.new_client_zip_code,
            state: this.new_client_state,
            moveInDate: this.new_client_move_in_date,
            moveOutDate: this.new_client_move_out_date
          }

          fetch( "http://localhost:3000/clients", {
              method: "POST",
              headers: {
                "Content-type": "application/json"
              },
              body: JSON.stringify( newClient )

          }).then(( response ) => {
            if( response.status == 400 ) {
                response.json( ).then(( data ) =>{
                    alert(data.msg);
                })
            } else if ( response.status == 201 ) {
                response.json( ).then(( data ) =>{
                  console.log("Client Added: ", data.client);
                  if(this.unit_to_be_assigned_to_client._id != ""){
                    app.assignUnitToClient(data.client);
                  }
                  app.loadClients();
              });
            }
          });
          this.new_client_stripe_id = "";
          this.new_client_first_name = "";
          this.new_client_last_name = "";
          this.new_client_email = "";
          this.new_client_phone = "";
          this.new_client_address = "";
          this.new_client_zip_code = "";
          this.new_client_state = "";
          this.new_client_move_in_date = new Date().toISOString().substr(0, 10);
          this.new_client_move_out_date = new Date().toISOString().substr(0, 10);
        },
        
        deleteClient: function  ( client ){
          fetch( `http://localhost:3000/clients/${ client._id }`, {
              method: "DELETE"
          }).then( function( response ){
              if( response.status == 204 ){
                  console.log( "It worked" );
                  app.loadClients();
              } else if ( response.status == 400 ) {
                  response.json().then( function( data ) {
                      alert(data.msg);
                  })
              }
          });
        },

        cancelNewClientProcess: function(){
          this.new_client_dialog = false;
          this.e1 = 1
          this.new_client_first_name = "";
          this.new_client_last_name = "";
          this.new_client_email = "";
          this.new_client_phone = "";
          this.new_client_address = "";
          this.new_client_zip_code = "";
          this.new_client_state = "";
          this.new_client_move_in_date = new Date().toISOString().substr(0, 10);
          this.new_client_move_out_date = new Date().toISOString().substr(0, 10);
          this.assign_unit_size = "";
          this.assign_unit_number = "";
        },

        getClientDetails: function (client){
          this.client_info_dialog = true;
          this.dialog_client.client = client;
          this.units.forEach(unit => {
            if(unit.customerId == client._id){
                this.dialog_client.unit = unit;
            }
          });
          this.getClientInvoices(client.stripeId);
        },

        moveToStepTwoOfNewClientProcess: function(){
          this.e1 = 2;

        },

        updateClientDetails: function(){
          var req_body = {
            stripeId: this.dialog_client.client.stripeId,
            firstName: this.dialog_client.client.firstName,
            lastName: this.dialog_client.client.lastName,
            email: this.dialog_client.client.email,
            phone: this.dialog_client.client.phone,
            address: this.dialog_client.client.address,
            zipCode: this.dialog_client.client.zipCode,
            state: this.dialog_client.client.state,
            moveInDate: this.dialog_client.client.moveInDate,
            moveOutDate: this.dialog_client.client.moveOutDate

          }
          fetch( `http://localhost:3000/clients/${this.dialog_client.client._id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
              response.json(  ).then( ( client ) => {
                console.log("Updated client by id:", client)
                this.close();
                this.editing_client= false;
                app.loadClients();
              });
          });
        },

       
        // Unit Methods
        // Assign a client to a unit
        assignUnitToClient: function(client){
          req_body = {
            customerId: client._id,
            unitNumber: this.unit_to_be_assigned_to_client.unitNumber,
            unitSize: this.unit_to_be_assigned_to_client.unitSize,
            occupied: true,
          }
          fetch( `http://localhost:3000/units/${this.unit_to_be_assigned_to_client._id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
              response.json(  ).then( ( unit ) => {
                console.log("Updated unit by id:", unit)

                this.unit_to_be_assigned_to_client = "";
                
                app.loadUnits();
                app.loadClients();
              });
          });
          this.close();
        },

        unassignUnitFromClient: function(){
          req_body = {
            customerId: "",
            unitNumber: this.selected_unit.unit.unitNumber,
            unitSize: this.selected_unit.unit.unitSize,
            occupied: false,
          }
          fetch( `http://localhost:3000/units/${this.selected_unit.unit._id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
              response.json(  ).then( ( unit ) => {
                console.log("Updated unit by id:", unit)
                
                app.loadUnits();
                app.loadClients();
              });
          });
          this.close();
        },

        //  POST units
        createNewUnit: function(){
          var newUnit = {
            customerId: "",
            unitSize: this.new_unit_size,
            unitNumber: this.new_unit_number,
            occupied: false,
          }
          fetch( "http://localhost:3000/units", {
              method: "POST",
              headers: {
                "Content-type": "application/json"
              },
              body: JSON.stringify( newUnit )

          }).then(( response ) => {
              if( response.status == 400 ) {
                  response.json( ).then(( data ) =>{
                      alert(data.msg);
                  })
              } else if ( response.status == 201 ) {
                  app.loadUnits();
              }
          });
          this.new_unit_dialog = false;
          this.new_unit_size = "";
          this.new_unit_number = "";

        },

        // Delete Unit
        deleteUnit: function  ( unit ){
          fetch( `http://localhost:3000/units/${ unit._id }`, {
              method: "DELETE"
          }).then( function( response ){
              if( response.status == 204 ){
                  console.log( "It worked" );
                  app.loadUnits();
              } else if ( response.status == 400 ) {
                  response.json().then( function( data ) {
                      alert(data.msg);
                  })
              }
          });
        },

        // Update Unit
        updateUnit: function () {
          var req_body = {
            customerId: clientId,
            unitSize: this.assign_unit_size,
            unitNumber: this.assign_unit_number,
            occupied: this.editing_unit_occupied
          }

          fetch( `http://localhost:3000/units/${this.editing_unit_id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
              response.json(  ).then( ( unit ) => {
                console.log("Updated unit by id:", unit)

                this.assign_unit_size = "";
                this.assign_unit_number = "";
                this.editing_unit_occupied = false;
                
                app.loadUnits();
              });
          });
        },

        // GET ALL UNITS
        loadUnits: function(){
          fetch( "http://localhost:3000/units" ).then( ( response ) => {
              response.json(  ).then( ( data ) => {
                this.units = data;
              });
            });
        },

        // Edit Unit
        editUnit: function(unit){
          this.editing_unit = true;
          this.new_unit_dialog = true;
          this.editing_unit_id = unit._id;
          this.new_unit_size = unit.unitSize;
          this.new_unit_number = unit.unitNumber;
          this.editing_unit_occupied = unit.occupied;
        },

        getUnitDetails: function (unit) {
          console.log(unit);
          this.unit_info_dialog = true;
          if(unit.customerId != ""){
            fetch( `http://localhost:3000/clients/${unit.customerId}` ).then( ( response ) => {
              response.json(  ).then( ( data ) => {
                this.selected_unit.client = data.client;
              });
            });
          } else{
            this.selected_unit.client = {
              firstName: "",
              lastName: "",
              email: "",
              phone: "",
              address: "",
              zipCode: "",
              state: "",
              moveInDate: "",
              moveOutDate: ""
            }
          }
          this.selected_unit.unit = unit
          this.unit_to_be_assigned_to_client = unit;
        },



        // Payment Functions
        loadCharges: function(){
          this.charges =[]
          this.clients.forEach( client => {
            if(client.stripeId != ""){
              var req_body = {
                customer_id: client.stripeId
              }
              fetch( `http://localhost:3000/charges`, {
                method: "POST",
                headers: {
                  "Content-type": "application/json"
                },
                body: JSON.stringify( req_body )
              }).then( ( response ) => {
                response.json(  ).then( ( invoices ) => {
                  console.log("Invoices: ", invoices);
                  invoices.forEach(invoice => {
                    newInvoice = {
                      client: client,
                      id: invoice.id,
                      billing_details: invoice.billing_details,
                      amount: invoice.amount,
                      description: invoice.description,
                      card: invoice.payment_method_details.card, 
                      receipt_url: invoice.receipt_url,
                      statement_descriptor: invoice.statement_descriptor,
                      status: invoice.status,
                      created: invoice.created,
                      customer: invoice.customer
                    }
                    this.charges.push(newInvoice);
                  })
                });
              });
              console.log("charges: ",this.charges);

            }
          })
        },
      
        getPaymentDetails: function(item) {
          this.dialog_charge = item;
          this.charge_info_dialog = true;
        },


        // Tasks Methods
        formatDate: function (new_task_due_date) {
          return moment(new_task_due_date).format('YYYY-MM-DD');
        },
      
        loadTasks: function () {
          fetch( "http://localhost:3000/tasks" ).then( ( response ) => {
              response.json(  ).then( ( data ) => {
                this.tasks = data
            });
          });
        },

        createNewTask: function() {
          var newTask = {
              title: this.new_task_title,
              dateCreated: new Date().toISOString().substr(0, 10),
              dueDate: this.new_task_due_date,
              details: this.new_task_details,
              createdBy: this.new_task_created_by
          }

          fetch( "http://localhost:3000/tasks", {
              method: "POST",
              headers: {
                "Content-type": "application/json"
              },
              body: JSON.stringify( newTask )

          }).then(( response ) => {
              if( response.status == 400 ) {
                  response.json( ).then(( data ) =>{
                      alert(data.msg);
                  })
              } else if ( response.status == 201 ) {
                  console.log( "Added");
                  app.loadTasks();
              }
          });
          this.new_task_title = "";
          this.new_tasks_details= "";
          this.new_tasks_created_by = "";
          this.new_task_dialog = false;
        },

        updateTask: function () {
          var req_body = {
            title: this.new_task_title,
            dateCreated: new Date().toISOString().substr(0, 10),
            dueDate: this.new_task_due_date,
            details: this.new_task_details,
            createdBy: this.new_task_created_by,
            complete: this.editing_task_complete
          }

          fetch( `http://localhost:3000/tasks/${this.editing_task_id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
              response.json(  ).then( ( task ) => {
                console.log("Updated task by id:", task)

                this.editing_task = false;
                this.new_task_dialog = false;
                this.editing_task_id = "";
                this.new_task_title = "";
                this.new_task_details = "";
                this.new_task_created_by = "";
                this.new_task_due_date = new Date().toISOString().substr(0, 10);
                this.editing_task_complete = "";
                app.loadTasks();
              });
          });
        },

        deleteTask: function  ( task ){
          fetch( `http://localhost:3000/tasks/${ task._id }`, {
              method: "DELETE"
          }).then( function( response ){
              if( response.status == 204 ){
                  console.log( "It worked" );
                  app.loadTasks();
              } else if ( response.status == 400 ) {
                  response.json().then( function( data ) {
                      alert(data.msg);
                  })
              }
          });
        },

        editTask: function(task){
          this.editing_task = true;
          this.new_task_dialog = true;
          this.editing_task_id = task._id;
          this.new_task_title = task.title;
          this.new_task_details = task.details;
          this.new_task_created_by = task.createdBy;
          this.new_task_due_date = task.dueDate;
          this.editing_task_complete = task.complete;
        },

        // Lead Methods
        loadLeads: function(){
          fetch( "http://localhost:3000/leads" ).then( ( response ) => {
              response.json(  ).then( ( data ) => {
                this.leads = data
            });
          });
        },

        createNewLead: function() {
          var newLead = {
            type: this.new_lead_type,
            source: this.new_lead_source,
            firstName: this.new_lead_first_name,
            lastName: this.new_lead_last_name,
            email: this.new_lead_email,
            phone: this.new_lead_phone,
            desiredUnit: this.new_lead_desired_unit,
            date: new Date().toISOString().substr(0, 10),
            contacted: false
          }
          fetch( "http://localhost:3000/leads", {
              method: "POST",
              headers: {
                "Content-type": "application/json"
              },
              body: JSON.stringify( newLead )

          }).then(( response ) => {
              if( response.status == 400 ) {
                  response.json( ).then(( data ) =>{
                      alert(data.msg);
                  })
              } else if ( response.status == 201 ) {
                  console.log( "Added");
                  app.loadLeads();
              }
          });
          this.new_lead_type = "";
          this.new_lead_source = "";
          this.new_lead_first_name = "";
          this.new_lead_last_name = "";
          this.new_lead_email = "";
          this.new_lead_phone = "";
          this.new_lead_desired_unit = "";
          this.new_lead_dialog = false;
        },

        deleteLead: function( lead ) {
          fetch( `http://localhost:3000/leads/${ lead._id }`, {
              method: "DELETE"
          }).then( function( response ){
            if( response.status == 204 ){
                console.log( "It worked" );
                app.loadLeads();
            } else if ( response.status == 400 ) {
                response.json().then( function( data ) {
                    alert(data.msg);
                })
            }
          });
        },

        updateLead: function () {
          var req_body = {
            type: this.new_lead_type,
            source: this.new_lead_source,
            firstName: this.new_lead_first_name,
            lastName: this.new_lead_last_name,
            email: this.new_lead_email,
            phone: this.new_lead_phone,
            desiredUnit: this.new_lead_desired_unit,
            date: new Date().toISOString().substr(0, 10),
            contacted: this.editing_lead_contacted
          }

          fetch( `http://localhost:3000/leads/${this.editing_lead_id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( req_body )
          }).then( ( response ) => {
              response.json(  ).then( ( lead ) => {
                console.log("Updated lead by id:", lead)

                this.new_lead_type = "";
                this.new_lead_source = "";
                this.new_lead_first_name = "";
                this.new_lead_last_name = "";
                this.new_lead_email = "";
                this.new_lead_phone = "";
                this.new_lead_desired_unit = "";
                this.new_lead_dialog = false;
                this.editing_lead = false;
                this.editing_lead_contacted = false;
                this.editing_lead_id = "";
                app.loadLeads();
              });
          });
        },

        editLead: function(lead){
          this.editing_lead = true;
          this.editing_lead_id = lead._id;
          this.editing_lead_contacted = lead.contacted;
          this.new_lead_dialog = true;
          this.new_lead_type = lead.type;
          this.new_lead_source = lead.source;
          this.new_lead_first_name = lead.firstName
          this.new_lead_last_name = lead.lastName;
          this.new_lead_email = lead.email;
          this.new_lead_phone = lead.phone;
          this.new_lead_desired_unit = lead.desiredUnit; 
        },

        close: function () {
          // Clear client data members
          this.editing_client = false,
          this.new_client_stripe_id = "";
          this.new_client_first_name = "";
          this.new_client_last_name = "";
          this.new_client_email = "";
          this.new_client_phone = "";
          this.new_client_address = "";
          this.new_client_zip_code = "";
          this.new_client_state = "";
          this.new_client_move_in_date = new Date().toISOString().substr(0, 10);
          this.new_client_move_out_date = new Date().toISOString().substr(0, 10);
          this.dialog_client = {
            client: {},
            first_invoice: {
              payment_method_details: {
                type: "",
                card: {
                  brand:"",
                  exp_month: "",
                  last4: "",
                  exp_year: ""
                },
              },
            },
            invoices: [],
            unit: {},
          },

          // Clear Payment data members
          this.dialog_charge = {
              client: {},
              id: "",
              billing_details:{},
              amount: "",
              description: "",
              card: {
                brand:"",
                exp_month: "",
                last4: "",
                exp_year: ""
              },
          },

          // Clear Unit data members
          this.editing_unit = false;
          this.editing_unit_id = "";
          this.assign_unit_size = "";
          this.assign_unit_number = "";
          this.editing_unit_occupied = false;
          this.selected_unit = {
            client: {
              firstName: "",
              lastName: "",
              email: "",
              phone: "",
              address: "",
              zipCode: "",
              state: "",
              moveInDate: "",
              moveOutDate: ""
            },
            unit:{},
          },
          this.unit_to_be_assigned_to_client = "";

          // Clear task data members 
          this.editing_task = false;
          this.new_task_dialog = false;
          this.editing_task_id = "";
          this.new_task_title = "";
          this.new_task_details = "";
          this.new_task_created_by = "";
          this.new_task_due_date = new Date().toISOString().substr(0, 10);
          this.editing_task_complete = "";
          
          
          // Clear Lead data members 
          this.new_lead_type = "";
          this.new_lead_source = "";
          this.new_lead_first_name = "";
          this.new_lead_last_name = "";
          this.new_lead_email = "";
          this.new_lead_phone = "";
          this.new_lead_desired_unit = "";
          this.editing_lead = false;
          this.editing_lead_contacted = false;
          this.editing_lead_id = "";
          
          setTimeout(() => {
            // Close all dialogs
            this.charge_info_dialog = false
            this.client_info_dialog = false
            this.new_unit_dialog = false;
            this.unit_info_dialog = false;
            this.new_task_dialog = false;
            this.new_lead_dialog = false;
          }, 300)
        },

        save: function () {
          if (this.editedIndex > -1) {
            Object.assign(this.charges[this.editedIndex], this.editedItem)
          } else {
            this.charges.push(this.editedItem)
          }
          this.close()
        },
    }
})
