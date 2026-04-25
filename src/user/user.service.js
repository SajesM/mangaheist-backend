const userRepository = require("./user.repository");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const validator = require("validator");

const register = async (userData) => {
    const { username, email, password } = userData;

    if (!validator.isEmail(email)) {
        throw new Error("Email is invalid");
    }

    const existingUser = await userRepository.findUserEmail(email);
    if (existingUser) {
        throw new Error("Email already exist");
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userRepository.createUser({ username, email, password: hashedPassword });
    return newUser;
};

const login = async (email, password) => {
    const user = await userRepository.findUserEmail(email);

    // Compare plain password against stored hash
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !isMatch) {
        throw new Error("Invalid email or password");
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return {
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    };
};

module.exports = { register, login };