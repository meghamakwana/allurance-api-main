// src/utils/apiEndPoint.js

// .env variables
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // 'http://localhost:3032/api';

// ABOUT MODULE
export const ine_about_tablename = 'ine_about_us'; // Table Name
export const ine_about_ModuleID = 0; // Module ID
export const ABOUT_ENDPOINT = `${apiUrl}/about`; // Endpoint to manage about data

// CATEGORY MODULE
export const ine_category_tablename = 'ine_category'; // Table Name
export const ine_category_ModuleID = 3; // Module ID114
export const CATEGORY_ENDPOINT = `${apiUrl}/categories`; // Endpoint to manage categories data

// RESIN TYPE MODULE
export const ine_resin_tablename = 'ine_resin'; // Table Name
export const ine_resin_ModuleID = 4; // Module ID
export const RESINTYPE_ENDPOINT = `${apiUrl}/resintype`; // Endpoint to manage resin type data

// SHAPE MODULE
export const ine_shape_tablename = 'ine_shape'; // Table Name
export const ine_shape_ModuleID = 5; // Module ID
export const SHAPE_ENDPOINT = `${apiUrl}/shape`; // Endpoint to manage shape data

// SIZE FOR SHAPE MODULE
export const ine_size_for_shape_tablename = 'ine_size_for_shape'; // Table Name
export const ine_size_for_shape_ModuleID = 6; // Module ID
export const SIZEFORSHAPE_ENDPOINT = `${apiUrl}/sizeforshape`; // Endpoint to manage shape data

// BEZEL MATERIAL MODULE
export const ine_bezel_material_tablename = 'ine_bezel_material'; // Table Name
export const ine_bezel_material_ModuleID = 7; // Module ID
export const BEZELMATERIAL_ENDPOINT = `${apiUrl}/bezelmaterial`; // Endpoint to manage bezel material

// BEZEL COLOR MODULE
export const ine_bezel_color_tablename = 'ine_bezel_color'; // Table Name
export const ine_bezel_color_ModuleID = 8; // Module ID
export const BEZELCOLOR_ENDPOINT = `${apiUrl}/bezelcolor`; // Endpoint to manage bezel color

// INNER MATERIAL MODULE
export const ine_inner_material_tablename = 'ine_inner_material'; // Table Name
export const ine_inner_material_ModuleID = 9; // Module ID
export const INNERMATERIAL_ENDPOINT = `${apiUrl}/innermaterial`; // Endpoint to manage inner material

// INNER FLOWER MODULE
export const ine_flower_tablename = 'ine_flower'; // Table Name
export const ine_flower_ModuleID = 10; // Module ID
export const FLOWER_ENDPOINT = `${apiUrl}/flower`; // Endpoint to manage flower

// INNER COLOR SHADE MODULE
export const ine_color_shade_tablename = 'ine_color_shade'; // Table Name
export const ine_color_shade_ModuleID = 11; // Module ID
export const COLORSHADE_ENDPOINT = `${apiUrl}/colorshade`; // Endpoint to manage color shade

// OTHERS 
// ACTIVITY MODULE
export const ine_logs_tablename = 'ine_other_activity'; // Table Name
export const ine_Logs_ModuleID = 17; // Module ID
export const OTHER_ACTIVITY_ENDPOINT = `${apiUrl}/logs`; // Endpoint to manage other activity

// COUNTRY MODULE
export const ine_countries_tablename = 'ine_countries'; // Table Name
export const OTHER_COUNTRIES_ENDPOINT = `${apiUrl}/others/countries`; // Endpoint to manage other countries

// STATE_DISTRICT MODULE
export const ine_state_district_tablename = 'ine_state_district'; // Table Name
export const OTHER_STATE_DISTRICT_E1_ENDPOINT = `${apiUrl}/others/state_district/endpoint1`; // Endpoint to manage other - state list 
export const OTHER_STATE_DISTRICT_E2_ENDPOINT = `${apiUrl}/others/state_district/endpoint2`; // Endpoint to manage other - district list 
export const OTHER_STATE_DISTRICT_E3_ENDPOINT = `${apiUrl}/others/state_district/endpoint3`; // Endpoint to manage other - pincode list

