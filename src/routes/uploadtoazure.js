const express = require('express');
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const { BlobServiceClient } = require('@azure/storage-blob');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { base64Data } = await req.body;
        const datastring = base64Data.imageData || base64Data.fileData;
        if (typeof datastring !== 'string') {
            throw new Error('datastring is not a string');
        }

        // Check if the datastring is valid
        const matches = datastring.match(/^data:(image|video|text)\/(\w+);base64,/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 data format');
        }

        // Extract content type and file extension
        const contentType = matches[1] + '/' + matches[2];
        const fileType = matches[2];
        const fileName = `${Date.now()}.${fileType}`;

        // Define the container name and connection string
        const containerName = process.env.AZURE_CONTAINER_NAME;
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING

        // Initialize BlobServiceClient
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Convert base64 to buffer
        const buffer = Buffer.from(datastring.replace(/^data:(image|video|text)\/\w+;base64,/, ''), 'base64');

        // Get block blob client and upload data
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });

        // Get the URL of the uploaded blob
        const blobUrl = blockBlobClient.url;

        // Return the URL in the response
        return sendResponse(res, { blobUrl }, 200);
    } catch (error) {
        console.error('Error uploading data:', error);
        return sendResponse(res, { error: 'ERROR', status: false }, 500);
    }
});

router.delete('/', async (req, res) => {
    try {
        const { blobPaths } = req.body;

        if (!blobPaths || !Array.isArray(blobPaths) || blobPaths.length === 0) {
            return sendResponse(res, { error: 'blobPaths array is required and should not be empty', status: false }, 400);
        }

        // Define the container name and connection string
        const containerName = process.env.AZURE_CONTAINER_NAME;
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

        if (!containerName || !connectionString) {
            console.error('Missing Azure storage configuration.');
            return sendResponse(res, { error: 'Azure storage configuration is missing', status: false }, 500);
        }

        // Initialize BlobServiceClient
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // console.log("Container client initialized.");
        // Delete each blob
        const deleteResults = await Promise.all(blobPaths.map(async (blobPath) => {
            try {
                const blobClient = containerClient.getBlobClient(blobPath);
                // console.log(`Attempting to delete blob: ${blobPath}`);
                await blobClient.delete();
                // console.log(`Successfully deleted blob: ${blobPath}`);
                return { blobPath, deleted: true };
            } catch (error) {
                console.error(`Error deleting blob: ${blobPath}`, error);
                return { blobPath, deleted: false, error: error.message };
            }
        }));

        // Check for any failures
        const failedDeletions = deleteResults.filter(result => !result.deleted);
        if (failedDeletions.length > 0) {
            console.error('Failed deletions:', failedDeletions);
            return sendResponse(res, { error: 'Some blobs could not be deleted', status: false, details: failedDeletions }, 207); // Multi-Status
        }

        return sendResponse(res, { message: 'All blobs deleted successfully', status: true }, 200);
    } catch (error) {
        console.error('Error in DELETE method:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


module.exports = router;