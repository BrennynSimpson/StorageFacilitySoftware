const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://myusername:myuserpass@mydatabase-ekvhd.mongodb.net/SeniorProject?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

var clientSchema = mongoose.Schema({
    stripeId: {
        type: String,
        required: false
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: false
    },
    zipCode: {
        type: String,
        required: false
    },
    state: {
        type: String,
        required: false
    },
    moveInDate: {
        type: Date,
        required: false
    },
    moveOutDate:{
        type: Date,
        required: false
    }
}, {
    toJSON: {
        transform: function (doc, ret) {
            ret.moveInDate = ret.moveInDate.toISOString().split('T')[0];
            ret.moveOutDate = ret.moveOutDate.toISOString().split('T')[0];
        }
    }
});


var unitSchema = mongoose.Schema({
    customerId: {
        type: String,
        required: false
    },
    unitNumber:{
        type: Number,
        required: true
    },
    unitSize: {
        type: String,
        required: true
    },
    occupied: {
        type: Boolean,
        default: false
    },
});

var taskSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    dateCreated: {
        type: Date,
        require: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    details:{
        type: String,
        required: true
    },
    createdBy:{
        type: String,
        required: true
    },
    complete:{
        type: Boolean,
        default: false
    }
}, {
    toJSON: {
        transform: function (doc, ret) {
            ret.dueDate = ret.dueDate.toISOString().split('T')[0];
            ret.dateCreated = ret.dateCreated.toISOString().split('T')[0];
        }
    }
});

var leadSchema = mongoose.Schema({
    type: {
        type: String,
        required: false
    },
    source: {
        type: String,
        require: false
    },
    firstName: {
        type: String,
        required: false
    },
    lastName:{
        type: String,
        required: false
    },
    email:{
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: false
    },
    desiredUnit:{
        type: String,
        default: false
    },
    date: {
        type: Date,
        required: true
    },
    contacted: {
        type: Boolean,
        default: false
    },
}, {
    toJSON: {
        transform: function (doc, ret) {
            ret.date = ret.date.toISOString().split('T')[0];
        }
    }
});

var Client = mongoose.model("Client", clientSchema);
var Unit = mongoose.model("Unit", unitSchema);
var Task = mongoose.model("Task", taskSchema);
var Lead = mongoose.model("Lead", leadSchema);

module.exports = {
    Client: Client,
    Unit: Unit,
    Task: Task,
    Lead: Lead
}