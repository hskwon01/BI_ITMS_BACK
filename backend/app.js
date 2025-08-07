const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const ticketRoutes = require('./routes/ticket');
const dashboardRoutes = require('./routes/dashboard');
require('dotenv').config();

const app = express();

// CORS 설정
app.use(cors());

// Body parser 미들웨어 설정
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 미들웨어 (디버깅용)
// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.path}`, {
//     body: req.body,
//     contentType: req.get('Content-Type')
//   });
//   next();
// });

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);

const listEndpoints = require('express-list-endpoints');
console.log(listEndpoints(app));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
