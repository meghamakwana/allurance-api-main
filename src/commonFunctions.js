const pool = require('./utils/db');
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const UPLOAD_FILE_TO_AZURE = `${apiUrl}/uploadtoazure`;
const MODULES_MODULE_CHECK_ENDPOINT = `${apiUrl}/modules/particularmodulecheck`;
const { BlobServiceClient, generateBlobSASQueryParameters, ContainerSASPermissions } = require('@azure/storage-blob');
const path = require('path');
const TABLE = require('./utils/tables')
const bwipjs = require('bwip-js');
const TABLES = require('./utils/tables');



const ensureContainerExists = async () => {
    try {
        const containerName = process.env.AZURE_STORAGE_CONTAINERNAME;
        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING_NRG);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();
        // console.log(`Container "${containerName}" is ready.`);
    } catch (error) {
        console.error(`Error creating container "${containerName}":`, error.message);
    }
};

// Fetch Single ID
const getQueryParamId = (url) => new URL(url).searchParams.get('id');

// Fetch Multiple IDs
const getQueryParamIds = (url) => {
    const idsString = url.searchParams.get('ids');
    return idsString ? idsString.split(',').map(id => parseInt(id, 10)) : [];
};
// Fetch Multiple IDs
// const getQueryParamCategoryIds = (url) => {
//     const idsString = url.searchParams.get('categories');
//     return idsString ? idsString.split(',').map(id => parseInt(id, 10)) : [];
// };

const getQueryParamCategoryIds = (reqUrl) => {
    const parsedUrl = url.parse(reqUrl, true);
    const idsString = parsedUrl.query.categories;
    return idsString ? idsString.split(',').map(id => parseInt(id, 10)) : [];
};

const getRecordById = async (id, tableName, orderBy) => {
    try {
        const condition = id != null ? 'AND id = ?' : '';
        const [data] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 ${condition} ORDER BY ${orderBy} DESC`, id ? [id] : []);
        return data;
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};

const getRecordDetailById = async (id, tableName, field) => {
    try {
        const condition = `AND ${field} = ?`;
        const [data] = await pool.query(`SELECT * FROM ${tableName} WHERE 1=1  ${condition}`, id ? [id] : []);
        return data;
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};

const getRecorrdById = async (id, tableName, orderBy) => {
    try {
        const condition = id != null ? 'AND id = ?' : '';
        const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 ${condition} ORDER BY ${orderBy} DESC`, id ? [id] : []);
        return rows;
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};

