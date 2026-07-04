require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const masterRoutes = require('./routes/masters');
const voucherRoutes = require('./routes/vouchers');
const invoiceRoutes = require('./routes/invoices');
const partyRoutes = require('./routes/parties');
const reportRoutes = require('./routes/reports');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'SmartERP API' }));

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SmartERP API running on http://localhost:${PORT}`));