// ROLE MODULE
export const ine_roles_tablename = 'ine_roles'; // Table Name
export const ine_roles_ModuleID = 12; // Module ID
export const ROLE_ENDPOINT = `${apiUrl}/role`; // Endpoint to manage role

// MODULES - MODULE
export const ine_modules_tablename = 'ine_modules'; // Table Name
export const ROLE_MODULE_ENDPOINT = `${apiUrl}/role/module`; // Endpoint to manage module
export const MODULES_MODULE_ENDPOINT = `${apiUrl}/modules`; // Endpoint to manage modules
export const MODULES_MODULE_CHECK_ENDPOINT = `${apiUrl}/modules/particularmodulecheck`; // Endpoint to manage modules

// PERMISSION MODULE
export const ine_permissions_tablename = 'ine_permissions'; // Table Name
export const ROLE_PERMISSION_ENDPOINT = `${apiUrl}/role/permission`; // Endpoint to manage module
export const ROLE_PERMISSIONS_ENDPOINT = `${apiUrl}/users/rolepermissionmodule`; // Endpoint to manage module


// USER MODULE
export const ine_users_tablename = 'ine_users'; // Table Name
export const ine_users_details_tablename = 'ine_users_details'; // Table Name
export const ine_users_ModuleID = 13; // Module ID
export const ine_users_Permission_ModuleID = 66; // Module ID
export const ine_users_role_Permission_ModuleID = 67; // Module ID
export const ine_referral_tablename = 'ine_referral'; // Table Name

export const USER_ENDPOINT = `${apiUrl}/users`; // Endpoint to manage users
export const USER_CHANGEPASSWORD_ENDPOINT = `${apiUrl}/users/changepassword`; // Endpoint to manage user change password
export const USER_FORGOTPASSWORD_ENDPOINT = `${apiUrl}/users/forgotpassword`; // Endpoint to manage user forgot password
export const USER_OTP_ENDPOINT = `${apiUrl}/users/otp`; // Endpoint to manage user otp
export const USER_NEWPASSWORD_ENDPOINT = `${apiUrl}/users/newpassword`; // Endpoint to manage user new password
export const USER_DEACTIVATE_ENDPOINT = `${apiUrl}/users/deactivate`; // Endpoint to manage user deactivate account
export const LOGIN_ENDPOINT = `${apiUrl}/users/login`; // Endpoint to manage user login
export const FRONT_USERS_LOGIN_ENDPOINT = `${apiUrl}/users/login/frontuserslogin`; // Endpoint to manage user login

// CUSTOMER MODULE
export const ine_customers_ModuleID = 14; // Module ID
export const CUSTOMER_ENDPOINT = `${apiUrl}/customers`; // Endpoint to manage customers

// MANAGE REQUEST MODULE
export const ine_managerequest_ModuleID = 72; // Module ID
export const ine_manage_request_tablename = 'ine_manage_request'; // Table Name
export const MANAGEREQUEST_ENDPOINT = `${apiUrl}/managerequest`; // Endpoint to manage request

// MANAGE DESIGN MODULE
export const ine_designer_tablename = 'ine_designer'; // Table Name
export const ine_designer_ModuleID = 15; // Module ID
export const DESIGNER_ENDPOINT = `${apiUrl}/designer`; // Endpoint to manage request
export const DESIGNER_APPROVED_ENDPOINT = `${apiUrl}/designer/approved`; // Endpoint to manage request apprvoed
export const DESIGNER_REJECTED_ENDPOINT = `${apiUrl}/designer/rejected`; // Endpoint to manage request rejected

