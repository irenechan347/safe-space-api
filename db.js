//db.js
 const sql = require('mssql');

const config = {
  //server: 'inpower.database.windows.net', 
  server: 'inpowerdatabase.database.windows.net',
  database: 'InPowerDatabase',
  user: 'inpoweradmin',
  password: 'Qwer1234',
  options: {
    encrypt: true, //connecting to Azure SQL Database 
    port: 1433
  },
};







const pool = new sql.ConnectionPool(config);

module.exports = pool;
