const userService = require("./user.service");

const register = async(req, res)=>{
    try{
        await userService.register(req.body);
        res.status(201).json({message:"User Created Successfully"});
    }catch(error){
        if(error.message === "Email already exist" || error.message === "Email is invalid"){
            return res.status(400).json({message: error.message});
        }
        res.status(500).json({message: error.message});         
    }
}

const login = async(req, res)=>{
        try{
            const {email, password} = req.body;
            const result = await userService.login(email, password);
            res.json(result);    
        }catch(error){
            if(error.message === "Invalid email or password"){
                return res.status(400).json({message: error.message});
            }
            res.status(500).json({message: error.message});
        }
}


module.exports = {register, login};