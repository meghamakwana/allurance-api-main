const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions');

// Designer Details
async function getDesignerDetail(id, req, res) {
    const baseQuery = `SELECT idr.*, ic.name as category_name, ir.name as resin_name, ish.sequence_number as shape_sequence_number, ish.shape as shape_shape, isfs.length as isfs_length, isfs.breadth as isfs_breadth, ibm.name as bezel_material_name, ibc.name as bezel_color_name, inm.name as Inner_material_name, ifl.name as flower_name, icst.name as color_name 
        FROM \`${TABLE.DESIGNER}\` as idr 
        LEFT JOIN \`${TABLE.CATEGORY_TABLE}\` as ic on ic.id = idr.category_id
        LEFT JOIN \`${TABLE.RESIN_TABLE}\` as ir on ir.id = idr.resin_id
        LEFT JOIN \`${TABLE.SHAPE_TABLE}\` as ish on ish.id = idr.shape_id
        LEFT JOIN \`${TABLE.SIZE_FOR_SHAPE_TABLE}\` as isfs on isfs.id = idr.size_id
        LEFT JOIN \`${TABLE.BEZEL_MATERIAL}\` as ibm on ibm.id = idr.bezel_material_id
        LEFT JOIN \`${TABLE.BEZEL_COLOUR_TABLE}\` as ibc on ibc.id = idr.bezel_color_id
        LEFT JOIN \`${TABLE.INNER_MATERIAL_TABLE}\` as inm on inm.id = idr.Inner_material_id
        LEFT JOIN \`${TABLE.FLOWER_TABLE}\` as ifl on ifl.id = idr.flower_id    
        LEFT JOIN \`${TABLE.COLOUR_SHADE}\` as icst on icst.id = idr.color_id    
        WHERE idr.status = 1`;

    if (id) {
        const query1 = `${baseQuery} AND idr.id = ? ORDER BY idr.id DESC`;
        const [results] = await pool.query(query1, [id]);

        if (results.length > 0) {
            return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    }

    const query2 = `${baseQuery} ORDER BY idr.id DESC;`;
    const [results] = await pool.query(query2);

    if (results.length > 0) {
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    }

    return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
}

// Request Details
async function getRequestDetail(id, req, res) {
    const baseQuery = `
    SELECT 
        imr.*, 
        iu.role_id as user_role_id, 
        iu.prefix_id as user_prefix_id, 
        iu.first_name as user_first_name, 
        iu.last_name as user_last_name, 
        iu.email as user_email, 
        iu.phone as user_phone, 
        ist.title as request_status, 
        im.name as request_name, 
        iudt.gender as user_gender, 
        iudt.address as user_address, 
        iudt.pincode as user_pincode, 
        isdt1.name as user_statename, 
        isdt2.District as user_districtname,
        iu_updated.prefix_id as updated_user_prefix_id,
        iu_updated.first_name as updated_user_first_name,
        iu_updated.last_name as updated_user_last_name,
        iu_updated.email as updated_user_email,
        iu_updated.id as updated_user_id -- Change to select updated user ID
    FROM 
        \`${TABLE.MANAGE_REQUEST}\` as imr
    LEFT JOIN 
        \`${TABLE.USERS}\` as iu on iu.id = imr.created_by
    LEFT JOIN 
        \`${TABLE.INE_STATUS_TABLENAME}\` as ist on ist.id = imr.request_status
    LEFT JOIN 
        \`${TABLE.USER_DETAILS}\` as iudt on iudt.user_id = iu.id
    LEFT JOIN 
        \`${TABLE.STATE_TABLE}\` as isdt1 on isdt1.id = iudt.state_id
    LEFT JOIN 
        \`${TABLE.STATE_DISTRICT_TABLE}\` as isdt2 on isdt2.id = iudt.state_id
    LEFT JOIN 
        \`${TABLE.INE_MODULES_TABLE}\` as im on im.id = imr.module_id
    LEFT JOIN 
        \`${TABLE.USERS}\` as iu_updated on iu_updated.id = imr.updated_by
    WHERE 
        imr.status = 1`;

    if (id) {
        const query1 = `${baseQuery} AND imr.id = ? ORDER BY imr.id DESC`;
        const [results] = await pool.query(query1, [id]);

        if ([results].length > 0) {
            const requestsWithGiftCards = [results].filter(request => request.request_name === 'Gift Cards');
            for (const request of requestsWithGiftCards) {
                const giftCardInfoQuery = `SELECT type FROM ${TABLE.GIFTCARD_TABLE} WHERE id = ?`;
                const [giftCardInfo] = await pool.query(giftCardInfoQuery, [request.row_id]);
                if (giftCardInfo.length > 0) {
                    request.gift_card_type = giftCardInfo[0].type;
                }
            }
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    }

    const query2 = `${baseQuery} ORDER BY imr.id DESC;`;
    const [results] = await pool.query(query2);
    if (results.length > 0) {
        const requestsWithGiftCards = [results].filter(request => request.request_name === 'Gift Cards');
        for (const request of requestsWithGiftCards) {
            const giftCardInfoQuery = `SELECT type FROM ${TABLE.GIFTCARD_TABLE} WHERE id = ?`;
            const [giftCardInfo] = await pool.query(giftCardInfoQuery, [request.row_id]);
            if (giftCardInfo.length > 0) {
                request.gift_card_type = giftCardInfo[0].type;
            }
        }
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    }
    return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
}

module.exports = {
    getDesignerDetail,
    getRequestDetail,
};