// GIFT CARDS MODULE 
export const ine_giftcard_ModuleID = 17; // Module ID
export const ine_multiple_business_giftcard_ModuleID = 17; // Module ID
export const ine_giftcard_tablename = "ine_giftcard"; // Table Name 
export const ine_giftcard_calc_tablename = "ine_giftcard_calc"; // Table Name 
export const ine_giftcard_generate_tablename = "ine_giftcard_generate"; // Table Name 
export const GIFT_CARD_ENDPOINT = `${apiUrl}/giftcard`; // Endpoint to manage gift cards
export const GIFT_CARD_ENDPOINT_FORFETCH = `${apiUrl}/giftcard/fetchgiftcarddetails`; // Endpoint to manage gift cards
export const GIFT_CARD_COUPONS_ENDPOINT = `${apiUrl}/giftcard/coupons`; // Endpoint to manage gift cards coupons


// REPLICATOR MODULE
export const ine_replicator_moduleID = 18; // Module ID
export const ine_replicator_tablename = "ine_replicator"; // Table Name 
export const REPLICATOR_ENDPOINT = `${apiUrl}/replicator`;  // Endpoint to manage replicator 
export const MY_REPLICATOR_BY_USERID = `${apiUrl}/replicator/getbyid`;  // Endpoint to manage replicator main data 


// SALES MODULE 
export const ine_sales_ModuleID = 80; // Module ID
export const ine_sales_tablename = "ine_sales"; // Table Name 
export const SALES_ENDPOINT = `${apiUrl}/sales`; // Endpoint to manage sales

// INVENTORY MODULE 
export const ine_inventory_ModuleID = 82; // Module ID
export const ine_inventory_tablename = "ine_inventory"; // Table Name 
export const INVENTORY_ENDPOINT = `${apiUrl}/inventory`; // Endpoint to inventory

// BATCHES MODULE 
export const ine_batches_ModuleID = 84; // Module ID
export const ine_batches_tablename = "ine_batches"; // Table Name 
export const BATCHES_ENDPOINT = `${apiUrl}/batches`; // Endpoint to manage Batches

// SELL MODULE
export const ine_sell_ModuleID = 86; // Module ID


// GET STATUS
export const ine_status_tablename = 'ine_status'; // Table Name


// SERIAL NUMBER MODULE
export const ine_serial_number = 'ine_serial_number'; // Table Name

// INE ASSETS TABLENAME 
export const ine_assets_tablename = 'ine_assets'; // Table Name

export const UPLOAD_FILE_TO_AZURE = `${apiUrl}/uploadtoazure`; // Endpoint to manage categories data


// MARKETING MODULE 
export const ine_marekting_ModuleID = 94; // Module ID
export const ine_marekting_tablename = "ine_marketing"; // Table Name 
export const MARKETING_ENDPOINT = `${apiUrl}/marketing`; // Endpoint to manage markenting
export const MARKETING_DASHBOARD_ENDPOINT = `${apiUrl}/marketing/getproducts`; // Endpoint to manage markenting
export const MY_MARKETING_ENDPOINT = `${apiUrl}/marketing/mymarketing`; // Endpoint to manage my markenting on the admin side


// CAMPAIGN MODULE
export const ine_campaign_tablename = 'ine_campaign'; // Table Name
export const ine_campaign_ModuleID = 98; // Module ID
export const CAMPAIGN_ENDPOINT = `${apiUrl}/campaign`; // Endpoint to manage campaign
export const FETCH_PRODUCTS_BY_CATEGORY = `${apiUrl}/fetchrawproduct`; // Endpoint to products by category


// PACKERS  MODULE
export const ine_packers_tablename = 'ine_packers'; // Table Name
export const ine_packers_ModuleID = 99; // Module ID
export const PACKERS_ENDPOINT = `${apiUrl}/packers`; // Endpoint to manage packers

// BOXPACKING ENDPOINTS
export const ine_packers_boxes_tablename = 'ine_packers_boxes';
export const PACKERS_BOXPACKING_ENDPOINT = `${apiUrl}/packers/boxpack`; // Endpoint to manage box packing
export const PACKERS_VERIFICATION_ENDPOINT = `${apiUrl}/packers/verification`; // Endpoint to manage box packing

