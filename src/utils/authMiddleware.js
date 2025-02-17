const jwt = require('jsonwebtoken');

function authenticateToken(req) {
    return new Promise((resolve, reject) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reject({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        try {
            // const decoded = jwt.verify(token, process.env.API_SECRET_KEY);
            const decoded = jwt.verify(token, "secretkey3428943hrw");
            req.userId = decoded.data.id; // Extract user ID from token payload
            resolve(req);
        } catch (error) {
            reject({ error: 'Invalid Token' });
        }
    });
}

module.exports = { authenticateToken };
