const mysql = require('mysql2/promise');
require('dotenv').config();

const main = {
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

const pool = mysql.createPool(main);
module.exports = pool;