// CARTON PACKING ENDPOINTS
export const ine_packers_cartons_tablename = 'ine_packers_cartons';
export const ine_packers_carton_element_tablename = 'ine_carton_elements';
export const PACKERS_CARTONPACKING_ENDPOINT = `${apiUrl}/packers/cartonpack`; // Endpoint to manage carton packing
export const PACKERS_CARTONS_LIST_IN_WAREHOUSE_ENDPOINT = `${apiUrl}/fetchrawproduct/fetchrawcartons`; // Endpoint to manage carton packing


// PACKERS  MODULE
export const ine_warehouse_tablename = 'ine_warehouse'; // Table Name
export const ine_warehouse_racks_tablename = 'ine_warehouse_racks'; // Table Name
export const ine_warehouse_ModuleID = 103; // Module ID
export const WAREHOUSE_ENDPOINT = `${apiUrl}/warehouse`; // Endpoint to manage warehouse
export const CHANNEL_ASSIGN_ENDPOINT = `${apiUrl}/channelassign`; // Endpoint to manage warehouse
export const CHANNEL_DETAILS_ENDPOINT = `${apiUrl}/channelassign/roledetails`; // Endpoint to manage warehouse
export const RACKS_BOXES_DETAILSENDPOINT = `${apiUrl}/channelassign/fetchboxfromracks`; // Endpoint to manage warehouse
export const RACKS_DASHBOARD_ENDPOINT = `${apiUrl}/warehouse/fetchdashboarddetail`; // Endpoint to manage warehouse



// OFFLINE SALES MODULE 
export const ine_offline_sales_tablename = 'ine_warehouse'; // Table Name
export const ine_offline_sales1_tablename = 'ine_warehouse_racks'; // Table Name
export const ine_offline_sales_ModuleID = 110; // Module ID
export const OFFLINE_SALES_ENDPOINT = `${apiUrl}/offlinesales`;



// CUSTOMER BILLS 
export const ine_orders_tablename = 'ine_orders'; // Table Name
export const INE_ORDERS_ENDPOINT = `${apiUrl}/offlinesales/orders`;
export const INE_SEARCH_USER_BY_PHONE_NUMBER = `${apiUrl}/offlinesales/invoice/searchuser`;
export const OFFLINE_SALES_USER_ADDRESSES_ENDPOINT = `${apiUrl}/offlinesales/invoice/searchaddress`;
export const OFFLINE_SALES_SEARCH_PRODUCT_BY_SERIAL_NUMBER_ENDPOINT = `${apiUrl}/offlinesales/invoice/searchbyserialnumber`;
export const OFFLINE_SALES_CREATE_USER_ENDPOINT = `${apiUrl}/offlinesales/invoice/createuser`;
export const OFFLINE_SALES_COUPONS_ENDPOINT = `${apiUrl}/offlinesales/invoice/coupons`;
export const OFFLINE_SALES_GIFTCARD_VERIFY_ENDPOINT = `${apiUrl}/offlinesales/invoice/giftcard/verification`;
export const OFFLINE_SALES_OTP_VERIFY_ENDPOINT = `${apiUrl}/offlinesales/invoice/giftcard/otpverification`;

//SUPPORT CHANNEL ENDPOINT 
export const SUPPORT_CHANNEL_ROLE_ID = 7; // Table Name
export const ine_supportchannel_tablename = 'ine_warehouse'; // Table Name
export const ine_order_return_tablename = 'ine_order_return'; // Table Name
export const ine_supportchannel_ModuleID = 114; // Module ID
export const INE_SUPPORT_CHANNEL_ENDPOINT = `${apiUrl}/supportchannel`;
export const INE_ORDER_RETURN_ENDPOINT = `${apiUrl}/supportchannel/orderreturn`;

// PRODUCT  MODULE
export const ine_products_tablename = 'ine_products'; // Table Name
export const ine_products_ModuleID = 9; // Module ID
export const PRODUCTS_ENDPOINT = `${apiUrl}/products`; // Endpoint to manage products

