const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: '토큰이 유효하지 않습니다.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
};

const requireTeam = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'itsm_team') {
    return res.status(403).json({ message: '팀 멤버 권한이 필요합니다.' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin, requireTeam };
