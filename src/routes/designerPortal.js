const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const TABLE = require("../utils/tables");
const pool = require("../utils/db");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const {
  getQueryParamId,
  getRecordById,
  ManageResponseStatus,
  sendResponse,
  getQueryParamIds,
  checkEmailExistOrNot,
  checkPhoneExistOrNot,
  processDocuments,
  activityLog,
  processDocument,
  getRecordsByGiftcardId,
  insertOrUpdateRecordintoFrontend,
  processImageUpload,
  mergeMarketingPendingtoMain,
  uploadToAzureBlob,
  generateRandomCode,
} = require("../commonFunctions");
const { authenticateToken } = require("../utils/authMiddleware");
const { getDesignerDetail } = require("../utils/designerDetail");
const multer = require("multer");

// LINKS FOR THE STORAGE UPLOAD
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const router = express.Router();

// Table Name
const designer_tableName = TABLE.DESIGNER;
const ine_designer_ModuleID = TABLE.DESIGNER_MODULE_ID;
const ine_manage_request_tablename = "ine_manage_request";
const ine_giftcard_ModuleID = TABLE.GIFTCARD_MODULE_ID;
const ine_replicator_moduleID = TABLE.REPLICATOR_MODULE;
const ine_marekting_ModuleID = TABLE.MARKETING_MODULE_ID;
const ine_campaign_ModuleID = TABLE.CAMPAIGN_MODULE_ID;
const ine_supportchannel_ModuleID = TABLE.SUPPORT_CHANNEL_MODULE_ID;
const ine_affiliate_ModuleID = TABLE.AFFILIATE_MODULE_ID;

router.get("/:id?", async (req, res) => {
  try {
    await authenticateToken(req);
    const id = req.params.id || req.query.id;
    return await getDesignerDetail(id, req, res);
  } catch (error) {
    return sendResponse(
      res,
      { error: `Error occurred: ${error.message}` },
      500
    );
  }
});

