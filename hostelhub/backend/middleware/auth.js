const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, message: 'Login karo pehle!' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User nahi mila!' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid hai!' });
  }
};

exports.requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Pehle admin se verified hona zaroori hai. Rating sirf verified students de sakte hain!'
    });
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'warden') {
    return res.status(403).json({ success: false, message: 'Admin access required!' });
  }
  next();
};
