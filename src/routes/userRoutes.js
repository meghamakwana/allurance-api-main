// src/routes/userRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const multer = require('multer');
const upload = multer();
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, generateOTP, validatePassword, checkEmailExistOrNot, checkPhoneExistOrNot, processImageUpload, isValidDate, getCountryByStateId, uploadToAzureBlob, getRecordDetailById } = require('../commonFunctions')
const router = express.Router();

const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../utils/authMiddleware');
const uniqueId = uuidv4();

const API_SECRET_KEY = process.env.API_SECRET_KEY;
const API_TOKEN_EXPIRESIN = process.env.API_TOKEN_EXPIRESIN;

const tableName = TABLE.USERS;
const ine_users_ModuleID = TABLE.USERS_MODULE_ID;
const tableName2 = TABLE.USERS_DETAILS;
const tableName3 = TABLE.ROLE;
const tableName4 = TABLE.MY_REFERRAL;
const tableName5 = TABLE.SETTINGS;
const tableName7 = TABLE.ECOMMMETA; // Notification

// Frontend - Login
router.post('/login/frontuserslogin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendResponse(res, { error: 'E-mail and Password fields are required', status: false }, 400);
    }
    const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE email = ? AND status = 1 AND  role_id = 9`, [email]);
    if (results.length > 0) {
      const storedHashedPassword = await results[0].password;
      const passwordMatch = await bcrypt.compareSync(password, storedHashedPassword);
      if (passwordMatch) {
        const user = {
          id: results[0].id,
          first_name: results[0].first_name,
          last_name: results[0].last_name,
          prefix_id: results[0].prefix_id,
          phone: results[0].phone,
          email: results[0].email,
        };
        const token = jwt.sign({ data: user }, API_SECRET_KEY, { expiresIn: API_TOKEN_EXPIRESIN });

        return await sendResponse(res, { message: 'Logged In Successfuly', accessToken: token, status: true }, 200);
      } else {
        return sendResponse(res, { error: 'Invalid email or password', status: false }, 200);
      }
    } else {
      return sendResponse(res, { error: 'User not found or inactive', status: false }, 200);
    }
  } catch (error) {
    console.error("Error", error);
    return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
  }
});

// Admin - Login
router.post('/login', async (req, res) => {
  try {
    const { prefix_id, password } = req.body;

    if (!prefix_id || !password) {
      return res.status(400).json({ error: 'User ID and Password field must be required', status: false });
    }

    const [rows] = await pool.query(`SELECT * FROM ${tableName}  WHERE prefix_id = ? AND status = 1`, [prefix_id]);

    if (rows.length > 0) {
      const user = rows[0];
      if (user.role_id === 9) {
        return res.status(403).json({ error: 'Login not allowed for this role ID', status: false });
      }

      const storedHashedPassword = user.password;
      const passwordMatch = await bcrypt.compare(password, storedHashedPassword);

      if (passwordMatch) {
        const token = jwt.sign({ data: user }, API_SECRET_KEY, { expiresIn: API_TOKEN_EXPIRESIN });
        return res.status(200).json({ accessToken: token, user, message: 'Login Successfully', status: true });
      } else {
        return res.status(401).json({ error: 'Invalid User ID or Password', status: false });
      }
    }

    return res.status(404).json({ error: 'User ID does not exist or is inactive', status: false });

  } catch (error) {
    return res.status(500).json({ error: `Error occurred: ${error.message}`, status: false });
  }
});

// Register
router.post('/', upload.any(), async (req, res) => {
  try {

    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const url = new URL(fullUrl);
    let referral_code = url.searchParams.get('referral');



    const { first_name, last_name, email, referral_code: bodyReferralCode, state_id, district_id, pincode, post_office_id , address, govt_id_number, pan_number, phone, role_id  } = req.body;
    //const role_id = 9;

    // Validate request data
    if (!first_name || !last_name || !email || !phone) {
      return sendResponse(res, { error: 'First Name, Last Name, Email and Phome number field is required', status: false }, 400);
    }

    let govt_id_upload;
    let pan_upload;
    let avatar;
    let gimg;
    let pimg;
    let aimg;

    // Email Validation
    if (email) {
      const emailExists = await checkEmailExistOrNot(tableName, email);
      if (emailExists) {
        return sendResponse(res, { error: 'Email already exists', status: false }, 409);
      }
    }
    if (phone) {
      const phoneExists = await checkPhoneExistOrNot(tableName, phone);
      if (phoneExists) {
        return sendResponse(res, { error: 'Phone number already exists', status: false }, 409);
      }
    }

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        switch (file.fieldname) {
          case "govt_id_upload":
            govt_id_upload = file;
            break;
          case "pan_upload":
            pan_upload = file;
            break;
          case "avatar":
            avatar = file;
            break;
          default:
            break;
        }
      });
    }

    if (govt_id_upload) {
      gimg = await uploadToAzureBlob(govt_id_upload);
    }
    if (pan_upload) {
      pimg = await uploadToAzureBlob(pan_upload);
    }
    if (avatar) {
      aimg = await uploadToAzureBlob(avatar);
    }
    let country_id;
    if(state_id){
     
      await getCountryByStateId(state_id).then((obj) => {
        country_id = obj.country_id;
      }).catch((error) => {
        console.log('call error');
      })
    }
  


    if (bodyReferralCode) {
      referral_code = bodyReferralCode;
    }



    // Generate PreFix
    const [result1] = await pool.query(`SELECT prefix FROM \`${tableName3}\` WHERE id = ? LIMIT 1`, [role_id]);
    const rolePrefixName = result1[0]?.prefix || '';
    const [result2] = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\` WHERE role_id = ?`, [role_id]);
    const formattedNumber = String(result2[0]?.count + 1).padStart(4, '0');
    const newPrefix = `${rolePrefixName}A${formattedNumber}`;

    
    

    // // Password Validation
    // if (!validatePassword(password)) {
    //   return sendResponse(res, { error: 'Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter and one special character.', status: false }, 400);
    // }
    
    // Hash the password
    const hashedPassword = newPrefix ? await bcrypt.hash(newPrefix, 10) : undefined;

    // Generate unique referral code
    const uniqueCode = uniqueId.slice(0, 8); // Generate a short UUID
    const randomCode = Math.floor(100 + Math.random() * 900);
    const referralCode = `${first_name}-${last_name}-${uniqueCode}${randomCode}`;

    // Insertion
    const [insertResult] = await pool.query(`INSERT INTO ${tableName} (role_id, first_name, last_name, email, password, prefix_id, phone, avatar) VALUES (?,?,?,?,?,?, ?, ?)`, [
      role_id, first_name, last_name, email, hashedPassword, newPrefix, phone, aimg
    ]);

    const insertedRecordId = insertResult.insertId;

    // User Details - Insertion
    await pool.query(`INSERT INTO ${tableName2} (user_id, my_referral_code, country_id, state_id, district_id,pincode,post_office_id, address, pan_number, govt_id_number, govt_id_upload, pan_upload) VALUES (?,?,?,?,?,?,?, ?, ?, ?, ?,?)`, [
      insertedRecordId, referralCode, country_id, state_id, district_id, pincode, post_office_id, address, pan_number, govt_id_number, gimg, pimg
    ]);


    // Find refer_id if referral_code is provided
    let referId = null;
    if (referral_code) {
      const [referralUser] = await pool.query(`SELECT user_id FROM ${tableName2} WHERE my_referral_code = ? LIMIT 1`, [referral_code]);
      if (referralUser.length > 0) {
        referId = referralUser[0].user_id;
      }
    }

    let referAmt = 0;
    const [settingData] = await pool.query(`SELECT referral_amount FROM ${tableName5} WHERE id = ? LIMIT 1`, [1]);
    if (settingData.length > 0) {
      referAmt = settingData[0].referral_amount;
    }

    if (referId) {
      await pool.query(`INSERT INTO ${tableName4} (user_id, refer_id, amount) VALUES (?,?,?)`, [
        insertedRecordId, referId, referAmt
      ]);
    }

    // const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

    // await activityLog(ine_users_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

    // return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);
    return sendResponse(res, { message: "Account Successfully Registered", status: true }, 201);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// List