router.post("/", upload.any(), async (req, res) => {
  await authenticateToken(req);
  try {
    const requestData = await req.body;
    // console.log("req.file", req.files);
    // console.log("requestDatarequestData", requestData);

    // Validate request data
    if (
      !requestData.title ||
      !requestData.category_id ||
      !requestData.resin_id ||
      !requestData.shape_id ||
      !requestData.size_id ||
      !requestData.bezel_material_id ||
      !requestData.bezel_color_id ||
      !requestData.Inner_material_id ||
      !requestData.flower_id ||
      !requestData.color_id
    ) {
      return sendResponse(
        res,
        {
          error:
            "Title, Category, Resin, Shape, Size, Bezel Material, Bezel Color, Inner Material, Flower and Color fields is required",
          status: false,
        },
        400
      );
    }

    const image1File = req.files[0] ? req.files[0] : null;
    const image2File = req.files[1] ? req.files[1] : null;
    const image3File = req.files[2] ? req.files[2] : null;
    const image4File = req.files[3] ? req.files[3] : null;
    const image5File = req.files[4] ? req.files[4] : null;
    const image6File = req.files[5] ? req.files[5] : null;

    if (image1File) {
      requestData.image1 = await uploadToAzureBlob(image1File);
    }
    if (image2File) {
      requestData.image2 = await uploadToAzureBlob(image2File);
    }
    if (image3File) {
      requestData.image3 = await uploadToAzureBlob(image3File);
    }
    if (image4File) {
      requestData.image4 = await uploadToAzureBlob(image4File);
    }
    if (image5File) {
      requestData.image5 = await uploadToAzureBlob(image5File);
    }
    if (image6File) {
      requestData.image6 = await uploadToAzureBlob(image6File);
    }

    // Insertion
    const [insertResult] = await pool.query(
      `INSERT INTO ${designer_tableName} (title,created_by, category_id, resin_id, shape_id, size_id, bezel_material_id, bezel_color_id, Inner_material_id, flower_id, color_id, image1, image2, image3, image4, image5, image6,in_pair) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        requestData.title,
        requestData.apihitid,
        requestData.category_id,
        requestData.resin_id,
        requestData.shape_id,
        requestData.size_id,
        requestData.bezel_material_id,
        requestData.bezel_color_id,
        requestData.Inner_material_id,
        requestData.flower_id,
        requestData.color_id,
        requestData.image1,
        requestData.image2,
        requestData.image3,
        requestData.image4,
        requestData.image5,
        requestData.image6,
        requestData.in_pair,
      ]
    );

    const insertedRecordId = insertResult.insertId;

    const [insertedRecord] = await getRecordById(
      insertedRecordId,
      designer_tableName,
      "id"
    ); // Retrieve the inserted record

    await pool.query(
      `INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`,
      [ine_designer_ModuleID, insertedRecordId, 1, null, requestData.apihitid]
    );

    // await activityLog(ine_designer_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

    return sendResponse(
      res,
      {
        data: insertedRecord[0],
        message: ManageResponseStatus("created"),
        status: true,
      },
      201
    );
  } catch (error) {
    return sendResponse(
      res,
      { error: `Error occurred: ${error.message}` },
      500
    );
  }
});

router.put("/:id", upload.any(), async (req, res) => {
  try {
    await authenticateToken(req);
    const id = req.params.id || req.query.id;
    if (!id) {
      return sendResponse(
        res,
        { error: ManageResponseStatus("RowIdRequired"), status: false },
        400
      );
    }

    // Check if the ID exists in the database and retrieve the existing record
    const [existingRecord] = await getRecordById(id, designer_tableName, "id");

    if (!existingRecord) {
      return sendResponse(
        res,
        { error: ManageResponseStatus("notFound"), status: false },
        404
      );
    }

    const {
      title,
      category_id,
      resin_id,
      shape_id,
      size_id,
      bezel_material_id,
      bezel_color_id,
      Inner_material_id,
      flower_id,
      color_id,
      in_pair,
      apihitid,
      image1,
      image2,
      image3,
      image4,
      image5,
      image6
    } = await req.body;

    // Validate request data
    if (
      !title ||
      !category_id ||
      !resin_id ||
      !shape_id ||
      !size_id ||
      !bezel_material_id ||
      !bezel_color_id ||
      !Inner_material_id ||
      !flower_id ||
      !color_id ||
      !in_pair
    ) {
      return sendResponse(
        res,
        {
          error:
            "Title, Category, Resin, Shape, Size, Bezel Material, Bezel Color, Inner Material, Flower,Pair and Color fields are required",
          status: false,
        },
        400
      );
    }

    let image1File;
    let image2File;
    let image3File;
    let image4File;
    let image5File;
    let image6File;

    let image1Data = existingRecord.image1;
    let image2Data = existingRecord.image2;
    let image3Data = existingRecord.image3;
    let image4Data = existingRecord.image4;
    let image5Data = existingRecord.image5;
    let image6Data = existingRecord.image6;

    req.files.forEach((file) => {
      switch (file.fieldname) {
        case "image1":
          image1File = file;
          break;
        case "image2":
          image2File = file;
          break;
        case "image3":
          image3File = file;
          break;
        case "image4":
          image4File = file;
          break;
        case "image5":
          image5File = file;
          break;
        case "image6":
          image6File = file;
          break;
        default:
          break;
      }
    });

    if (image1File) {
      image1Data = await uploadToAzureBlob(image1File);
    }
    if (image2File) {
      image2Data = await uploadToAzureBlob(image2File);
    }
    if (image3File) {
      image3Data = await uploadToAzureBlob(image3File);
    }
    if (image4File) {
      image4Data = await uploadToAzureBlob(image4File);
    }
    if (image5File) {
      image5Data = await uploadToAzureBlob(image5File);
    }
    if (image6File) {
      image6Data = await uploadToAzureBlob(image6File);
    }



    if (!image1 && image1File == undefined) {
      image1Data = null;
    }

    if (!image2 && image2File == undefined) {
      image2Data = null;
    }

    if (!image3 && image3File == undefined) {
      image3Data = null;
    }

    if (!image4 && image4File == undefined) {
      image4Data = null;
    }

    if (!image5 && image5File == undefined) {
      image5Data = null;
    }

    if (!image6 && image6File == undefined) {
      image6Data = null;
    }




    // Update record in the database
    await pool.query(
      `UPDATE ${designer_tableName} SET title = ?, record_status=?, updated_by = ?, category_id = ?, resin_id = ?, shape_id = ?, size_id = ?, bezel_material_id = ?, bezel_color_id = ?, Inner_material_id = ?, flower_id = ?, color_id = ?, image1 = ?, image2 = ?, image3 = ?, image4 = ?, image5 = ?, image6 = ?,in_pair=?, updated_at = NOW() WHERE id = ?`,
      [
        title,
        1,
        apihitid,
        category_id,
        resin_id,
        shape_id,
        size_id,
        bezel_material_id,
        bezel_color_id,
        Inner_material_id,
        flower_id,
        color_id,
        image1Data,
        image2Data,
        image3Data,
        image4Data,
        image5Data,
        image6Data,
        in_pair,
        id,
      ]
    );

    // Retrieve the updated record
    const [updatedRecord] = await getRecordById(id, designer_tableName, "id");

    // Maintain Activity Log
    await activityLog(
      ine_designer_ModuleID,
      existingRecord,
      updatedRecord,
      2,
      0
    );

    // Return success response
    return sendResponse(
      res,
      {
        data: updatedRecord,
        message: ManageResponseStatus("updated"),
        status: true,
      },
      200
    );
  } catch (error) {
    // Return error response
    return sendResponse(
      res,
      { error: `Error occurred: ${error.message}` },
      500
    );
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await authenticateToken(req);
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const id = req.params.id || req.query.id;
    const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));
    if (!deletedIds || deletedIds.length === 0) {
      return sendResponse(
        res,
        { error: ManageResponseStatus("RowIdRequired"), status: false },
        400
      );
    }
    await Promise.all(
      deletedIds.map(async (deletedId) => {
        const [currentRecord] = await getRecordById(
          deletedId,
          designer_tableName,
          "id"
        );
        //activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0);
      })
    );
    const query = `UPDATE ${designer_tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;
    const formattedQuery = mysql.format(query, [deletedIds]);
    const [results] = await pool.query(query, [deletedIds]);
    if (results.affectedRows > 0) {
      return sendResponse(
        res,
        { message: ManageResponseStatus("deleted"), status: true },
        200
      );
    }
    return sendResponse(
      res,
      { error: ManageResponseStatus("notFound"), status: false },
      404
    );
  } catch (error) {
    return sendResponse(
      res,
      { error: `Error occurred: ${error.message}` },
      500
    );
  }
});

router.put("/approved/:id", async (req, res) => {
  try {
    //await authenticateToken(req);
    const id = req.params.id || req.query.id;
    const { moduleId, record_status, rowID, roleid, apihitid } = await req.body;
    if (!id) {
      return sendResponse(
        res,
        { error: ManageResponseStatus("RowIdRequired"), status: false },
        400
      );
    }
    let tableName;
    let tableName2 = ine_manage_request_tablename;
    let tableName3 = TABLE.SERIAL_NUMBER;
    let tableName4 = TABLE.PRODUCTS;

    switch (moduleId) {
      case ine_designer_ModuleID:
        tableName = designer_tableName;
        break;
      case ine_giftcard_ModuleID:
        tableName = TABLE.GIFTCARD_TABLE;
        break;
      case ine_replicator_moduleID:
        tableName = TABLE.REPLICATOR;
        break;
      case ine_marekting_ModuleID:
        tableName = TABLE.MARKETING_PENDING;
        break;
      case ine_campaign_ModuleID:
        tableName = TABLE.CAMPAIGN;
        break;
      case ine_supportchannel_ModuleID:
        tableName = TABLE.ORDER_RETURN;
        break;
      case ine_affiliate_ModuleID:
        tableName = TABLE.AFFILIATE_TABLE;
        break;
      default:
        tableName = "";
        tableName2 = "";
    }
    const [existingRecord] = await getRecordById(rowID, tableName, "id");
    // DESIGNER MODULE
    if (moduleId === ine_designer_ModuleID) {
      let CategoryCode = "";
      let ResinCode = "";
      let ShapeNumber = "";
      const [categoryResult] = await pool.query(
        `SELECT * FROM ine_category WHERE id = ?`,
        [existingRecord.category_id]
      );
      if (categoryResult.length > 0) {
        CategoryCode = categoryResult[0].code;
      }

      // Fetching resin code
      const [resinResult] = await pool.query(
        `SELECT * FROM ine_resin WHERE id = ?`,
        [existingRecord.resin_id]
      );
      if (resinResult.length > 0) {
        ResinCode = resinResult[0].code;
      }

      // Fetching shape number
      const [shapeResult] = await pool.query(
        `SELECT * FROM ine_shape WHERE id = ?`,
        [existingRecord.shape_id]
      );
      if (shapeResult.length > 0) {
        ShapeNumber = shapeResult[0].sequence_number;
      }
      if (!existingRecord) {
        return sendResponse(
          res,
          { error: ManageResponseStatus("notFound"), status: false },
          404
        );
      }
      // Validate request data
      if (!record_status) {
        return sendResponse(
          res,
          { error: "Record Status field is required", status: false },
          400
        );
      }

      var model_number = await generateRandomNumber(
        CategoryCode,
        ResinCode,
        ShapeNumber
      );
      var sub_model_number = await generateRandomNumberforSubcategory();

      await pool.query(
        `UPDATE ${tableName} SET record_status = ?, model_number = ?, sub_model_number = ?, updated_by=?, updated_at=NOW()  WHERE id = ?`,
        [record_status, model_number, sub_model_number, apihitid, rowID]
      );
      // await pool.query(`UPDATE ${tableName2} SET request_status = ?, updated_at = NOW() WHERE id = ? `, [record_status, id]);
    }
    // IF MODULE IS GIFTCARD
    if (moduleId === ine_giftcard_ModuleID) {
      let totalAmount = 0;
      let cardCount = 0;
      let expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      expiryDate.setHours(23, 59, 59, 999);
      await pool.query(
        `UPDATE ${tableName} SET  record_status = ?, updated_at = NOW() WHERE id = ?`,
        [record_status, rowID]
      );
      /*const [requestData] = await getRecordsByGiftcardId(
        rowID,
        TABLE.GIFTCARD_CALCULATE_TABLE,
        "giftcard_id"
      );*/

      const [requestData] = await pool.query(`SELECT * FROM ${TABLE.GIFTCARD_CALCULATE_TABLE} WHERE status = 0 and giftcard_id = ?`, [rowID]);

      // Iterate over the fetched data
      for (const denominationItem of requestData) {
        const { id, denomination, multiplication } = denominationItem;

        for (let i = 0; i < multiplication; i++) {
          const giftCardNumber = await generateUniqueGiftCardNumber();
          const pinNumber = await generateUniquePinNumber();

          // Insert records into the third table
          await pool.query(
            `INSERT INTO ${TABLE.GIFTCARD_GENERATE_TABLE} (giftcard_calc_id,giftcard_id, gift_card_number, pin_number, amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id,
              rowID,
              giftCardNumber,
              pinNumber,
              denomination,
              expiryDate, // Define expiryDate as needed
            ]
          );
        }
      }
    }
    // REPLICATOR MODULE
    const batch_number = generateRandomBatchNumber();
    if (moduleId === ine_replicator_moduleID) {
      // Update query
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?, batch_number = ?, updated_at = NOW() WHERE id = ?`,
        [record_status, batch_number, rowID]
      );

      // Fetch necessary data for insertion
      const query1 = `SELECT 
                imr.*,
                ide.title AS dtitle,
                ids.quantity AS quantity,
                ids.batch_number AS batch_sequence_no,
                ids.id AS replicator_id,
                (SELECT in_pair FROM ${TABLE.DESIGNER} WHERE model_number = ids.designer_id) AS dpair
            FROM 
                ${tableName2} AS imr 
            LEFT JOIN 
                ${TABLE.REPLICATOR} AS ids ON ids.id = imr.row_id 
            LEFT JOIN 
                ${TABLE.DESIGNER} AS ide ON ide.id = imr.row_id 
            WHERE 
                imr.row_id = ? AND imr.module_id = ?`;

      const [GetLatestRecord] = await pool.query(query1, [rowID, moduleId]);

      if (GetLatestRecord[0] && GetLatestRecord[0].quantity) {
        for (let i = 0; i < GetLatestRecord[0].quantity; i++) {
          let serial_number =
             await generateSerialNumbers();
          let l_serial_number = "";
          let r_serial_number = "";
          let pairValue = 'No'; // Default to 2 (No)

          if (GetLatestRecord[0].dpair === "Yes") {
            pairValue = 'Yes'; // If dpair is 'yes', set pairValue to 1 (Yes)
            // Modify l_serial_number and r_serial_number accordingly
            l_serial_number = serial_number + " -L";
            r_serial_number = serial_number + " -R";
          }

          // Prepare query parameters
          const queryParameters = [
            GetLatestRecord[0].replicator_id, // Verify that this is the correct field for replicator_id
            pairValue,
            // GetLatestRecord[0].batch_sequence_no || 0, // Use batch_sequence_no from GetLatestRecord
            serial_number, // serial_number,
          ];

          // Include l_serial_number and r_serial_number only if dpair is 'yes'
          if (pairValue === 1) {
            queryParameters.push(l_serial_number);
            queryParameters.push(r_serial_number);
          } else {
            // Add null placeholders for l_serial_number and r_serial_number if dpair is not 'yes'
            queryParameters.push(null);
            queryParameters.push(null);
          }

          await pool.query(
            `INSERT INTO serial_number (replicator_id, pair, serial_number, serial_number_left, serial_number_right) VALUES (?, ?, ?, ?, ?)`,
            queryParameters
          );
        }

        await pool.query(`INSERT INTO ine_packers (replicator_id) VALUES (?)`, [
          rowID,
        ]);
      }
    }

    if (moduleId === ine_marekting_ModuleID) {
      await mergeMarketingPendingtoMain({ row_id: rowID });
    }

    // CAMPAIGN MODULE
    if (moduleId === ine_campaign_ModuleID) {
      const [query1Data] = await pool.query(`SELECT * FROM ine_campaign WHERE id = ?`, [rowID]);
      if (query1Data.length == 1) {
        
        if(query1Data[0].unique_code_for_all_customer === 1) { // 1.Yes 2.No
          const [query2Data] = await pool.query(`SELECT * FROM ine_campaign_coupon WHERE campaign_id = ?`, [rowID]);
          if (query2Data.length > 0) {
            await pool.query(`UPDATE ine_campaign_coupon SET status = 2 WHERE campaign_id = ?`, [rowID]);
          }
        }

        for (let i = 0; i < Number(query1Data[0].no_of_valid_redemptions); i++) {
          if (Number(query1Data[0].unique_code_for_all_customer) === 1) { // Yes
            let couponCode = await generateRandomCode();
            await pool.query(`INSERT INTO ine_campaign_coupon (campaign_id, coupon_code) VALUES (?, ?)`, [rowID, couponCode])
          }
        }

        await pool.query(`UPDATE ${tableName} SET record_status = ?, updated_at = NOW(), updated_by = ? WHERE id = ? `, [record_status, roleid, rowID]);
      }
    }

    // AFFILIATE MODULE
    if (moduleId === ine_affiliate_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?, updated_at = NOW(), updated_by = ? WHERE id = ? `,
        [record_status, roleid, rowID]
      );
    }

    if (moduleId === ine_supportchannel_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?, updated_at = NOW(), updated_by = ? WHERE order_id = ? `,
        [record_status, roleid, rowID]
      );
    }
    await pool.query(
      `UPDATE ${tableName2} SET request_status = ?, updated_by=?, updated_at = NOW() WHERE id = ? `,
      [record_status, apihitid, id]
    );
    const [updatedRecord] = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = ? `,
      [rowID]
    );

    // console.log('updatedRecordupdatedRecord',updatedRecord);
    await activityLog(moduleId, existingRecord, updatedRecord, 2, 0);
    return sendResponse(
      res,
      { status: true, message: "Status updated Successfully" },
      200
    );
  } catch (error) {
    return sendResponse(
      res,
      { error: `Error occurred: ${error.message}`, status: false },
      500
    );
  }
});

function generateGiftCardNumber() {
  const randomNumber = Math.floor(Math.random() * (9999999999999999 - 1) + 1);
  const numberString = randomNumber.toString().padStart(16, "0"); // Ensure the number has 16 digits
  return numberString.replace(/(\d{4})(?=\d)/g, "$1-");
}

async function generateUniqueGiftCardNumber() {
  let giftCardNumber;
  let isUnique = false;
  while (!isUnique) {
    giftCardNumber = generateGiftCardNumber();
    const [existingRecord] = await pool.query(
      `SELECT * FROM ${TABLE.GIFTCARD_GENERATE_TABLE} WHERE gift_card_number = ?`,
      [giftCardNumber]
    );
    if (existingRecord.length === 0) {
      isUnique = true;
    }
  }
  return giftCardNumber;
}

function generatePinNumber() {
  const numericCharacters = "0123456789";
  let pin = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * numericCharacters.length);
    pin += numericCharacters[randomIndex];
  }
  return pin;
}

// Genrate uniwue number for gift card
async function generateUniquePinNumber() {
  let pin_number;
  let isUnique = false;
  while (!isUnique) {
    pin_number = generatePinNumber();
    const [existingRecord] = await pool.query(
      `SELECT * FROM ${TABLE.GIFTCARD_GENERATE_TABLE} WHERE pin_number = ?`,
      [pin_number]
    );
    if (existingRecord.length === 0) {
      isUnique = true;
    }
  }
  return pin_number;
}

function generateRandomNumber(CategoryCode, ResinCode, ShapeNumber) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  // Set 1: Category Code (alphabet)
  result += CategoryCode?.charAt(0).toUpperCase(); // Taking the first character of the CategoryCode

  // Set 2: Resin Code (alphabet)
  result += "" + ResinCode?.charAt(0).toUpperCase(); // Taking the first character of the ResinCode, with a dash

  // Set 3: Shape Number (numeric)
  result += "" + ShapeNumber?.toString(); // With a dash

  // Set 4: Random Alphanumeric code
  let randomCode = "";
  for (let i = 0; i < 4; i++) {
    randomCode += characters?.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  // Combine all sets with dashes
  result += "" + randomCode;
  return result;
}

// Function to generate a unique alphanumeric sub_model_number
async function generateRandomNumberforSubcategory() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let subModelNumber = "";
  let exists = true;

  while (exists) {
    subModelNumber = ""; // Reset subModelNumber for each iteration

    // Generate an 8-character random string
    for (let i = 0; i < 8; i++) {
      subModelNumber += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    // Log the generated subModelNumber (for debugging purposes)

    try {
      // Check if the sub_model_number already exists in the database
      const [existingRecords] = await pool.query(
        `SELECT id FROM ${designer_tableName} WHERE sub_model_number = ?`,
        [subModelNumber]
      );

      // If no records are found, the sub_model_number is unique
      if (existingRecords.length === 0) {
        exists = false; // Exit the loop
      }
    } catch (error) {
      console.error("Database query error:", error);
      throw new Error(
        `Error checking sub_model_number uniqueness: ${error.message}`
      );
    }
  }

  return subModelNumber;
}
//Old function
// function generateRandomBatchNumber(length) {
//   const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
//   let batchNumber = "";
//   for (let i = 0; i < length; i++) {
//     batchNumber += characters.charAt(
//       Math.floor(Math.random() * characters.length)
//     );
//   }
//   return batchNumber;
// }
const generatedCodes = new Set();
function generateRandomBatchNumber() {

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;

  while (true) {
      // Generate a random 8-character code
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      // Check uniqueness
      if (!generatedCodes.has(code)) {
          generatedCodes.add(code); // Store the generated code
          return code;
      }
  }
}

async function fetchLuhnSequencesFromDatabase() {
  // Use your database query function here to fetch the values from the ine_settings table
  const [settings] = await pool.query(
    `SELECT replicator_luhn_sequence_left, replicator_luhn_sequence_right FROM ine_settings`
  );
  return settings[0]; // Assuming you only expect one row in the result
}
async function fetchSerialNumberCount() {
  // Use your database query function here to fetch the serial number records from the serial_number table
  const [count] = await pool.query(
    `SELECT count(*) as count FROM serial_number`
  );
  return count[0]; // Assuming you only expect one row in the result
}

function calculateLuhnCheckDigit(number) {
  const digits = number.toString().split("").map(Number);
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    alternate = !alternate;
  }
  return (sum * 9) % 10;
}

async function generateSerialNumbers() {
	/**
 	* Helper function to calculate the checksum using a weighted sum algorithm.
 	*/
   let  startPart1 = await fetchSerialNumberCount();
   startPart1 = 99999999-startPart1['count'];
	function calculateChecksum(serial) {
    	const weights = [1, 3];
    	let checksum = 0;
 
    	for (let i = 0; i < serial.length; i++) {
        	const digit = parseInt(serial[i], 10);
        	checksum += digit * weights[i % 2];
    	}
 
    	return checksum % 10; // Single-digit checksum
	}
 
	/**
 	* Helper function to generate a single serial number.
 	*/
	function generateSerialNumber(part1, part2) {
    	const formattedPart1 = String(part1).padStart(8, '0');
    	const formattedPart2 = String(part2).padStart(3, '0');
    	const combined = formattedPart1 + formattedPart2;
    	const checksum = calculateChecksum(combined);
 
    	return `${formattedPart1}${formattedPart2}${checksum}`;
	}
 
	/**
 	* Main logic to generate multiple serial numbers.
 	*/
	let serialNumber = '';
	let part1 = startPart1;
	let part2 = 1;
 

  serialNumber= generateSerialNumber(part1, part2);
 
    	// Update Part 1 and Part 2
    	part1 -= 1; // Decrement Part 1
    	part2 = (part2 % 999) + 1; // Increment Part 2 and reset to 001 after 999
	
 
	return serialNumber;
}
 

// Function to generate a unique serial number using modified sequences from the database
async function generateUniqueLuhnSerialNumberFromDatabase() {
  // Fetch replicator_luhn_sequence_left and replicator_luhn_sequence_right from the database
  const { replicator_luhn_sequence_left, replicator_luhn_sequence_right } =
    await fetchLuhnSequencesFromDatabase();

  // Decrement the left sequence by 1 and increment the right sequence by 1
  const modifiedLeftSequence = replicator_luhn_sequence_left + 1;
  const modifiedRightSequence = replicator_luhn_sequence_right - 1;

  // Convert the modified sequences to strings
  const leftPartialSerialNumber = modifiedLeftSequence.toString();
  const rightPartialSerialNumber = modifiedRightSequence.toString();

  // Calculate the check digits for the left and right sequences
  const leftCheckDigit = calculateLuhnCheckDigit(leftPartialSerialNumber);
  const rightCheckDigit = calculateLuhnCheckDigit(rightPartialSerialNumber);

  await updateLuhnSequencesInDatabase(
    modifiedLeftSequence,
    modifiedRightSequence
  );

  // Construct the full serial number by combining the left and right sequences
  const fullSerialNumber =
    leftPartialSerialNumber +
    leftCheckDigit +
    rightPartialSerialNumber +
    rightCheckDigit;

  // Return the full serial number
  return fullSerialNumber;
}

async function updateLuhnSequencesInDatabase(
  modifiedLeftSequence,
  modifiedRightSequence
) {
  await pool.query(
    `UPDATE ine_settings SET replicator_luhn_sequence_left = ?, replicator_luhn_sequence_right = ? WHERE id = 1`,
    [modifiedLeftSequence, modifiedRightSequence]
  );
}

router.put("/rejected/:id", async (req, res) => {
  try {
    await authenticateToken(req);
    const id = req.params.id || req.query.id;
    const { moduleId, record_status, rowID, rejection_reason, roleid } =
      await req.body;
    if (!id) {
      return sendResponse(
        res,
        { error: ManageResponseStatus("RowIdRequired"), status: false },
        400
      );
    }
    let tableName;
    let tableName2 = ine_manage_request_tablename;
    switch (moduleId) {
      case ine_designer_ModuleID:
        tableName = designer_tableName;
        break;
      case ine_giftcard_ModuleID:
        tableName = TABLE.GIFTCARD_TABLE;
        break;
      case ine_replicator_moduleID:
        tableName = TABLE.REPLICATOR;
        // tableName3 = ine_serial_number;
        break;
      case ine_marekting_ModuleID:
        tableName = TABLE.MARKETING;
        // tableName3 = ine_serial_number;
        break;
      case ine_campaign_ModuleID:
        tableName = TABLE.CAMPAIGN;
        break;
      case ine_supportchannel_ModuleID:
        tableName = TABLE.ORDER_RETURN;
        break;
      case ine_affiliate_ModuleID:
        tableName = TABLE.AFFILIATE_TABLE;
        break;
      default:
        tableName = "";
        tableName2 = "";
    }
    const [existingRecord] = await getRecordById(rowID, tableName, "id");

    if (!existingRecord) {
      return sendResponse(
        res,
        { error: ManageResponseStatus("notFound"), status: false },
        404
      );
    }
    // Validate request data
    if (!record_status) {
      return sendResponse(
        res,
        { error: "Record Status field is required", status: false },
        400
      );
    }
    if (moduleId == ine_designer_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?,rejection_reason =?,updated_at = NOW() WHERE id = ?`,
        [record_status, rejection_reason, rowID]
      );
    }
    if (moduleId == ine_giftcard_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?,rejection_reason =?,updated_at = NOW() WHERE id = ?`,
        [record_status, rejection_reason, rowID]
      );
    }
    if (moduleId == ine_replicator_moduleID) {
      await pool.query(
        `UPDATE ${tableName} SET  record_status = ?,rejection_reason =?, updated_at = NOW() WHERE id = ?`,
        [record_status, rejection_reason, rowID]
      );
    }
    if (moduleId == ine_marekting_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?,rejection_reason =?, updated_at = NOW() WHERE id = ?`,
        [record_status, rejection_reason, rowID]
      );
    }
    if (moduleId == ine_campaign_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?,rejection_reason =?,updated_at = NOW() WHERE id = ?`,
        [record_status, rejection_reason, rowID]
      );
    }

    // AFFILIATE MODULE
    if (moduleId === ine_affiliate_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?,rejection_reason =?,updated_at = NOW() WHERE id = ?`,
        [record_status, rejection_reason, rowID]
      );
    }

    if (moduleId == ine_supportchannel_ModuleID) {
      await pool.query(
        `UPDATE ${tableName} SET record_status = ?, updated_at = NOW(), updated_by = ? WHERE id = ? `,
        [record_status, roleid, rowID]
      );
    }
    await pool.query(
      `UPDATE ${tableName2} SET request_status = ?,updated_at = NOW(), updated_by = ? WHERE row_id = ?`,
      [record_status, roleid, rowID]
    );
    const [updatedRecord] = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = ? `,
      [rowID]
    );
    await activityLog(moduleId, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log
    return sendResponse(
      res,
      { status: " true", message: "Status updated Successfully" },
      200
    );
  } catch (error) {
    return sendResponse(
      res,
      { error: `Error occurred: ${error.message}` },
      500
    );
  }
});

module.exports = router;
