const User = require("./user.model");

const findUserEmail = async(email) =>{
    return await User.findOne({email});
}

const findUserId = async(id) =>{
    return await User.findById(id);
}

const createUser = async(userData)=>{
    return await User.create(userData);
}

module.exports = {findUserEmail, findUserId, createUser};