// TICKET MANAGEMENT MODULE
export const ine_tickets_ModuleID = 0; // Module ID
// assign Ticket to someone 
export const TICKET_ASSIGN_ENDPOINT = `${apiUrl}/ticket/assignticket`;
// Manage Subject
export const ine_ticket_subject_tablename = 'ine_ticket_subject'; // Table Name
export const TICKET_SUBJECT_ENDPOINT = `${apiUrl}/ticket/subject`; // Endpoint to manage ticket - manage subject data
// Manage Ticket
export const ine_tickets_tablename = 'ine_tickets'; // Table Name
export const TICKETS_ENDPOINT = `${apiUrl}/ticket`; // Endpoint to manage ticket data
// Ticket New User
export const ine_ticket_new_users_tablename = 'ine_ticket_new_users'; // Table Name
// Manage Response
export const ine_ticket_response_tablename = 'ine_ticket_response'; // Table Name
export const TICKET_RESPONSE_ENDPOINT = `${apiUrl}/ticket/response`; // Endpoint to manage ticket - manage response data

export const user_addresses_tablename = 'ine_users_addresses'; // Table Name

// AFFILIATE MODULE 
export const user_affiliate_tablename = 'ine_affiliate_program'; // Table Name
export const AFFILIATE_ENDPOINT = `${apiUrl}/affiliate`; // Endpoint to manage AFFILIATE
export const AFFILIATE_REJECT_ENDPOINT = `${apiUrl}/affiliate/reject`; // Endpoint to manage AFFILIATE


// FAQS MODULE  
export const ine_faq_ModuleID = 133; // Module ID

// DMASTHEAD MODULE
export const ine_dmasthead_ModuleID = 127; // Module ID


// MMASTHEAD MODULE
export const ine_mmasthead_ModuleID = 128; // Module ID

// ORDERS FOR ADMIN
export const INE_ADMIN_ORDERS_ENDPOINT = `${apiUrl}/orders`; // Module ID
export const INE_ADMIN_CHECK_COUPON_ENDPOINT = `${apiUrl}/orders/checkcoupon`; // Module ID
export const INE_CREATE_ORDERS = `${apiUrl}/orders/createorder`; // Module ID
export const ine_order_products_tablename = 'ine_order_products'; // Table Name



// CATEGORY MODULE
export const ine_users_checkout_tablename = 'ine_users_checkout'; // Table Name

export const USERS_CHECKOUT_ENDPOINT = `${apiUrl}/checkout`; // Endpoint to manage categories data


// FRONTEND

// ONLINE SALES CHANNEL PRODUCT TABLE 
export const ine_online_sales_channel_tablename = 'ine_online_sales'; // Table Name

// DESKTOP MASTHEAD MODULE
export const ine_desktop_masthead_tablename = 'ine_desktop_masthead'; // Table Name
export const ine_desktop_masthead_ModuleID = 0; // Module ID
export const DESKTOP_MASTHEAD_ENDPOINT = `${apiUrl}/desktopmasthead`; // Endpoint to manage desktop masthead data

// MOBILE MASTHEAD MODULE
export const ine_mobile_masthead_tablename = 'ine_mobile_masthead'; // Table Name
export const ine_mobile_masthead_ModuleID = 0; // Module ID
export const MOBILE_MASTHEAD_ENDPOINT = `${apiUrl}/mobilemasthead`; // Endpoint to manage mobile masthead data

// BLOG MODULE
export const ine_blog_tablename = 'ine_blogs'; // Table Name
export const ine_blog_ModuleID = 0; // Module ID
export const BLOG_ENDPOINT = `${apiUrl}/blog`; // Endpoint to manage blog data

// BLOG CATEGORY MODULE
export const ine_blog_category_tablename = 'ine_blog_category'; // Table Name
export const ine_blog_category_ModuleID = 140; // Module ID
export const BLOG_CATEGORY_ENDPOINT = `${apiUrl}/blog/categories`; // Endpoint to manage blog categories data

// CONTACT US MODULE - Inquiry
export const ine_contact_inquiry_tablename = 'ine_contact_inquiry'; // Table Name
export const ine_contact_inquiry_ModuleID = 0; // Module ID
export const CONTACT_INQUIRY_ENDPOINT = `${apiUrl}/contactus/inquiry`; // Endpoint to manage contact Inquiry data