router.get('/', async (req, res) => {
  try {
    await authenticateToken(req);
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
   
    const id = getQueryParamId(fullUrl);
    const baseQuery = `SELECT 
          u.*, ir.name as rolename, ud.date_of_birth, ud.anniversary, ud.gender, ud.address, st.name as state, ud.state_id, sd.name as district, ud.district_id, ud.pincode,ud.post_office_id,pt.name as post_office_name, ud.govt_id_number, ud.govt_id_upload, ud.pan_number, ud.pan_upload, ud.my_referral_code 
          FROM \`${tableName}\` as u 
            LEFT JOIN \`${tableName2}\` as ud on ud.user_id = u.id 
            LEFT JOIN \`${tableName3}\` as ir on ir.id = u.role_id 
            LEFT JOIN \`${TABLE.STATE_TABLE}\` st ON st.id = ud.state_id
            LEFT JOIN \`${TABLE.DISTRICT_TABLE}\` sd ON sd.id = ud.district_id
            LEFT JOIN \`${TABLE.POSTOFFICE_TABLE}\` pt ON pt.id = ud.post_office_id
            WHERE u.status = 1`;

    if (id) {
      const query1 = `${baseQuery} AND u.id = ? ORDER BY u.id DESC`;
      const [results] = await pool.query(query1, [id]);

      if (results.length > 0) {
        return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
      }
      return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    }

    const query2 = `${baseQuery} ORDER BY u.id DESC`;
    const [results] = await pool.query(query2);

    if (results.length > 0) {
      return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    }

    return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Frontend - Profile
router.put('/frontendprofile', upload.any(), async (req, res) => {
  try {

    await authenticateToken(req);
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const id = getQueryParamId(fullUrl);

    if (!id) {
      return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
    }

    const [existingRecord] = await getRecordById(id, tableName, 'id');
    if (!existingRecord) {
      return sendResponse({ error: ManageResponseStatus('notFound'), status: false }, 404);
    }

    const { first_name, last_name, email, phone, gender, date_of_birth, anniversary } = req.body;

    // Validate request data
    if (!first_name || !last_name || !email || !phone) {
      return sendResponse(res, { error: 'First Name, Last Name, Email and Phone field is required', status: false }, 400);
    }

    // Validate date_of_birth
    if (date_of_birth && !isValidDate(date_of_birth)) {
      return sendResponse(res, { error: 'Invalid Date of Birth', status: false }, 400);
    }

    // Validate anniversary
    if (anniversary && !isValidDate(anniversary)) {
      return sendResponse(res, { error: 'Invalid Anniversary', status: false }, 400);
    }

    // Email Validation
    if (email) {
      const emailExists = await checkEmailExistOrNot(tableName, email, id);
      if (emailExists) {
        return sendResponse(res, { error: 'Email already exists', status: false }, 409);
      }
    }

    // Phone Validation
    if (phone) {
      const phoneExists = await checkPhoneExistOrNot(tableName, phone, id);
      if (phoneExists) {
        return sendResponse(res, { error: 'Phone already exists', status: false }, 409);
      }
    }

    let updateQuery = `UPDATE ${tableName} SET first_name = ?, last_name = ?, email = ?, phone = ?, updated_at = NOW()`;
    let queryParams = [first_name, last_name, email, phone];
    updateQuery += ` WHERE id = ?`;
    queryParams.push(id);

    await pool.query(updateQuery, queryParams);

    await pool.query(`UPDATE ${tableName2} SET date_of_birth = ?, anniversary = ?, gender = ? WHERE user_id = ?`, [date_of_birth, anniversary, gender, id]);

    const [updatedRecord] = await getRecordById(id, tableName, 'id');

    return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Profile
router.put('/', upload.any(), async (req, res) => {
  try {
    //await authenticateToken(req);
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const id = getQueryParamId(fullUrl);

    if (!id) {
      return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
    }

    // Check if the ID exists in the database and retrieve the existing record
    const [existingRecord] = await getRecordById(id, tableName, 'id');

    if (!existingRecord) {
      return sendResponse({ error: ManageResponseStatus('notFound'), status: false }, 404);
    }

    const [existingRecord2] = await getRecordDetailById(id, tableName2, 'user_id');

    const { role_id, first_name, last_name, email, phone, password, gender, govt_id_number, pan_number, date_of_birth, anniversary, status, state_id, district_id, address, pincode,post_office_id } = req.body;

    // Validate request data
    if (!first_name || !last_name || !email || !phone) {
      return sendResponse(res, { error: 'First Name, Last Name, Email and Phone field is required', status: false }, 400);
    }

    // Validate date_of_birth
    if (date_of_birth && !isValidDate(date_of_birth)) {
      return sendResponse(res, { error: 'Invalid Date of Birth', status: false }, 400);
    }

    // Validate anniversary
    if (anniversary && !isValidDate(anniversary)) {
      return sendResponse(res, { error: 'Invalid Anniversary', status: false }, 400);
    }

    // Email Validation
    if (email) {
      const emailExists = await checkEmailExistOrNot(tableName, email, id);
      if (emailExists) {
        return sendResponse(res, { error: 'Email already exists', status: false }, 409);
      }
    }

    // Phone Validation
    if (phone) {
      const phoneExists = await checkPhoneExistOrNot(tableName, phone, id);
      if (phoneExists) {
        return sendResponse(res, { error: 'Phone already exists', status: false }, 409);
      }
    }

    let country_id;
    await getCountryByStateId(state_id).then((obj) => {
      country_id = obj.country_id;
    }).catch((error) => {
      console.log('call error');
    })



    let govt_id_upload;
    let pan_upload;
    let avatar;
    let gimg;
    let pimg;
    let aimg;



    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        switch (file.fieldname) {
          case "govt_id_upload":
            govt_id_upload = file;
            break;
          case "pan_upload":
            pan_upload = file;
            break;
          case "avatar":
            avatar = file;
            break;
          default:
            break;
        }
      });
    }

    if (govt_id_upload) {
      gimg = await uploadToAzureBlob(govt_id_upload);
    }
    if (pan_upload) {
      pimg = await uploadToAzureBlob(pan_upload);
    }
    if (avatar) {
      aimg = await uploadToAzureBlob(avatar);
    }

    if (govt_id_upload == null) {
      gimg = existingRecord2.govt_id_upload;
    }

    if (avatar == null) {
      aimg = existingRecord.avatar;
    }
    if (pan_upload == null) {
      pimg = existingRecord2.pan_upload;
    }





    // var aimg = await processImageUpload('avatar', avatar, avatarFolderPath);
    // var aimg = await processDocuments(avatar); // Avatar Document

    // Build the query and parameter array based on the presence of password value
    let updateQuery = `UPDATE ${tableName} SET role_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?, avatar = ?, updated_at = NOW()`;
    let queryParams = [role_id, first_name, last_name, email, phone, aimg];

    // Check if the password field has a value, if yes, include it in the update query
    if (password !== undefined && password !== "") {

      // Password Validation
      if (!validatePassword(password)) {
        return sendResponse(res, { error: 'Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter and one special character.', status: false }, 400);
      }

      // Hash the password
      const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

      updateQuery += `, password = ?`;
      queryParams.push(hashedPassword);
    }

    updateQuery += ` WHERE id = ?`;
    queryParams.push(id);

    await pool.query(updateQuery, queryParams);

    await pool.query(`UPDATE ${tableName2} SET date_of_birth = ?, anniversary = ?, gender = ?, govt_id_number = ?, pan_number = ?, govt_id_upload = ?, pan_upload = ?, state_id = ?, district_id = ?, country_id = ?, address = ?, pincode = ? , post_office_id = ? WHERE user_id = ?`, [date_of_birth, anniversary, gender, govt_id_number, pan_number, gimg, pimg, state_id, district_id, country_id, address, pincode,post_office_id, id]);

    // const query1 = `SELECT u.*, ir.name as rolename, ud.date_of_birth, ud.anniversary, ud.gender, ud.address, ud.state, ud.district, ud.pincode, ud.govt_id_number, ud.govt_id_upload, ud.pan_number, ud.pan_upload, ud.my_referral_code FROM \`${tableName}\` as u LEFT JOIN \`${tableName2}\` as ud on ud.user_id = u.id LEFT JOIN \`${tableName3}\` as ir on ir.id = u.role_id where u.status = 1 AND u.id = ? ORDER BY u.id DESC`;

    const query1 = `SELECT 
          u.*, ir.name as rolename, ud.date_of_birth, ud.anniversary, ud.gender, ud.address, st.name as state, ud.state_id, sd.name as district, ud.district_id, ud.pincode,ud.post_office_id,pt.name as post_office_name, ud.govt_id_number, ud.govt_id_upload, ud.pan_number, ud.pan_upload, ud.my_referral_code 
          FROM \`${tableName}\` as u 
            LEFT JOIN \`${tableName2}\` as ud on ud.user_id = u.id 
            LEFT JOIN \`${tableName3}\` as ir on ir.id = u.role_id 
            LEFT JOIN \`${TABLE.STATE_TABLE}\` st ON st.id = ud.state_id
            LEFT JOIN \`${TABLE.DISTRICT_TABLE}\` sd ON sd.id = ud.district_id
            LEFT JOIN \`${TABLE.POSTOFFICE_TABLE}\` pt ON pt.id = ud.post_office_id
            WHERE u.status = 1 AND u.id = ? ORDER BY u.id DESC`;
    const [updatedRecord] = await pool.query(query1, [id]);


    // Retrieve the updated record
    // const [updatedRecord] = await getRecordById(id, tableName, 'id');

    // await activityLog(ine_users_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

    return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Delete
router.delete('/', async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const id = getQueryParamId(fullUrl);

    const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

    if (!deletedIds || deletedIds.length === 0) {
      return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
    }

    await Promise.all(deletedIds.map(async (deletedId) => {
      const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
      activityLog(ine_users_ModuleID, currentRecord, null, 3, 0);
    }));

    const query = `UPDATE ${tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;

    const [results] = await pool.query(query, [deletedIds]);
    if (results.affectedRows > 0) {
      return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
    }
    return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Forgot Password
router.put('/forgotpassword', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendResponse(res, { error: 'Email field is required', status: false }, 400);
    }

    // Check if email exists
    const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE email = ?`, [email]);
    if (existingRecord.length === 0) {
      return sendResponse(res, { error: 'Email not found', status: false }, 404);
    }

    const otp = generateOTP(6);
    await pool.query(`UPDATE ${tableName} SET otp = ?, updated_at = NOW() WHERE email = ?`, [otp, email]);
    const [updatedRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE email = ?`, [email]);
    await activityLog(ine_users_ModuleID, existingRecord, updatedRecord, 2, 0);

    // await sendOTPEmail(email, otp);
    return sendResponse(res, { message: 'OTP has been sent to your email', status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// OTP
router.post('/otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    var otpconvert = parseInt(otp, 10);

    if (!email || !otpconvert) {
      return sendResponse(res, { error: 'Email and OTP fields are required', status: false }, 400);
    }

    const [existingRecordResults] = await pool.query(`SELECT * FROM ${tableName} WHERE email = ?`, [email]);

    if (existingRecordResults.length === 0) {
      return sendResponse(res, { error: 'Email not found', status: false }, 404);
    }

    const existingRecord = existingRecordResults[0];

    if (existingRecord.otp !== otpconvert) {
      return sendResponse(res, { error: 'Sorry, OTP is Invalid', status: false }, 400);
    }

    await pool.query(`UPDATE ${tableName} SET otp = NULL, updated_at = NOW() WHERE email = ?`, [email]);

    // Retrieve the updated record
    const [updatedRecordResults] = await pool.query(`SELECT * FROM ${tableName} WHERE email = ?`, [email]);
    const updatedRecord = updatedRecordResults[0];

    return sendResponse(res, { paramsID: updatedRecord.id, message: 'OTP verified successfully', status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// New Password
router.post('/newpassword', async (req, res) => {
  try {
    const { email, new_password, confirm_password, paramsID } = req.body;

    const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE email = ?`, [email]);
    if (!existingRecord) {
      return sendResponse(res, { error: 'Email not found', status: false }, 404);
    }

    if (!new_password || !confirm_password) {
      return sendResponse(res, { error: 'New Password and Confirm Password fields are required', status: false }, 400);
    }

    if (!validatePassword(new_password)) {
      return sendResponse(res, { error: 'New Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.', status: false }, 400);
    }
    if (new_password !== confirm_password) {
      return sendResponse(res, { error: 'New Password and Confirm Password do not match.', status: false }, 400);
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const [updateResult] = await pool.query(`UPDATE ${tableName} SET password = ?, updated_at = NOW() WHERE email = ? and id = ?`, [hashedPassword, email, paramsID]);

    if (updateResult.affectedRows === 0) {
      return sendResponse(res, { error: 'Something Wrong!', status: false }, 400);
    }

    const [updatedRecord] = await getRecordById(paramsID, tableName, 'id');
    await activityLog(ine_users_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

    return sendResponse(res, { message: 'Password Successfully Updated', status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Deactivate
router.delete('/deactivate', async (req, res) => {
  try {

    await authenticateToken(req);
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const id = getQueryParamId(fullUrl);

    const deletedIds = id ? [id] : getQueryParamIds(fullUrl);

    if (!deletedIds || deletedIds.length === 0) {
      return sendResponse(res, { error: "Account ID must be requird", status: false }, 400);
    }

    await Promise.all(deletedIds.map(async (deletedId) => {
      const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
      activityLog(ine_users_ModuleID, currentRecord, null, 3, 0); // Maintain Activity Log
    }));

    const [results] = await pool.query(`UPDATE ${tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`, [deletedIds]);

    if (results.affectedRows > 0) {
      return sendResponse(res, { message: "Account has been successfully deactivated. For more information, please contact the administrator", status: true }, 200);
    }
    return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Change Password
router.put('/changepassword', async (req, res) => {
  try {
    await authenticateToken(req);

    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const id = getQueryParamId(fullUrl);

    if (!id) {
      return sendResponse(res, { error: 'User ID must be provided', status: false }, 400);
    }

    // Check if the ID exists in the database and retrieve the existing record
    const [existingRecordResults] = await pool.query(`SELECT * FROM ine_users WHERE id = ?`, [id]);
    if (existingRecordResults.length === 0) {
      return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    }

    const { current_password, new_password, confirm_password } = req.body;

    // Field Validation
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || typeof confirm_password !== 'string') {
      return sendResponse(res, { error: 'All fields must be strings', status: false }, 400);
    }

    if (!current_password || !new_password || !confirm_password) {
      return sendResponse(res, { error: 'Current Password, New Password, and Confirm Password fields are required', status: false }, 400);
    }

    // Validate the current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, existingRecordResults[0].password);

    if (!isCurrentPasswordValid) {
      return sendResponse(res, { error: 'Current Password is Incorrect', status: false }, 401);
    }

    // Password Validation
    if (!validatePassword(new_password)) {
      return sendResponse(res, { error: 'New Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.', status: false }, 400);
    }

    if (!validatePassword(confirm_password)) {
      return sendResponse(res, { error: 'Confirm Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.', status: false }, 400);
    }

    if (new_password !== confirm_password) {
      return sendResponse(res, { error: 'New Password and Confirm Password do not match.', status: false }, 400);
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update the password in the database
    await pool.query(`UPDATE ${tableName} SET password = ?, updated_at = NOW() WHERE id = ?`, [hashedPassword, id]);

    // Retrieve the updated record
    const [updatedRecord] = await getRecordById(id, tableName, 'id');

    await activityLog(ine_users_ModuleID, existingRecordResults, updatedRecord, 2, 0); // Maintain Activity Log

    return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
  }
});

// Notifications: Add/Update
router.post('/notifications', async (req, res) => {
  try {

    await authenticateToken(req);

    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const url = new URL(fullUrl);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return sendResponse(res, { error: 'User ID must be required', status: false }, 400);
    }

    const { notification_new_order_email, notification_order_shipping_email, notification_order_delivery_email } = req.body;

    const notifications = [
      { key: 'notification_new_order_email', value: notification_new_order_email || 'off' },
      { key: 'notification_order_shipping_email', value: notification_order_shipping_email || 'off' },
      { key: 'notification_order_delivery_email', value: notification_order_delivery_email || 'off' }
    ];

    // Construct the update query
    for (const notification of notifications) {
      const [affectedRows] = await pool.query(`UPDATE ${tableName7} SET meta_value = ?, updated_at = NOW() WHERE user_id = ? AND meta_key = ?`, [notification.value, userId, notification.key]);
      if (affectedRows.affectedRows === 0) {
        await pool.query(`INSERT INTO ${tableName7} (user_id, meta_key, meta_value, created_at) VALUES (?, ?, ?, NOW())`, [userId, notification.key, notification.value]);
      }
    }

    return sendResponse(res, { data: notifications, message: ManageResponseStatus('updated'), status: true }, 200);
  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

// Notifications: All List & Specific List
router.get('/notifications', async (req, res) => {
  try {

    await authenticateToken(req);

    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const url = new URL(fullUrl);
    const userId = url.searchParams.get('user_id');

    let results;
    if (userId) {
      [results] = await pool.query(`SELECT * FROM ${tableName7} WHERE user_id = ?`, [userId]);
    } else {
      [results] = await getRecordById(null, tableName, 'id');
    }

    return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

router.post('/rolepermissionmodule', async (req, res) => {
  try {
    // await authenticateToken(req);
    const { userId, indexOf } = req.body;

    try {

      const sql = `
              SELECT inep.*, inem.name, inem.icon, inem.path 
              FROM \`ine_permissions\` inep
              INNER JOIN \`ine_users\` ineu ON inep.role_id = ineu.role_id
              LEFT JOIN \`ine_modules\` inem ON inem.id = inep.module_id
              WHERE ineu.id = ? 
              AND inem.index_of = ? 
              AND inep.read_access = 1
              `;
      const [results] = await pool.query(sql, [userId, indexOf]);

      return sendResponse(res, { data: results, status: true }, 200);
    } catch (error) {
      return sendResponse(res, { error: `Error occurred while executing SQL query: ${error.message}`, status: false }, 500);
    }
  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
})

router.get('/verify-token', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'Token is required', status: false });
    }
    jwt.verify(token, API_SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid or expired token', status: false });
      }
      return res.status(200).json({ data: decoded, message: 'Token is valid', status: true });
    });
  } catch (error) {
    return res.status(500).json({ error: `Error occurred: ${error.message}`, status: false });
  }
});


router.post('/sendOtp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return sendResponse(res, { error: 'Phone number field is required', status: false }, 400);
    }

    // Check if email exists
    const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE phone = ?`, [phone]);
    if (existingRecord.length === 0) {
      return sendResponse(res, { error: 'Account not found for this phone number', status: false }, 404);
    }

    const otp = generateOTP(6);
    await pool.query(`UPDATE ${tableName} SET login_otp = ?, updated_at = NOW() WHERE phone = ?`, [otp, phone]);
    const [updatedRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE phone = ?`, [phone]);
    await activityLog(ine_users_ModuleID, existingRecord, updatedRecord, 2, 0);

    // await sendOTPEmail(email, otp);
    return sendResponse(res, { message: 'OTP has been sent to your mobile', status: true ,otp:otp}, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});
router.post('/validateLoginOtp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    var otpconvert = parseInt(otp, 10);

    if (!phone || !otpconvert) {
      return sendResponse(res, { error: 'Mobile and OTP fields are required', status: false }, 400);
    }

    const [existingRecordResults] = await pool.query(`SELECT * FROM ${tableName} WHERE phone = ?`, [phone]);

    if (existingRecordResults.length === 0) {
      return sendResponse(res, { error: 'Acount not found', status: false }, 404);
    }

    const existingRecord = existingRecordResults[0];

    if (existingRecord.login_otp !== otpconvert) {
      return sendResponse(res, { error: 'Sorry, OTP is Invalid', status: false }, 400);
    }

    await pool.query(`UPDATE ${tableName} SET login_otp = NULL, updated_at = NOW() WHERE phone = ?`, [phone]);

    // Retrieve the updated record
    const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE phone = ?`, [phone]);

    const user = {
      id: results[0].id,
      first_name: results[0].first_name,
      last_name: results[0].last_name,
      prefix_id: results[0].prefix_id,
      phone: results[0].phone,
      email: results[0].email,
    };
    const token = jwt.sign({ data: user }, API_SECRET_KEY, { expiresIn: API_TOKEN_EXPIRESIN });

    return await sendResponse(res, { message: 'Logged In Successfuly', accessToken: token, status: true }, 200);

  } catch (error) {
    return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
  }
});

module.exports = router;