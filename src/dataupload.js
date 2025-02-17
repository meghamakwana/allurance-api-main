const mysql = require('mysql2/promise');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const pool = require('./utils/db');
// Database connection details
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};


async function insertData() {
  console.log("first")
  const connection = await mysql.createConnection(dbConfig);
  function toTitleCase(str) {
    return str
      .toLowerCase()  // First convert the whole string to lowercase
      .replace(/\b\w/g, char => char.toUpperCase()); // Then capitalize the first letter of each word
  }
  try {
    // Read CSV file
    const data = [];
    fs.createReadStream('pincode.csv')
      .pipe(csv())
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', async () => {
        console.log('CSV file successfully processed.');

        // Create unique sets for each level
        const districts = new Set();
        const postOffices = new Map(); // Map for post offices with pincode

        for (const row of data) {
            const district = { name: toTitleCase(row.District), state: toTitleCase(row.StateName) };
  
            // Convert the district object to a string for uniqueness
            const districtString = JSON.stringify(district);
            districts.add(districtString);
          postOffices.set(row.PostOfficeName, {
            district: toTitleCase(row.District),
            pincode: row.Pincode,
          });
        }

        // Insert districts
         for (const district of districts) {
            const newdistrict = JSON.parse(district);
          const [rows] = await connection.execute(
            'SELECT id FROM ine_states WHERE name = ?',
            [newdistrict.state]
          );
          if (rows.length) {
            const stateId = rows[0].id;
            await connection.execute(
              'INSERT IGNORE INTO ine_districts (name, state_id) VALUES (?, ?)',
              [newdistrict.name, stateId]
            );
            console.log('ine_districts processed.');
          }
         }

        // // Insert post offices and pincodes
        for (const [postOffice, details] of postOffices.entries()) {
          const [rows] = await connection.execute(
            'SELECT id FROM ine_districts WHERE name = ?',
            [details.district]
          );
          if (rows.length) {
            const districtId = rows[0].id;
            const [postOfficeRow] = await connection.execute(
              'INSERT IGNORE INTO ine_post_offices (name, district_id) VALUES (?, ?)',
              [postOffice, districtId]
            );
            console.log('ine_post_offices processed.');
            const postOfficeId =
              postOfficeRow.insertId ||
              (
                await connection.execute(
                  'SELECT id FROM ine_post_offices WHERE name = ? AND district_id = ?',
                  [postOffice, districtId]
                )
              )[0][0].id;

            await connection.execute(
              'INSERT IGNORE INTO ine_pincodes (pincode, post_office_id) VALUES (?, ?)',
              [details.pincode, postOfficeId]
            );
            console.log('ine_pincodes processed.');
          }
        }

        console.log('Data successfully inserted into the database.');
        await connection.end();
      });
  } catch (error) {
    console.error('Error inserting data:', error);
    await connection.end();
  }
}
async function insertpermissions(){
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(
    'SELECT id FROM ine_modules');
  if (rows.length) {
    for (const row of rows) {
       let id = row.id;
      await connection.execute(
        'INSERT IGNORE INTO ine_permissions (role_id, module_id, read_access, add_access, update_access, delete_access) VALUES (1, ?, 1, 1, 1, 1)',
        [id]
      );
     console.log('ine_permissions processed.');
    }
  }
}
insertData();
// insertpermissions();