const getRecordByIdWithoutStatus = async (id, tableName, orderBy) => {
    try {
        const condition = id != null ? 'AND id = ?' : '';
        return await pool.query(`SELECT * FROM ${tableName} WHERE ${condition}`, id ? [id] : []);
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};
const getRecordsByReplicatorId = async (id, tableName, orderBy) => {
    try {
        const condition = id != null ? ' replicator_id = ?' : '';
        return await pool.query(`SELECT * FROM ${tableName} WHERE ${condition} ORDER BY ${orderBy} DESC`, id ? [id] : []);
    } catch (error) {
        throw new Error(`Error fetching records by replicator ID: ${error.message}`);
    }
};

const getRecordByuserId = async (id, tableName, orderBy) => {
    try {
        const condition = id != null ? 'AND created_by = ?' : '';
        let sql = `SELECT * FROM ${tableName} WHERE status = 1 ${condition} ORDER BY ${orderBy} DESC`;
        // console.log('sqlsql',sql);
        return await pool.query(sql, id ? [id] : []);
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};

const getRecordBydesignerId = async (id, tableName, orderBy) => {
    try {
        const condition = id != null ? 'AND model_number = ?' : '';
        return await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 AND record_status = 2 ${condition} ORDER BY ${orderBy} DESC`, id ? [id] : []);
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};
const getRecordByDesignerIdForReplicator = async (designer_id, tableName, orderBy) => {

    try {
        // Use a placeholder for the condition
        const condition = designer_id ? 'WHERE designer_id = ?' : '';
        // Adjust the query to use the correct column name for the condition
        return await pool.query(`SELECT * FROM ${tableName} ${condition} ORDER BY ${orderBy} DESC`, designer_id ? [designer_id] : []);
    } catch (error) {
        throw new Error(`Error fetching record by designer ID: ${error.message}`);
    }
};

// Function to retrieve  records by giftcard_ID
const getRecordsByGiftcardId = async (id, tableName) => {
    try {
        const condition = id ? 'WHERE giftcard_id = ?' : '';
        return await pool.query(`SELECT * FROM ${tableName}  ${condition} `, id ? [id] : []);
    } catch (error) {
        throw new Error(`Error fetching record by ID: ${error.message}`);
    }
};

// // Handle Response
// const sendResponse = (res, data, status, count = undefined, headers = { 'Content-Type': 'application/json' }) => {
//     if (data.error) {
//         return res.status(status).json({ error: data.error, status: false });
//     }

//     const responseData = {
//         ...data,
//         ...(count && { count }),
//     };
//     return res.status(status).json(responseData);
// };
const sendResponse = (res, data, status, count = undefined) => {
    // If there's an error, return an error response
    if (data.error) {
        return res.status(status).json({ error: data.error, status: false });
    }

    // Create the response object with optional count
    const responseData = {
        ...data,
        ...(count !== undefined && { count }),
    };

    // Send the response
    return res.status(status).json(responseData);
};


// Manage API Response Status
function ManageResponseStatus(action) {
    const defaultTitles = {
        created: 'Record Successfully Created',
        updated: 'Record Successfully Updated',
        deleted: 'Record Successfully Deleted',
        fetched: 'Record Successfully Fetched',
        alreadyDeleted: 'Record Already Deleted',
        notFound: 'Sorry, Record Not Found',
        error: 'Something Went Wrong!',
        exist: 'Record Already Exist!',
        RowIdRequired: 'RowID must be required',
    };
    return defaultTitles[action];
}

// Manange API Operations
const ManageAPIsData = async (apiUrl, fetchMethod, data = {}, accessToken = '') => {
    const requestOptions = {
        method: fetchMethod,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}` // Add the Authorization header
        },
    };

    // Only include the body for non-GET and non-DELETE requests
    if (fetchMethod !== 'GET' && fetchMethod !== 'DELETE') {
        requestOptions.body = JSON.stringify(data);
    }

    const response = await fetch(apiUrl, requestOptions);
    return response;
}
const ManageAPIsDataWithHeader = async (apiUrl, fetchMethod, data = {}) => {
    const requestOptions = {
        method: fetchMethod,
        headers: data.headers
    };

    // Only include the body for non-GET and non-DELETE requests
    if (fetchMethod !== 'GET' && fetchMethod !== 'DELETE') {
        requestOptions.body = JSON.stringify(data);
    }

    const response = await fetch(apiUrl, requestOptions);
    return response;
}



const initRequestforAdmin = async (object) => {
    try {
        // console.log('objectobject', object)
        await pool.query(`INSERT INTO ${TABLE.MANAGE_REQUEST} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
            object.module_id, object.insertedRecordId, 1, null, 1
        ]);
    } catch (error) {
        throw new Error(`Error logging activity: ${error.message}`);
    }
}


// Manage activity Log
const activityLog = async (moduleID, prevData, newData, Operation, OperationBy) => {
    try {
        const pDataJson = prevData ? JSON.stringify(prevData) : null;
        const nDataJson = newData ? JSON.stringify(newData) : null;
        await pool.query(`
            INSERT INTO ${TABLE.OTHER_ACTIVITY}
            (module_id, prev_data, new_data, operation, operation_by)
            VALUES (?,?,?,?,?)`,
            [moduleID, pDataJson, nDataJson, Operation, OperationBy]
        );
    } catch (error) {
        throw new Error(`Error logging activity: ${error.message}`);
    }
}

// Get Country by State ID
const getCountryByStateId = async (id) => {
    try {
        let sql = `SELECT * FROM ${TABLES.STATE_TABLE} WHERE id = ?`;
        const [rows] = await pool.query(sql, [id]);
        const row = rows.length > 0 ? rows[0] : null;
        if (!row) {
            throw new Error(`No entry found for id: ${id}`);
        }
        // console.log('row:', row);
        return row;
    } catch (error) {
        console.error('Error occurred while checking email:', error);
        throw new Error('Failed to check email existence');
    }
}

// Check email exists or not
const checkEmailExistOrNot = async (tableName, email, ID = null) => {
    try {
        let sql = 'SELECT * FROM ' + tableName + ' WHERE email = ?';
        const values = [email];

        if (ID !== null) {
            sql += ' AND id != ?';
            values.push(ID);
        }

        const [rows] = await pool.query(sql, values);
        return rows.length > 0;
    } catch (error) {
        console.error('Error occurred while checking email:', error);
        throw new Error('Failed to check email existence');
    }
}

// Check phone exists or not
const checkPhoneExistOrNot = async (tableName, phone, ID = null) => {
    try {
        let sql = 'SELECT * FROM ' + tableName + ' WHERE phone = ?';
        const values = [phone];

        if (ID !== null) {
            sql += ' AND id != ?';
            values.push(ID);
        }

        const [rows] = await pool.query(sql, values);
        return rows.length > 0;
        // return !!rows.length; // Returns true if phone exists, false otherwise
    } catch (error) {
        console.error('Error occurred while checking phone:', error);
        throw new Error('Failed to check phone existence');
    }
}

// Password validation - Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter and one special character.
function validatePassword(password) {
    // Minimum length check
    if (password.length < 9) {
        return false;
    }

    // Uppercase, lowercase, and special characters check
    const uppercaseRegex = /[A-Z]/;
    const lowercaseRegex = /[a-z]/;
    const specialCharactersRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;

    const hasUppercase = uppercaseRegex.test(password);
    const hasLowercase = lowercaseRegex.test(password);
    const hasSpecialCharacters = specialCharactersRegex.test(password);

    // Check if all conditions are met
    return hasUppercase && hasLowercase && hasSpecialCharacters;
}

const checkFileType = (file) => {
    const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const videoMimeTypes = ['video/mp4', 'video/webm', 'video/ogg'];

    if (imageMimeTypes.includes(file.mimetype)) {
        return 'image';
    } else if (videoMimeTypes.includes(file.mimetype)) {
        return 'video';
    } else {
        return 'unknown';
    }
};


const generateSASUrl = async (blobName) => {
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING_NRG);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINERNAME);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const expiresOn = new Date(new Date().valueOf() + 5 * 365 * 24 * 60 * 60 * 1000);
    const sasOptions = {
        containerName: process.env.AZURE_STORAGE_CONTAINERNAME,
        blobName,
        permissions: ContainerSASPermissions.parse("r"),
        expiresOn
    };
    const sasToken = generateBlobSASQueryParameters(sasOptions, blobServiceClient.credential).toString();
    return `${blockBlobClient.url}?${sasToken}`;
};

// const uploadToAzureBlob = async (file) => {
//     const containerName = process.env.AZURE_STORAGE_CONTAINERNAME;
//     const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING_NRG);
//     const containerClient = blobServiceClient.getContainerClient(containerName);
//     const blobName = `${Date.now()}-${file.originalname}`;
//     const blockBlobClient = containerClient.getBlockBlobClient(blobName);
//     const contentType = file.mimetype || 'application/octet-stream';
//     console.log('calling funciton uploadToAzureBlob ');
//     try {
//         await blockBlobClient.upload(file.buffer, file.buffer.length, {
//             blobHTTPHeaders: { blobContentType: contentType } // Set content type
//         });
//         //await blockBlobClient.upload(file.buffer, file.buffer.length);
//         //console.log(`Uploaded ${file.originalname} to Azure Blob Storage`);
//         const sasUrl = await generateSASUrl(blobName);
//         console.log('sasUrlsasUrlsasUrl', sasUrl);
//         return sasUrl;
//     } catch (error) {
//         console.error(`Error uploading ${file.originalname} to Azure Blob Storage:`, error.message);
//         throw error;
//     }
// };

const uploadToAzureBlob = async (file) => {

    const containerName = process.env.AZURE_STORAGE_CONTAINERNAME;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_NRG;

    if (!containerName || !connectionString) {
        throw new Error('Missing Azure Storage environment variables');
    }

    // console.log('Initializing BlobServiceClient...');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    if (!containerClient) {
        throw new Error(`Failed to get container client for container: ${containerName}`);
    }

    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const contentType = file.mimetype || 'application/octet-stream';

    // console.log(`Uploading file: ${file.originalname}`);
    // console.log('File buffer length:', file.buffer.length);
    // console.log('File size:', file.size);
    try {
        // console.log('Starting upload...');
        const uploadResponse = await blockBlobClient.upload(file.buffer, file.buffer.length, {
            blobHTTPHeaders: { blobContentType: contentType }
        });
        // console.log('Upload response:', uploadResponse);

        // Ensure generateSASUrl is implemented and working correctly
        // console.log('Generating SAS URL...');
        const sasUrl = await generateSASUrl(blobName);
        // console.log('SAS URL:', sasUrl);

        return sasUrl;
    } catch (error) {
        console.error(`Error uploading ${file.originalname} to Azure Blob Storage:`, error);
        throw error;
    }
};

const uploadFileToAzureAPI = async (base64Data) => {
    try {
        const payload = typeof base64Data === 'object' && base64Data.imageData
            ? { base64Data }
            : { base64Data: { imageData: base64Data } };
        const response = await fetch(UPLOAD_FILE_TO_AZURE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.blobUrl;
    } catch (error) {
        console.error(`Error uploading file to Azure via API: ${error.message}`);
        throw error;
    }
};


// Store Image
const writeImageToFile = async (imageData) => {
    try {
        const [blobUrl] = await uploadToAzureBlob(imageData);
        return blobUrl;

        // const [blobUrl] = await uploadFileToAzureAPI(imageData);
        // return blobUrl;
    } catch (error) {
        console.error(`Error uploading image to Azure Blob Storage: ${error.message}`);
        throw error;
    }
};

// Store Video
const writeVideoToFile = async (videoData) => {
    try {
        const [blobUrl] = await uploadFileToAzureAPI(videoData);
        return blobUrl;
    } catch (error) {
        console.error(`Error uploading video to Azure Blob Storage: ${error.message}`);
        throw error;
    }
};

const writeVideoToFiles = async (filename, videoData) => {
    try {
        // const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '');
        const buffer = Buffer.from(videoData, 'base64');
        const [blobUrl] = await uploadFileToAzureAPI(buffer);
        return blobUrl;
    } catch (error) {
        console.error(`Error uploading video to Azure Blob Storage: ${filename}: ${error.message}`);
        throw error;
    }
};

const writeImageToFiles = async (filename, imageData, folderPath) => {
    const fullPath = path.join(folderPath, filename);
    try {
        const [blobUrl] = await uploadFileToAzureAPI(imageData);
        return blobUrl;
    } catch (error) {
        console.error(`Error writing image to file ${imageData}: ${error.message}`);
        throw error;
    }
};

// Process Document
async function processDocument(documentType, requestData) {
    if (requestData && requestData[documentType] && requestData[documentType].imageData) {
        const blobUrl = await writeImageToFile(requestData[documentType].imageData);
        requestData[documentType] = blobUrl;
    }
}

// Process Documents
async function processDocuments(image) {
    try {
        if (image && image.preview && image.imageData) {
            const blobUrl = await writeImageToFile(image.imageData);
            return blobUrl;
        }
    } catch (error) {
        console.error(`Error processing image: ${error.message}`);
        throw error;
    }
}

// Process Image Upload
async function processImageUpload(uploadData) {
    if (uploadData && uploadData.imageData) {
        // const fileName = `${documentType}_${Date.now().toString()}.png`;
        const blobUrl = await writeImageToFile(uploadData.imageData);
        return blobUrl;
    } else {
        return uploadData;
    }
}


// Frontend: Generic function to fetch data from API
const fetchDataFromApi = async (apiUrl, method, data) => {
    try {
        const response = await ManageAPIsData(apiUrl, method, data);

        if (!response.ok) {
            console.error("Error fetching data:", response.statusText);
            return null;
        }

        const responseData = await response.json();
        return responseData.data || [];
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
};

// Frontend: Image convert in base64
const createImageOption = async (data, fieldName) => {
    try {
        if (data && data[fieldName]) {
            const readableStream = data[fieldName].stream();
            const reader = readableStream.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                chunks.push(value);
            }
            const imageData = new Blob(chunks);
            const base64ImageData = await blobToBase64(imageData);
            return base64ImageData;
        } else {
            return '';
        }
    } catch (error) {
        console.error("Error in createImageOption:", error);
        return ''; // or handle the error in an appropriate way
    }
};

// Frontend: Image convert in base64
const createImageOptions = async (image) => {
    try {
        const response = await fetch(image.preview); // Fetch image data
        const blob = await response.blob(); // Convert response to Blob
        const base64ImageData = await blobToBase64(blob); // Convert Blob to base64
        // Include both the image data and the path/preview in the returned object
        return {
            imageData: base64ImageData,
            path: image.path,
            preview: image.preview
        };
    } catch (error) {
        console.error("Error in createImageOptions:", error);
        return {}; // or handle the error in an appropriate way
    }
};

const createFileOptions = async (file) => {

    try {
        const response = await fetch(file.preview); // Fetch file data
        const blob = await response.blob(); // Convert response to Blob
        const base64FileData = await blobToBase64(blob); // Convert Blob to base64
        return {
            imageData: base64FileData,
            path: file.path,
            preview: file.preview
        };
    } catch (error) {
        console.error("Error in createFileOptions:", error);
        return {}; // or handle the error in an appropriate way
    }
};

const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
            // Ensure the reader result is a data URL
            if (typeof reader.result === 'string' && reader.result.startsWith('data')) {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to convert blob to base64: invalid result.'));
            }
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// // Frontend: Utility function to convert Blob to base64
// const blobToBase64 = (blob) => {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onloadend = () => resolve(reader.result);
//         reader.onerror = reject;
//         reader.readAsDataURL(blob);
//     });
// };

// Frontend: Utility function to convert Blob to base64



const getStatusLabelColor = (recordStatus) => {
    switch (recordStatus) {
        case 1:
            return 'secondary';
        case 2:
            return 'success';
        case 3:
            return 'error';
        default:
            return 'default';
    }
};

const getStatusLabelText = (recordStatus) => {
    switch (recordStatus) {
        case 1:
            return 'Pending';
        case 2:
            return 'Approved';
        case 3:
            return 'Rejected';
        default:
            return 'Unknown';
    }
};

// Set local storage
const setItemLocalStorage = (key, value) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// Get local storage
const getItemLocalStorage = (key) => {
    if (typeof window !== 'undefined') {
        const storedItem = localStorage.getItem(key);
        return storedItem ? JSON.parse(storedItem) : null;
    }
    return null;
};

const getModulePermissions = async (moduleId) => {
    const apiUrl = MODULES_MODULE_CHECK_ENDPOINT;
    try {
        let RoleID;
        const STORAGE_KEY = 'accessToken';
        let accessToken;

        // Check if sessionStorage is available before trying to access it
        if (typeof sessionStorage !== 'undefined') {
            accessToken = sessionStorage.getItem(STORAGE_KEY);
            // Check if accessToken is not undefined before decoding
        } else {
            console.error("sessionStorage is not available in this environment.");
        }
        let decoded;
        if (accessToken != null && accessToken !== undefined) {
            // decoded = jwtDecode(accessToken);
            RoleID = decoded.data.role_id;
        } else {
            // console.error("accessToken is undefined. Cannot decode.");
        }
        const body = { role_id: RoleID }; // Construct the body object
        const [responseData] = await fetchDataFromApi(`${apiUrl}?id=${moduleId}`, 'POST', body);
        if (responseData && responseData.length > 0) {
            const firstElement = responseData[0];
            const { read_access, add_access, update_access, delete_access } = firstElement;
            return { read_access, add_access, update_access, delete_access }; // Return access permissions from the first element
        } else {
            return { read_access: 0, add_access: 0, update_access: 0, delete_access: 0 };
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};

// Slug - Function to generate a unique slug
async function generateUniqueSlug(modelName, name, ID) {
    let slug = formatName(name);
    let count = 1;

    while (await checkSlugExistence(modelName, slug, ID)) {
        slug = `${formatName(name)}-${count}`;
        count++;
    }
    return slug;
}

// Slug = Remove space, special characters (Regex)
function formatName(name) {
    return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
}

// Slug - Function to check if the slug exists in the database
async function checkSlugExistence(modelName, slug, ID = null) {
    try {
        let condition = 'WHERE slug = ?';
        const params = [slug];

        if (ID !== null) {
            condition += ' AND id <> ?';
            params.push(ID);
        }

        const sql = `SELECT id FROM ${modelName} ${condition}`;
        const [rows] = await pool.query(sql, params);
        return rows.length > 0; // Returns true if slug exists, false otherwise
    } catch (error) {
        throw new Error(`Error checking slug existence: ${error.message}`);
    }
}

// Generate Order ID
function generateSeriesId(series) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${series}-${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Generate OTP
function generateOTP(digits) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}



function generateOrderId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `ORD-${year}${month}${day}${hours}${minutes}${seconds}`;
}


const generateBarcodeUrl = (data) => {
    try {
        let svg = bwipjs.toSVG({
            bcid: 'code128',       // Barcode type
            text: data,            // Text to encode
            height: 12,            // Bar height, in millimeters
            includetext: true,     // Show human-readable text
            textxalign: 'center',  // Text alignment
            textsize: 12,          // Text size, in points
            textcolor: 'ff0000',   // Text color
        });
        return svg;
    } catch (e) {
        console.error("Error generating barcode:", e);
        return null;
    }
};

const convertSvgToPng = async (svg) => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const image = new Image();

        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            context.drawImage(image, 0, 0);

            canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        };

        image.onerror = (error) => {
            reject(error);
        };

        image.src = 'data:image/svg+xml;base64,' + btoa(svg);
    });
};

const getUserByPhoneNumber = async (phoneNumber, tableName) => {
    try {
        // Query to fetch user details by phone number
        return await pool.query(`SELECT prefix_id ,id,customer_id ,first_name ,last_name ,email ,phone FROM ${tableName} WHERE phone = ?`, [phoneNumber]);
    } catch (error) {
        throw new Error(`Error fetching user by phone number: ${error.message}`);
    }
};

const insertUser = async (user, tableName) => {
    const { first_name, last_name, email, phone_number } = user;
    const insertQuery = `
        INSERT INTO ${tableName} (first_name, last_name, email, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [first_name, last_name, email, phone_number];

    try {
        const res = await pool.query(insertQuery, values);
        return res.rows[0];
    } catch (err) {
        console.error('Error inserting user:', err);
        throw err;
    }
};


const insertOrUpdateRecordintoFrontend = async (targetTableName, fetchedData) => {
    const {
        id,
        designer_id,
        title,
        retail_price,
        description,
    } = fetchedData;

    // Check if the record exists in the target table
    const [existingRecord] = await pool.query(`SELECT * FROM ${targetTableName} WHERE marketing_id = ?`, [id]);

    if (existingRecord.length === 0) {
        // Record does not exist, perform INSERT
        const [insertResult] = await pool.query(
            `INSERT INTO ${targetTableName} (marketing_id, designer_id, name, price, short_description, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [id, designer_id, title, retail_price, description]
        );
        return { data: insertResult, message: "Inserted into frontend", status: 201 };
    } else {
        // Record exists, perform UPDATE
        const [updateResult] = await pool.query(
            `UPDATE ${targetTableName} SET 
             designer_id = ?, 
             name = ?, 
             price = ?, 
             short_description = ?, 
             updated_at = NOW() 
             WHERE marketing_id = ?`,
            [designer_id, title, retail_price, description, id]
        );
        return { data: updateResult, message: "Updated in frontend", status: 200 };
    }
};


const FetchUserDetail = async () => {
    const STORAGE_KEY = 'accessToken';
    const accessToken = sessionStorage.getItem(STORAGE_KEY);
    if (!accessToken) {
        return;
    }
    try {
        //const decoded = jwtDecode(accessToken);
        const userdata = decoded?.data;
        if (userdata) {
            return userdata
        } else {
            console.error("User ID not logged in.");
        }
    } catch (error) {
        console.error("Error decoding token:", error);
    }
};

// Validate the Date Format
const isValidDate = (dateString) => {
    // Check if the date format is correct (YYYY-MM-DD)
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
        return false;
    }

    // Parse the date parts to integers
    const parts = dateString.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // months are 0-11 in JavaScript
    const day = parseInt(parts[2], 10);

    // Check if the date is valid
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return false;
    }

    // Check if the date is in the past
    const today = new Date();
    if (date > today) {
        return false;
    }

    // Check if the date is within a reasonable range (e.g., not more than 120 years ago)
    const minYear = today.getFullYear() - 120;
    if (year < minYear) {
        return false;
    }

    return true;
};

// Validate the date while fetching 
const fetchFormatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const timezoneOffset = date.getTimezoneOffset() * 60000; // Get the timezone offset in milliseconds
    const localDate = new Date(date.getTime() - timezoneOffset); // Adjust the date
    return localDate.toISOString().split('T')[0]; // Get the date part in YYYY-MM-DD format
};

const deleteRecords = async (ids, tableName) => {
    await pool.query(`DELETE FROM ${tableName} WHERE id IN (?)`, [ids]);
};

const generateUniqueUserId = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    let randomNumber;
    let userId;
    let userIdExists;

    do {
        // Generate a random number between 1000 and 9999
        randomNumber = Math.floor(Math.random() * 9000) + 1000;
        userId = `${datePart}${randomNumber}`;

        // Check if the generated user ID already exists in the database
        userIdExists = await checkUserIdExists(userId);
        // If the user ID exists, regenerate the random number
    } while (userIdExists);

    return userId;
};

// Function to check if a user ID already exists in the database
const checkUserIdExists = async (userId) => {
    const result = await pool.query('SELECT COUNT(*) AS count FROM ine_users WHERE customer_id = ?', [userId]);
    const count = result[0].count;
    return count > 0;
};

// Helper function to format numbers to 2 decimal places
const formatToTwoDecimals = (value) => {
    return parseFloat(value).toFixed(2);
};

// Request ID Number
const requestIDNumber = () => {
    const characters = '0123456789'; //'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 16;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// Generate Coupon Code
const generateRandomCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 15;
    let code = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters.charAt(randomIndex);
    }
    return code;
};

const mergeMarketingPendingtoMain = async (object) => {

    const { row_id } = object;

    const [requestData1] = await pool.query('SELECT * FROM ine_marketing_pending WHERE id = ?', [row_id]);
    const designerID = requestData1[0].designer_id;

    const [requestData2] = await pool.query('SELECT * FROM ine_marketing_pending WHERE designer_id = ? ORDER BY ID DESC LIMIT 1', [designerID]);
    const [newRequest] = requestData2;
    const [requestData3] = await pool.query('SELECT * FROM ine_marketing WHERE designer_id = ?', [designerID]);
    if (requestData3.length > 0) {
        // Update
        await pool.query(`UPDATE ${TABLE.MARKETING} SET short_description = ?, name = ?, discount_price = ?, price = ?, bulk_price = ?, weight = ?, long_description = ?, collection = ?, status = ?, updated_by = ?, updated_at = NOW() WHERE designer_id = ?`, [
            newRequest.similar_options || '',
            newRequest.title || '',
            newRequest.base_price || 0,
            newRequest.retail_price || 0,
            newRequest.bulk_price || 0,
            newRequest.weight || 0,
            newRequest.description || '',
            newRequest.collection || '',
            2,
            newRequest.user_id || '',
            newRequest.designer_id
        ]);
        await pool.query(`UPDATE ${TABLE.MARKETING_MEDIA_TABLE} SET status = ? WHERE designer_id = ?`, [2, designerID]);
    } else {
        // Insert
        const query = `INSERT INTO ${TABLE.MARKETING} (designer_id, name, discount_price, price, bulk_price, weight, long_description, short_description, record_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            newRequest.designer_id || '',
            newRequest.title || '',
            newRequest.base_price || 0,
            newRequest.retail_price || 0,
            newRequest.bulk_price || 0,
            newRequest.weight || 0,
            newRequest.description || '',
            newRequest.similar_options || '',
            2,
            newRequest.user_id || 0
        ];
        await pool.query(query, values);
    }

    await pool.query(`UPDATE ${TABLE.MARKETING_PENDING} SET status = ? WHERE designer_id = ?`, [1, designerID]);

    const [requestData4] = await pool.query('SELECT * FROM ine_marketing_pending_media WHERE designer_id = ? AND status = ?', [designerID, 1]);
    if (requestData4.length > 0) {
        requestData4.map(async (items) => {
            await pool.query(`INSERT INTO ${TABLE.MARKETING_MEDIA_TABLE} (designer_id, ine_marketing_id,media_type,file_url,status,user_id) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    designerID,
                    row_id,
                    items.media_type || '',
                    items.file_url || 0,
                    items.status || 0,
                    items.user_id || 0,
                ]
            );
        })
    }

    /*
    const [requestData] = await pool.query('SELECT *  FROM ine_marketing_pending WHERE designer_id = ? ORDER BY ID DESC LIMIT 1', [designerID]);
    const [results] = await pool.query('SELECT *  FROM ine_marketing_pending_media WHERE ine_marketing_pending_id = ? AND status = ?', [row_id, 1]);

    // console.log('before requiear data', requestData);

    if (requestData.length > 0) {
        const [newRequest] = requestData;
        // console.log('newRequestnewRequest', newRequest);
        const query = `INSERT INTO ${TABLE.MARKETING} 
            (designer_id, title, base_price, retail_price, bulk_price, weight, description, similar_options, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            newRequest.designer_id || '',
            newRequest.title || '',
            newRequest.base_price || 0,
            newRequest.retail_price || 0,
            newRequest.bulk_price || 0,
            newRequest.weight || 0,
            newRequest.description || '',
            newRequest.similar_options || '',
            newRequest.user_id || 0
        ];



        const [insertResult] = await pool.query(query, values);

        // console.log('row_idrow_id',row_id);
        



        // update pending table status 
        await pool.query(
            `UPDATE ${TABLE.MARKETING_PENDING} SET 
             status = ? 
             WHERE id = ?`,
            [1, row_id]
        );

        if (results.length > 0) {
            results.map(async (items) => {
                await pool.query(
                    `INSERT INTO ${TABLE.MARKETING_MEDIA_TABLE} 
                    (ine_marketing_id,media_type,file_url,status,user_id) 
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        insertResult.insertId || '',
                        items.media_type || '',
                        items.file_url || 0,
                        items.status || 0,
                        items.user_id || 0,
                    ]
                );
            })
        }
    }
    */
}

module.exports = {
    ensureContainerExists,
    uploadToAzureBlob,
    generateSASUrl,
    getQueryParamId,
    getQueryParamIds,
    getQueryParamCategoryIds,
    getRecordById,
    getRecordDetailById,
    getRecordByIdWithoutStatus,
    getRecordsByReplicatorId,
    getRecordByuserId,
    getRecordBydesignerId,
    getRecordByDesignerIdForReplicator,
    getRecordsByGiftcardId,
    sendResponse,
    ManageResponseStatus,
    ManageAPIsData,
    ManageAPIsDataWithHeader,
    activityLog,
    checkEmailExistOrNot,
    checkPhoneExistOrNot,
    validatePassword,
    uploadFileToAzureAPI,
    writeImageToFile,
    processDocument,
    processDocuments,
    writeImageToFiles,
    writeVideoToFiles,
    writeVideoToFile,
    processImageUpload,
    generateUniqueSlug,
    fetchDataFromApi,
    createImageOption,
    createImageOptions,
    createFileOptions,
    getStatusLabelColor,
    getStatusLabelText,
    setItemLocalStorage,
    getItemLocalStorage,
    getModulePermissions,
    formatName,
    generateSeriesId,
    generateOTP,
    generateOrderId,
    generateBarcodeUrl,
    convertSvgToPng,
    getUserByPhoneNumber,
    insertUser,
    insertOrUpdateRecordintoFrontend,
    FetchUserDetail,
    isValidDate,
    fetchFormatDate,
    deleteRecords,
    generateUniqueUserId,
    checkUserIdExists,
    formatToTwoDecimals,
    checkFileType,
    initRequestforAdmin,
    mergeMarketingPendingtoMain,
    getCountryByStateId,
    requestIDNumber,
    generateRandomCode
}