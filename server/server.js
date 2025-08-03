require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sql = require('mssql');

const app = express();
const PORT = 5000;

// Configuración de SQL Server
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Conexión a la DB
sql.connect(dbConfig).then(pool => {
  app.locals.db = pool;
  console.log('Conectado a SQL Server');

  // Rutas
  const accidentsRouter = require('./routes/accidents');
  app.use('/api/accidents', accidentsRouter);

  // Ruta de prueba
  app.get('/api/status', (req, res) => {
    res.json({ status: 'API funcionando', db: 'Conectado' });
  });

  app.listen(PORT, () => {
    console.log(`Servidor backend en http://localhost:${PORT}`);
    console.log('Endpoints disponibles:');
    console.log('GET /api/accidents/fatalities/:segment?year=YYYY');
    console.log('GET /api/accidents/non-fatalities/:segment?year=YYYY');
  });
}).catch(err => {
  console.error('Error de conexión a SQL:', err);
  process.exit(1);
});