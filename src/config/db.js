const mongoose = require('mongoose');

const connectDb = async()=>{
    try{
        const conn = await mongoose.connect(process.env.MONGODB_URL);
        console.log("MongoDb connected successfully");
    } catch(error){
        console.error(`Connection Error: ${error.message} `);
        process.exit(1);
    }
};

module.exports = connectDb;