// CONTACT US MODULE
export const ine_contact_us_tablename = 'ine_contact_us'; // Table Name
export const ine_contact_us_ModuleID = 0; // Module ID
export const CONTACTUS_ENDPOINT = `${apiUrl}/contactus`; // Endpoint to manage contact us data

// FAQs MODULE
export const ine_faqs_tablename = 'ine_faqs'; // Table Name
export const ine_faqs_ModuleID = 0; // Module ID
export const FAQS_ENDPOINT = `${apiUrl}/faqs`; // Endpoint to manage faqs data

// SOCIAL LINK MODULE
export const ine_social_link_tablename = 'ine_social_links'; // Table Name
export const ine_social_link_ModuleID = 136; // Module ID
export const SOCIALLINK_ENDPOINT = `${apiUrl}/sociallink`; // Endpoint to manage social links data

// PAGES MODULE
export const ine_pages_tablename = 'ine_pages'; // Table Name
export const ine_pages_ModuleID = 0; // Module ID
export const PAGES_ENDPOINT = `${apiUrl}/pagesdata`; // Endpoint to manage social links data

// OTHER MODULE
export const ine_settings_tablename = 'ine_settings'; // Table Name
export const ine_settings_ModuleID = 0; // Module ID
export const SETTING_ENDPOINT = `${apiUrl}/others/sitesettings`; // Endpoint to manage site settings data

// MY ADDRESS MODULE
export const ine_my_address_tablename = 'ine_my_address'; // Table Name
export const ine_my_address_ModuleID = 0; // Module ID
export const MYADDRESS_ENDPOINT = `${apiUrl}/myaddress`; // Endpoint to manage my address data

// MY WISHLIST MODULE
export const ine_my_wishlist_tablename = 'ine_wishlist'; // Table Name
export const ine_my_wishlist_ModuleID = 0; // Module ID
export const WISHLIST_ENDPOINT = `${apiUrl}/mywishlist`; // Endpoint to manage my wishlist data

// RATING MODULE
export const ine_rating_tablename = 'ine_rating'; // Table Name
export const ine_rating_ModuleID = 0; // Module ID
export const RATING_ENDPOINT = `${apiUrl}/rating`; // Endpoint to manage my rating data

// CART MODULE
export const ine_cart_tablename = 'ine_cart'; // Table Name
export const ine_cart_ModuleID = 0; // Module ID
export const CART_ENDPOINT = `${apiUrl}/cart`; // Endpoint to manage cart data

// NOTIFICATION MODULE
export const ine_ecomm_meta_tablename = 'ine_ecomm_meta'; // Table Name
export const ine_notification_ModuleID = 0; // Module ID
export const NOTIFICATION_ENDPOINT = `${apiUrl}/notifications`; // Endpoint to manage notification data

// CARD SAVE MODULE
export const ine_save_cards_tablename = 'ine_save_cards'; // Table Name
export const ine_savecards_ModuleID = 0; // Module ID
export const SAVECARDS_ENDPOINT = `${apiUrl}/savecards`; // Endpoint to manage card saves data

// MY REFERRAL MODULE
export const ine_my_referral_tablename = 'ine_my_referral'; // Table Name
export const ine_my_referral_ModuleID = 0; // Module ID
export const REFERRAL_ENDPOINT = `${apiUrl}/myreferral`; // Endpoint to manage my refererral data

// MY GIFTCARD MODULE
export const ine_my_giftcard_tablename = 'ine_my_giftcard'; // Table Name
export const ine_my_giftcard_ModuleID = 0; // Module ID
export const GIFTCARD_ENDPOINT = `${apiUrl}/mygiftcard`; // Endpoint to manage my giftcard data

// MY WALLET MODULE
export const ine_my_wallet_tablename = 'ine_my_wallet'; // Table Name
export const ine_my_wallet_ModuleID = 0; // Module ID
export const WALLET_ENDPOINT = `${apiUrl}/mywallet`; // Endpoint to manage my wallet data
